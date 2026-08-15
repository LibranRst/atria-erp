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
const MAX_LENGTH = 80;

// Tidak menerima konteks sesi: tool ini tidak menyentuh data apa pun.
export function buildSuggestionTools() {
  return {
    suggestFollowUps: tool({
      description:
        "Offer up to three short follow-up questions the user is likely to ask next, based on what was just answered. Call this once, as the very last step, after the answer is complete. Never call it before the data tools.",
      inputSchema: z.object({
        questions: z
          .array(z.string().min(8).max(MAX_LENGTH))
          .min(1)
          .max(MAX_SUGGESTIONS)
          .describe(
            "Short follow-up questions in Bahasa Indonesia, written from the user's point of view, each answerable by the available tools.",
          ),
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

        return { questions: cleaned.slice(0, MAX_SUGGESTIONS) };
      },
    }),
  };
}
