import type { UIMessage } from "ai";

import { toolNameFromPartType } from "./tool-labels";

/** Fase kerja yang ditampilkan pada slot calon jawaban asisten. */
export type ReplyPhase = "analyzing" | "fetching" | "composing";

export const REPLY_PHASE_LABEL: Record<ReplyPhase, string> = {
  analyzing: "Menganalisis…",
  fetching: "Mengambil data…",
  composing: "Menyusun jawaban…",
};

/** Keadaan tool yang belum menghasilkan apa pun. */
const PENDING_TOOL_STATES = new Set(["input-streaming", "input-available"]);

function partState(part: unknown): string | undefined {
  if (typeof part !== "object" || part === null) return undefined;
  const state = (part as { state?: unknown }).state;
  return typeof state === "string" ? state : undefined;
}

/** Benar selama masih ada tool yang dipanggil tetapi belum mengembalikan hasil. */
export function hasPendingTool(message: UIMessage): boolean {
  return message.parts.some((part) => {
    if (!toolNameFromPartType(part.type)) return false;
    const state = partState(part);
    return state !== undefined && PENDING_TOOL_STATES.has(state);
  });
}

/** Benar begitu isi gelembung asisten yang bermakna sudah mulai terlihat. */
function hasVisibleText(message: UIMessage): boolean {
  return message.parts.some((part) => part.type === "text" && part.text.trim().length > 0);
}

function hasAnyTool(message: UIMessage): boolean {
  return message.parts.some((part) => Boolean(toolNameFromPartType(part.type)));
}

/**
 * Fase sumber untuk indicator sementara di dalam transcript.
 *
 * Teks terlihat diperiksa sebelum tool yang masih berjalan. Text part lama tetap
 * berada di pesan ketika model memanggil tool berikutnya, sehingga setelah bubble
 * lahir status terkunci pada "Menyusun jawaban…" sampai seluruh giliran selesai.
 * Jejak tool tetap menjelaskan pengambilan data lanjutan di dalam transcript.
 */
export function deriveStatusPhase(message: UIMessage | null, isBusy: boolean): ReplyPhase | null {
  if (!isBusy) return null;
  if (!message) return "analyzing";

  if (hasVisibleText(message)) return "composing";
  if (hasPendingTool(message)) return "fetching";
  if (hasAnyTool(message)) return "composing";

  return "analyzing";
}
