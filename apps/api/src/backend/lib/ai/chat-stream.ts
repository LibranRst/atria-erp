import {
  convertToModelMessages,
  createUIMessageStream,
  stepCountIs,
  streamText,
  NoSuchToolError,
} from "ai";
import type { UIMessage, UIMessageChunk } from "ai";

import { buildSystemPrompt } from "./prompts";
import { shouldStopAfterFinalFollowUps } from "./chat-stop-conditions";
import {
  isFallbackWorthyError,
  resolveChatModel,
  resolveProviderChain,
  type ChatProviderName,
} from "./providers";
import { buildAiTools } from "./tools";
import { providerTools } from "./tool-schema-compatibility";
import {
  generationMessages,
  initialActiveTools,
  stepActiveTools,
  freshReadActiveTools,
  successfulReadOutput,
  requiredFreshReads,
} from "./chat-context";
import type { AiToolContext } from "./tools/context";
import type { AiPreferenceInput } from "@atria/core/validations/ai-preference";
import { parseFinancialHistoryRequest } from "@atria/core/ai/financial-history";
import { isExpenseStatusQuestion } from "./grounded-expenses";
import {
  isGroundedFactQuestion,
  isHistoricalGroundedFactQuestion,
  renderGroundedFacts,
  type GroundedToolObservation,
} from "./grounded-facts";

/**
 * Batas langkah agent. DeepSeek V4 Flash cenderung sangat sering memanggil tool,
 * jadi pagar ini menjaga latensi dan biaya tetap masuk akal untuk chat mobile.
 *
 * Dinaikkan dari 8 ke 10 saat `suggestFollowUps` ditambahkan: saran lanjutan
 * memakai satu langkah tersendiri di akhir, dan tanpa ruang tambahan ia akan
 * memakan jatah langkah yang seharusnya dipakai mengambil data.
 */
const MAX_STEPS = 10;
const STREAM_DEADLINE_MS = 45_000;
const CHAT_FAILURE_MESSAGE = "Maaf, asisten sedang tidak bisa menjawab. Coba lagi sebentar lagi.";
const CHAT_TIMEOUT_MESSAGE =
  "Asisten membutuhkan waktu terlalu lama. Pertanyaan tetap tersimpan. Coba lagi.";

/**
 * Chunk yang belum membuktikan model benar-benar merespons.
 * Selama hanya chunk seperti ini yang keluar, kita masih boleh berpindah
 * ke penyedia cadangan tanpa membuat tampilan pengguna terlihat aneh.
 */
const PREAMBLE_CHUNK_TYPES = new Set(["start", "start-step", "step-start"]);

export type ChatStreamResult = {
  readonly stream: ReadableStream<UIMessageChunk>;
};

export type ChatStreamInput = {
  /** Original validated human text, before adding untrusted attachment content. */
  readonly userQuestion?: string;
  readonly companyBudgetPolicy?: import("@atria/core/ai/company-budget-policy").CompanyBudgetPolicy;
  readonly verifiedOwnProfile?: import("@atria/core/ai/own-profile").OwnProfileSnapshot;
  readonly messages: UIMessage[];
  readonly toolContext: AiToolContext;
  readonly userName: string;
  readonly conversationId: string;
  readonly preference: AiPreferenceInput;
  readonly companyName: string;
  readonly signal?: AbortSignal;
  readonly onAssistantMessage: (event: {
    message: UIMessage;
    provider: ChatProviderName;
    inputTokens?: number;
    outputTokens?: number;
  }) => Promise<void>;
};

/**
 * Menjalankan agent dengan urutan penyedia DeepSeek lalu Gemini.
 *
 * Perpindahan ke penyedia cadangan hanya terjadi selama belum ada keluaran model
 * yang terkirim ke klien. Begitu token pertama sudah mengalir, kegagalan
 * dibiarkan menjadi error — menyambung dua stream berbeda di tengah jalan akan
 * menghasilkan jawaban yang tidak konsisten.
 */
export function runChatStream(input: ChatStreamInput): ChatStreamResult {
  const providers = resolveProviderChain();
  const deadline = AbortSignal.timeout(STREAM_DEADLINE_MS);
  const signal = input.signal ? AbortSignal.any([input.signal, deadline]) : deadline;
  const question =
    input.userQuestion ??
    input.messages
      .findLast((message) => message.role === "user")
      ?.parts.flatMap((part) => (part.type === "text" ? [part.text] : []))
      .join("\n") ??
    "";
  const grounded = isGroundedFactQuestion(question);
  const historical = isHistoricalGroundedFactQuestion(question);
  const asOf = new Date().toISOString();
  const historicalRequest = historical
    ? parseFinancialHistoryRequest(question, new Date(asOf))
    : null;
  const latestUser = input.messages.findLast((message) => message.role === "user");
  const intentMessages = input.messages.map((message) =>
    message === latestUser
      ? { ...message, parts: [{ type: "text" as const, text: question }] }
      : message,
  );
  let completedGrounded:
    | {
        provider: ChatProviderName;
        inputTokens?: number;
        outputTokens?: number;
      }
    | undefined;
  let unverifiedAnswer = false;
  const failureMessage = (): string =>
    unverifiedAnswer
      ? "Jawaban belum dapat diverifikasi. Coba lagi untuk membaca data terbaru."
      : deadline.aborted || (signal.aborted && signal.reason?.name === "TimeoutError")
        ? CHAT_TIMEOUT_MESSAGE
        : CHAT_FAILURE_MESSAGE;

  const stream = createUIMessageStream({
    ...(grounded
      ? {
          originalMessages: input.messages,
          onEnd: async ({
            responseMessage,
            isAborted,
          }: {
            responseMessage: UIMessage;
            isAborted: boolean;
          }): Promise<void> => {
            if (completedGrounded && !isAborted && !signal.aborted)
              await input.onAssistantMessage({ message: responseMessage, ...completedGrounded });
          },
        }
      : {}),
    execute: async ({ writer }) => {
      signal.throwIfAborted();
      if (providers.length === 0) {
        throw new Error("Tidak ada penyedia AI yang dikonfigurasi.");
      }

      // Klien memakai id ini untuk melanjutkan percakapan yang sama pada
      // pesan berikutnya, termasuk ketika percakapan baru saja dibuat.
      writer.write({
        type: "data-conversation",
        data: { conversationId: input.conversationId },
        transient: true,
      });

      let lastError: unknown = null;

      for (let index = 0; index < providers.length; index += 1) {
        signal.throwIfAborted();
        const provider = providers[index];
        const isLastProvider = index === providers.length - 1;

        // Chunk pembuka ditahan sampai model terbukti merespons, supaya
        // percobaan yang gagal tidak meninggalkan jejak di layar pengguna.
        const buffered: UIMessageChunk[] = [];
        let modelHasResponded = false;
        let streamError: unknown = null;

        try {
          const registered = providerTools(
            buildAiTools({ ...input.toolContext, userQuestion: question, asOf }),
            provider,
          );
          // A pure factual turn cannot execute a proposal even if the model
          // requests one after discovery. Restrict the actual execution registry.
          const readNames = new Set(
            freshReadActiveTools(Object.keys(registered), Object.keys(registered)),
          );
          const tools = grounded
            ? Object.fromEntries(
                Object.entries(registered).filter(([name]) =>
                  historical ? name === "getFinancialHistory" : readNames.has(name),
                ),
              )
            : registered;
          const available = Object.keys(tools);
          const observed: GroundedToolObservation[] = [];
          const readCalls = new Map<string, { toolName: string; input: unknown }>();
          let finalChunk: Extract<UIMessageChunk, { type: "finish" }> | undefined;
          const initial =
            provider === "NINEROUTER" ? initialActiveTools(intentMessages, available) : available;
          // Period reports resolve the original project/account names themselves.
          // A current/recent page cannot support historical totals; keeping it
          // out of this turn also avoids unrelated parallel reads and failures.
          const active = historical
            ? available.includes("getFinancialHistory")
              ? ["getFinancialHistory"]
              : []
            : initial;
          let requestedDiscovery = false;
          const requiredReads = (
            historical
              ? active.includes("getFinancialHistory")
                ? ["getFinancialHistory"]
                : []
              : isExpenseStatusQuestion(question)
                ? active.includes("getRecentExpenses")
                  ? ["getRecentExpenses"]
                  : []
                : requiredFreshReads(intentMessages, active)
          ).filter((name) => !(name === "getOwnProfileContext" && input.verifiedOwnProfile));
          let factsReady = requiredReads.length === 0;
          const result = streamText({
            abortSignal: signal,
            // The SDK default logs provider exceptions, including request details.
            // Error propagation still reaches the handlers below.
            onError: ({ error }): void => {
              streamError = error;
            },
            model: resolveChatModel(provider),
            system:
              buildSystemPrompt(
                provider,
                input.userName,
                input.toolContext,
                input.preference,
                input.companyName,
                input.companyBudgetPolicy,
              ) +
              (input.verifiedOwnProfile
                ? `\nPROFIL AKTUAL TERVERIFIKASI PADA PERMINTAAN INI (dibaca ulang dari database untuk akun sesi): ${JSON.stringify(input.verifiedOwnProfile)}. Gunakan snapshot ini untuk jawaban nama/foto aktual; nilai after usulan lama tidak menggantikannya. Ini pembacaan data, bukan usulan atau bukti penyimpanan.`
                : "") +
              (grounded
                ? "\nGILIRAN PEMBACAAN FAKTA: ambil semua data terkini yang diminta melalui tool baca sesuai izin. Jawaban angka/status disusun server dari hasil tool. Jangan membuat usulan, memakai angka dari riwayat, atau memilih entitas ambigu. Bila perlu pilihan, baca kandidat lalu minta pengguna memilih."
                : ""),
            messages: await convertToModelMessages(
              generationMessages(input.messages, provider).map((msg) => ({
                ...msg,
                parts: msg.parts.filter((part) => {
                  if (part.type !== "file") return true;
                  const mime =
                    (part as { mediaType?: string; mimeType?: string }).mediaType ||
                    (part as { mediaType?: string; mimeType?: string }).mimeType ||
                    "";
                  // 9Router receives PDF text extracted from all rendered pages;
                  // its selected gateway route does not support native PDF parts.
                  return (
                    mime.startsWith("image/") ||
                    (mime === "application/pdf" && provider !== "NINEROUTER")
                  );
                }),
              })),
            ),
            tools,
            activeTools: active,
            repairToolCall:
              provider === "NINEROUTER"
                ? async ({ error, toolCall }) => {
                    if (
                      !NoSuchToolError.isInstance(error) ||
                      !available.includes(toolCall.toolName) ||
                      !available.includes("getAvailableActions")
                    )
                      return null;
                    requestedDiscovery = true;
                    // The unavailable call is replaced with read-only discovery, never executed
                    // with invented arguments. The next step has its original validated schema.
                    return { ...toolCall, toolName: "getAvailableActions", input: "{}" };
                  }
                : undefined,
            prepareStep: ({ steps }) => {
              const called = steps.flatMap((step) => step.toolCalls.map((call) => call.toolName));
              const readResults = steps.flatMap((step) => step.toolResults);
              const successful = readResults.filter((result) =>
                successfulReadOutput(result.output),
              );
              const pending = requiredReads.filter(
                (name) => !successful.some((result) => result.toolName === name),
              );
              // A failed call is not a fresh snapshot. Allow one retry per required
              // reader while retaining the stream's existing step/deadline limits.
              let requiredRead = pending.find(
                (name) => called.filter((calledName) => calledName === name).length < 2,
              );
              const warehouseResults = readResults.filter((result) =>
                ["getWarehouseContext", "getStockCorrectionContext"].includes(result.toolName),
              );
              const hasFreshInventory = warehouseResults.some((result) => {
                const output = result.output;
                return (
                  successfulReadOutput(output) &&
                  typeof output === "object" &&
                  output !== null &&
                  (("inventory" in output && Array.isArray(output.inventory)) ||
                    ("items" in output &&
                      Array.isArray(output.items) &&
                      output.items.some(
                        (item: unknown) =>
                          typeof item === "object" &&
                          item !== null &&
                          "currentStock" in item &&
                          "reservedStock" in item,
                      )))
                );
              });
              // Location identity alone is not evidence for current quantities.
              // Accept either authorized inventory reader; bound failed attempts.
              if (
                !requiredRead &&
                requiredReads.includes("getInventoryLocations") &&
                !hasFreshInventory &&
                warehouseResults.length < 2
              )
                requiredRead = active.includes("getWarehouseContext")
                  ? "getWarehouseContext"
                  : active.includes("getStockCorrectionContext")
                    ? "getStockCorrectionContext"
                    : undefined;
              factsReady =
                pending.length === 0 &&
                !requiredRead &&
                (!requiredReads.includes("getInventoryLocations") ||
                  hasFreshInventory ||
                  successful.some((result) => result.toolName === "requestUserInput"));
              return {
                ...(requiredRead
                  ? { toolChoice: { type: "tool" as const, toolName: requiredRead } }
                  : {}),
                activeTools: !factsReady
                  ? freshReadActiveTools(requestedDiscovery ? available : active, available)
                  : requestedDiscovery
                    ? available
                    : stepActiveTools(
                        active,
                        available,
                        steps.flatMap((step) => step.toolCalls.map((call) => call.toolName)),
                      ),
              };
            },
            stopWhen: [
              stepCountIs(MAX_STEPS),
              ({ steps }) => shouldStopAfterFinalFollowUps(steps),
              ({ steps }) =>
                Boolean(historicalRequest?.error) &&
                steps.some((step) =>
                  step.toolResults.some((read) => read.toolName === "getFinancialHistory"),
                ),
              ({ steps }) =>
                grounded &&
                renderGroundedFacts(
                  question,
                  steps.flatMap((step) =>
                    step.toolResults.map((result) => ({
                      toolName: result.toolName,
                      toolCallId: result.toolCallId,
                      input: result.input,
                      output: result.output,
                    })),
                  ),
                  available,
                )?.status === "verified",
            ],
          });

          const uiStream = result.toUIMessageStream({
            originalMessages: input.messages,
            onError: (err) => {
              // UI error formatting also receives tool failures. The
              // generation callback above receives fatal provider errors only.
              if (!grounded) streamError = err;
              return failureMessage();
            },
            onEnd: async ({ responseMessage }) => {
              if (grounded || unverifiedAnswer || !factsReady) return;
              try {
                const usage = await result.usage;
                await input.onAssistantMessage({
                  message: responseMessage,
                  provider,
                  inputTokens: usage?.inputTokens,
                  outputTokens: usage?.outputTokens,
                });
              } catch {
                // Abaikan jika pembacaan usage gagal saat stream terputus
              }
            },
          });

          for await (const chunk of uiStream) {
            // Emit a provider failure once through the outer stream. Forwarding
            // it here and throwing after completion would duplicate the error.
            if (grounded && chunk.type === "error")
              throw streamError ?? new Error("Provider failed during factual read");
            if (grounded && chunk.type === "tool-input-available")
              readCalls.set(chunk.toolCallId, { toolName: chunk.toolName, input: chunk.input });
            // Successes and failures share the actual UI stream order. Mixing
            // onStepFinish with chunk consumption can put an old failed attempt
            // after its successful retry when the consumer is slower.
            if (grounded && chunk.type === "tool-output-available") {
              const call = readCalls.get(chunk.toolCallId);
              if (call)
                observed.push({ ...call, toolCallId: chunk.toolCallId, output: chunk.output });
            }
            if (grounded && chunk.type === "tool-input-error")
              observed.push({
                toolName: chunk.toolName,
                toolCallId: chunk.toolCallId,
                input: chunk.input,
                output: { error: "Pemanggilan sumber tidak valid. Perlu pembacaan ulang." },
              });
            if (grounded && chunk.type === "tool-output-error") {
              const call = readCalls.get(chunk.toolCallId);
              if (call)
                observed.push({
                  ...call,
                  toolCallId: chunk.toolCallId,
                  output: { error: "Sumber belum berhasil dibaca. Perlu pembacaan ulang." },
                });
            }
            if (grounded && ["text-start", "text-delta", "text-end"].includes(chunk.type)) continue;
            if (grounded && chunk.type === "finish") {
              finalChunk = chunk;
              continue;
            }
            if (!grounded && !factsReady && chunk.type === "text-delta" && chunk.delta.trim()) {
              unverifiedAnswer = true;
              throw new Error("Fresh source reads required before an answer");
            }
            if (chunk.type === "error" && !modelHasResponded) {
              throw (
                streamError ?? new Error(chunk.errorText || "Provider failed before responding")
              );
            }

            if (!modelHasResponded) {
              if (PREAMBLE_CHUNK_TYPES.has(chunk.type)) {
                buffered.push(chunk);
                continue;
              }
              modelHasResponded = true;
              for (const pending of buffered) {
                writer.write(pending);
              }
              buffered.length = 0;
            }
            writer.write(chunk);
          }
          // SDK abort may close normally without an error chunk. A deadline must
          // still reach the client, so it never looks like an empty success.
          signal.throwIfAborted();
          if (grounded) {
            if (streamError) throw streamError;
            const answer = renderGroundedFacts(question, observed, available);
            if (!answer) throw new Error("Factual answer unavailable");
            // Publish and persist exactly the same server-rendered response.
            // Tool chunks above remain the real reads (including their errors).
            for (const pending of buffered) writer.write(pending);
            const textId = crypto.randomUUID();
            writer.write({ type: "start-step" });
            writer.write({ type: "text-start", id: textId });
            writer.write({ type: "text-delta", id: textId, delta: answer.text });
            writer.write({ type: "text-end", id: textId });
            writer.write({
              type: "data-grounded-facts",
              data: {
                status: answer.status,
                sources: answer.sources,
                coveredDomains: answer.coveredDomains,
                missingDomains: answer.missingDomains,
              },
            });
            writer.write({ type: "finish-step" });
            const usage = await result.usage;
            completedGrounded = {
              provider,
              inputTokens: usage?.inputTokens,
              outputTokens: usage?.outputTokens,
            };
            writer.write(finalChunk ?? { type: "finish", finishReason: "stop" });
          } else if (!factsReady) {
            unverifiedAnswer = true;
            throw new Error("Fresh source reads incomplete");
          }
          return;
        } catch (error) {
          // A stopped client/deadline must never start another paid provider.
          signal.throwIfAborted();
          lastError = error;

          const canRetry = !modelHasResponded && !isLastProvider && isFallbackWorthyError(error);
          if (!canRetry) {
            throw error;
          }
          // Lanjut ke penyedia berikutnya; belum ada apa pun yang terkirim.
        }
      }

      throw lastError ?? new Error("Semua penyedia AI gagal merespons.");
    },
    onError: () => {
      console.error("AI chat stream gagal.");
      return failureMessage();
    },
  });

  return { stream };
}
