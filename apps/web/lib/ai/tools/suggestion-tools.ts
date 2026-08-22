import "server-only";

import { tool } from "ai";
import { z } from "zod";

/**
 * Tool saran pertanyaan lanjutan.
 *
 * Tidak menyentuh database sama sekali — ia hanya memvalidasi dan merapikan
 * saran yang disusun model, lalu mengembalikannya agar antarmuka bisa
 * menampilkannya sebagai chip yang bisa ditekan.
 *
 * Dibuat sebagai tool, bukan diminta lewat teks, karena saran harus berupa data
 * terstruktur agar bisa jadi tombol. Meminta model menuliskannya di dalam
 * kalimat akan memaksa antarmuka mengurai teks bebas, dan itu selalu rapuh.
 */

const MAX_SUGGESTIONS = 3;
const MAX_LENGTH = 100;

export const FOLLOW_UP_TOOL_DESCRIPTION =
  "Offer one to three concise, contextual follow-up questions after the answer is complete. Aim for two: one useful drill-down and one concrete next action. Use up to three only when each path is genuinely distinct, and return only one when no second question would be useful. Never call this before the data tools. After this tool returns, do not emit any more user-facing text because the UI renders the chips automatically.";

export const FOLLOW_UP_QUESTIONS_DESCRIPTION =
  "Short follow-up questions in Bahasa Indonesia, written from the user's point of view. Every question must be a direct continuation of a concrete entity, risk, finding, or next action in the answer; be answerable by the available tools and current role. Do not repeat what was already answered or use generic filler questions. Never introduce a new topic merely to reach the target count; return one question instead.";

export const FOLLOW_UP_COMPLETION_INSTRUCTION =
  "Follow-up chips are rendered automatically. If the answer already exists, do not repeat it or add a closing sentence. If no answer exists yet, provide the concise answer now without calling suggestFollowUps again.";

export const followUpInputSchema = z.object({
  questions: z
    .array(z.string().min(8).max(MAX_LENGTH))
    .min(1)
    .max(MAX_SUGGESTIONS)
    .describe(FOLLOW_UP_QUESTIONS_DESCRIPTION),
});

// Tidak menerima konteks sesi: tool ini tidak menyentuh data apa pun.
export function buildSuggestionTools() {
  return {
    suggestFollowUps: tool({
      description: FOLLOW_UP_TOOL_DESCRIPTION,
      inputSchema: followUpInputSchema,
      toModelOutput: () => ({
        type: "content" as const,
        value: [{ type: "text" as const, text: FOLLOW_UP_COMPLETION_INSTRUCTION }],
      }),
      execute: async ({ questions }) => {
        // Duplikat dibuang: model kadang mengusulkan dua kalimat yang sama
        // dengan susunan kata berbeda tipis.
        const seen = new Set<string>();
        const cleaned: string[] = [];

        for (const question of questions) {
          const normalized = question.replace(/\s+/g, " ").trim();
          const key = normalized.toLowerCase();
          if (normalized.length === 0 || seen.has(key)) continue;
          seen.add(key);
          cleaned.push(normalized);
        }

        return {
          questions: cleaned.slice(0, MAX_SUGGESTIONS),
          instruction: FOLLOW_UP_COMPLETION_INSTRUCTION,
        };
      },
    }),
  };
}
