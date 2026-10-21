import { createUIMessageStream, type UIMessage, type UIMessageChunk } from "ai";
import type { OwnProfileSnapshot } from "@atria/core/ai/own-profile";

export function isOwnProfileNameQuestion(text: string): boolean {
  return (
    /\b(siapa|apa|cek|baca|periksa|tampilkan)\b[^.!?\n]*\bnama\b/i.test(text) &&
    !/\b(saldo|stok|budget|rab|rap|proyek|rekening|tagihan|berkas|lampiran|bagaimana|cara|dan|serta|lalu|kemudian|klien|vendor|peran|role|izin|akses|email|password)\b/i.test(
      text,
    )
  );
}

/** A direct factual lookup publishes the actual owned row, with no model inference. */
export function profileFactStream(input: {
  readonly profile: OwnProfileSnapshot;
  readonly conversationId: string;
  readonly messages: UIMessage[];
  readonly save: (message: UIMessage) => Promise<void>;
}): ReadableStream<UIMessageChunk> {
  const messageId = crypto.randomUUID(),
    callId = crypto.randomUUID(),
    textId = crypto.randomUUID();
  const name = input.profile.name.replace(/[\\`*_{}[\]<>()#+.!|-]/g, "\\$&");
  return createUIMessageStream({
    originalMessages: input.messages,
    execute: ({ writer }): void => {
      writer.write({
        type: "data-conversation",
        data: { conversationId: input.conversationId },
        transient: true,
      });
      writer.write({ type: "start", messageId });
      writer.write({ type: "start-step" });
      writer.write({
        type: "tool-input-available",
        toolCallId: callId,
        toolName: "getOwnProfileContext",
        input: { offset: 0 },
      });
      writer.write({
        type: "tool-output-available",
        toolCallId: callId,
        output: {
          profile: input.profile,
          snapshotOnly: true,
          instruction:
            "Nama/foto akun sesi dibaca langsung dari database. Pilihan lampiran tidak dimuat pada pembacaan ini.",
        },
      });
      writer.write({ type: "text-start", id: textId });
      writer.write({
        type: "text-delta",
        id: textId,
        delta: `Nama profil Anda saat ini adalah **${name}**. Tidak ada perubahan yang disimpan.`,
      });
      writer.write({ type: "text-end", id: textId });
      writer.write({ type: "finish-step" });
      writer.write({ type: "finish", finishReason: "stop" });
    },
    onEnd: async ({ responseMessage, isAborted }): Promise<void> => {
      if (!isAborted) await input.save(responseMessage);
    },
    onError: (): string => "Profil terbaru belum dapat ditampilkan. Coba lagi.",
  });
}
