import "server-only";

import { convertToModelMessages, createUIMessageStream, stepCountIs, streamText } from "ai";
import type { UIMessage, UIMessageChunk } from "ai";

import { buildSystemPrompt } from "./prompts";
import {
  isFallbackWorthyError,
  resolveChatModel,
  resolveProviderChain,
  type ChatProviderName,
} from "./providers";
import { buildAiTools } from "./tools";
import type { AiToolContext } from "./tools/context";

/**
 * Batas langkah agent. DeepSeek V4 Flash cenderung sangat sering memanggil tool,
 * jadi pagar ini menjaga latensi dan biaya tetap masuk akal untuk chat mobile.
 *
 * Dinaikkan dari 8 ke 10 saat `suggestFollowUps` ditambahkan: saran lanjutan
 * memakai satu langkah tersendiri di akhir, dan tanpa ruang tambahan ia akan
 * memakan jatah langkah yang seharusnya dipakai mengambil data.
 */
const MAX_STEPS = 10;

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
  readonly messages: UIMessage[];
  readonly toolContext: AiToolContext;
  readonly userName: string;
  readonly conversationId: string;
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

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
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
        const provider = providers[index];
        const isLastProvider = index === providers.length - 1;

        // Chunk pembuka ditahan sampai model terbukti merespons, supaya
        // percobaan yang gagal tidak meninggalkan jejak di layar pengguna.
        const buffered: UIMessageChunk[] = [];
        let modelHasResponded = false;

        try {
          const result = streamText({
            model: resolveChatModel(provider),
            system: buildSystemPrompt(provider, input.userName, input.toolContext),
            messages: await convertToModelMessages(input.messages),
            tools: buildAiTools(input.toolContext),
            stopWhen: stepCountIs(MAX_STEPS),
          });

          const uiStream = result.toUIMessageStream({
            originalMessages: input.messages,
            onEnd: async ({ responseMessage }) => {
              const usage = await result.usage;
              await input.onAssistantMessage({
                message: responseMessage,
                provider,
                inputTokens: usage?.inputTokens,
                outputTokens: usage?.outputTokens,
              });
            },
          });

          for await (const chunk of uiStream) {
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

          return;
        } catch (error) {
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
    onError: (error) => {
      console.error("AI chat stream gagal:", error);
      return "Maaf, asisten sedang tidak bisa menjawab. Coba lagi sebentar lagi.";
    },
  });

  return { stream };
}
