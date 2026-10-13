import { generateText, jsonSchema, Output, type UserModelMessage } from "ai";
import { resolveChatModel, resolveProviderChain, type ChatProviderName } from "./providers";
import { PDF_RENDER_LIMITS, renderPdfPages } from "./pdf-pages";

export type DocumentContentPart =
  string | { readonly inlineData: { readonly data: string; readonly mimeType: string } };

export interface DocumentContentRequest {
  readonly contents: readonly DocumentContentPart[];
  readonly config?: {
    readonly abortSignal?: AbortSignal;
    readonly responseMimeType?: "application/json";
    readonly responseJsonSchema?: Exclude<Parameters<typeof jsonSchema>[0], () => unknown>;
  };
}

export interface DocumentContentResponse {
  readonly text?: string;
  readonly usageMetadata?: { readonly totalTokenCount?: number };
  readonly modelVersion?: string;
}
export class DocumentContentError extends Error {
  constructor(readonly code: "TIMEOUT" | "UNAVAILABLE") {
    super(
      code === "TIMEOUT"
        ? "Permintaan AI dibatalkan atau melewati batas waktu."
        : "Penyedia AI gagal membaca dokumen. Coba lagi atau isi formulir secara manual.",
    );
    this.name = "DocumentContentError";
  }
}

/** Select an approved document provider without invoking a model. */
export function requireDocumentProvider(): ChatProviderName {
  const provider = resolveProviderChain()[0];
  if (!provider) {
    throw new Error("Tidak ada penyedia AI yang dikonfigurasi atau disetujui untuk dokumen.");
  }
  return provider;
}

function documentMessage(parts: readonly DocumentContentPart[]): UserModelMessage {
  const content: Exclude<UserModelMessage["content"], string> = [];
  for (const part of parts) {
    if (typeof part === "string") {
      content.push({ type: "text", text: part });
      continue;
    }
    const { data, mimeType } = part.inlineData;
    const bytes = Buffer.from(data, "base64");
    if (mimeType.startsWith("image/") || mimeType === "application/pdf") {
      content.push({
        type: "file",
        data: bytes,
        mediaType: mimeType,
        filename: mimeType === "application/pdf" ? "document.pdf" : "document-image",
      });
    } else {
      throw new Error("Format dokumen AI tidak didukung.");
    }
  }
  return { role: "user", content };
}

async function generateDocumentContent(
  input: DocumentContentRequest,
): Promise<DocumentContentResponse> {
  const provider = requireDocumentProvider();
  const model = resolveChatModel(provider);
  const signal = input.config?.abortSignal ?? AbortSignal.timeout(40_000);
  if (signal.aborted) throw new Error("Permintaan AI dibatalkan atau melewati batas waktu.");
  const schema = input.config?.responseJsonSchema;
  const wantsJson = Boolean(schema || input.config?.responseMimeType === "application/json");
  const output =
    schema && provider !== "NINEROUTER"
      ? Output.object({ schema: jsonSchema(schema) })
      : wantsJson
        ? Output.json()
        : undefined;
  const parts: DocumentContentPart[] = [];
  let attachmentBytes = 0;
  function accountBytes(size: number): void {
    attachmentBytes += size;
    if (attachmentBytes > PDF_RENDER_LIMITS.imageBytes) {
      throw new Error("Ukuran total dokumen AI terlalu besar. Gunakan dokumen yang lebih kecil.");
    }
  }
  for (const part of input.contents) {
    if (
      typeof part !== "string" &&
      part.inlineData.mimeType === "application/pdf" &&
      provider === "NINEROUTER"
    ) {
      // The selected gateway drops native PDF parts. Send complete locally
      // rendered page images instead; a renderer limit fails the whole draft.
      const rendered = await renderPdfPages(Buffer.from(part.inlineData.data, "base64"), signal);
      accountBytes(rendered.byteLength);
      parts.push(
        `Dokumen PDF memiliki ${rendered.total} halaman. Baca semua halaman secara berurutan.`,
      );
      for (const page of rendered.pages) {
        parts.push(`Halaman ${page.pageNumber} dari ${rendered.total}.`);
        parts.push({
          inlineData: {
            data: Buffer.from(page.bytes).toString("base64"),
            mimeType: page.mediaType,
          },
        });
      }
    } else {
      if (typeof part !== "string")
        accountBytes(Buffer.from(part.inlineData.data, "base64").byteLength);
      parts.push(part);
    }
  }
  if (signal.aborted) throw new Error("Permintaan AI dibatalkan atau melewati batas waktu.");
  if (wantsJson && provider === "NINEROUTER") {
    // The gateway's Antigravity translator does not forward response_format.
    // Make the JSON contract explicit; consumers still validate it with Zod.
    parts.push(
      "Kembalikan hanya JSON valid, tanpa pagar Markdown atau penjelasan tambahan." +
        (schema ? ` Gunakan schema berikut: ${JSON.stringify(schema)}` : ""),
    );
  }
  const messages = [documentMessage(parts)];

  try {
    const result = await generateText({
      model,
      messages,
      ...(output ? { output } : {}),
      abortSignal: signal,
      maxRetries: 0,
      maxOutputTokens: 8_192,
    });
    // Reading output triggers the SDK's structured JSON parser. Consumers retain
    // their domain Zod validation and existing draft-only result contracts.
    const text = output ? JSON.stringify(result.output) : result.text;
    if (typeof text !== "string" || text.length === 0) {
      throw new Error("Respons model kosong.");
    }
    return {
      text,
      usageMetadata: { totalTokenCount: result.usage.totalTokens ?? 0 },
      modelVersion: typeof model === "string" ? model : model.modelId,
    };
  } catch {
    // Provider exceptions can embed headers, prompts and document bytes. Do not
    // expose or retain them through an action error or an extraction log.
    throw new DocumentContentError(signal.aborted ? "TIMEOUT" : "UNAVAILABLE");
  }
}

/** A narrow shared document boundary; never chooses an unapproved fallback. */
export const documentModel = { models: { generateContent: generateDocumentContent } };
