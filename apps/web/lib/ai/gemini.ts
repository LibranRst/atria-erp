import { GoogleGenAI } from "@google/genai";

// Menggunakan API Key dari environment variable GEMINI_API_KEY
// Fallback ke string kosong untuk menghindari throw error saat build time jika API key belum diset
//
// Dinamai `geminiClient` (bukan `ai`) agar tidak rancu dengan paket `ai` (Vercel AI SDK)
// yang dipakai oleh AI chat agent di lib/ai/providers.ts.
export const geminiClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

/**
 * Model Gemini untuk OCR nota (multimodal).
 * Disatukan di sini supaya pembaruan versi model cukup dilakukan di satu tempat.
 */
export const GEMINI_OCR_MODEL = "gemini-3.7-flash";
