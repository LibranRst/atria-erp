import type { UIMessage } from "ai";
import { z } from "zod";
import type { ChatDraft } from "./workspace-session";

export function restorePendingMessages(
  messages: readonly UIMessage[],
  pending: ChatDraft["pending"],
): UIMessage[] {
  if (!pending || messages.some((message) => message.id === pending.id)) return [...messages];
  return [
    ...messages,
    {
      id: pending.id,
      role: "user",
      parts: [
        { type: "text", text: pending.text },
        ...pending.attachments.map((file) => ({
          type: "file" as const,
          url: file.url,
          mediaType: file.mimeType,
          filename: file.fileName,
        })),
      ],
    },
  ];
}

export function chatFailureMessage(error: Error, offline: boolean): string {
  if (
    offline ||
    /failed to fetch|networkerror|load failed|network request failed/i.test(error.message)
  )
    return "Koneksi terputus. Pertanyaan tetap tersedia. Sambungkan kembali lalu coba lagi.";
  try {
    const payload = z.object({ error: z.string() }).safeParse(JSON.parse(error.message));
    if (payload.success) return payload.data.error;
  } catch {
    /* Plain stream errors already contain the public message. */
  }
  return error.message || "Asisten belum dapat menjawab. Coba lagi.";
}

export function unansweredTurn(messages: readonly UIMessage[]): UIMessage | null {
  const index = messages.findLastIndex((message) => message.role === "user");
  if (index < 0) return null;
  const answered = messages
    .slice(index + 1)
    .some((message) =>
      message.parts.some(
        (part) =>
          (part.type === "text" && part.text.trim().length > 0) ||
          ("state" in part && part.state === "output-available"),
      ),
    );
  return answered ? null : messages[index];
}
