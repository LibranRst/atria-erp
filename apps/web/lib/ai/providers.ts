import "server-only";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

/**
 * Penyedia model untuk AI chat agent.
 *
 * DeepSeek V4 Flash adalah model utama karena murah, mendukung tool calling penuh,
 * dan API-nya kompatibel dengan format OpenAI. Gemini 3.7 Flash dipakai sebagai
 * cadangan ketika kredit DeepSeek habis atau layanannya bermasalah.
 */
export type ChatProviderName = "DEEPSEEK" | "GEMINI";

const DEEPSEEK_MODEL_ID = "deepseek-v4-flash";
const GEMINI_MODEL_ID = "gemini-3.7-flash";

const deepseek = createOpenAICompatible({
  name: "deepseek",
  baseURL: "https://api.deepseek.com/v1",
  apiKey: process.env.DEEPSEEK_API_KEY ?? "",
});

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY ?? "",
});

export function isProviderConfigured(provider: ChatProviderName): boolean {
  const key = provider === "DEEPSEEK" ? process.env.DEEPSEEK_API_KEY : process.env.GEMINI_API_KEY;
  return typeof key === "string" && key.length > 0;
}

export function resolveChatModel(provider: ChatProviderName): LanguageModel {
  return provider === "DEEPSEEK" ? deepseek(DEEPSEEK_MODEL_ID) : google(GEMINI_MODEL_ID);
}

/**
 * Urutan percobaan penyedia: DeepSeek dulu, lalu Gemini.
 * Penyedia yang API key-nya belum diset dilewati supaya tidak membuang satu percobaan.
 */
export function resolveProviderChain(): ChatProviderName[] {
  return (["DEEPSEEK", "GEMINI"] as const).filter(isProviderConfigured);
}

/**
 * Menentukan apakah sebuah kegagalan layak dicoba ulang ke penyedia cadangan.
 *
 * Yang layak: kredit habis, rate limit, otentikasi gagal, dan gangguan sisi server.
 * Yang tidak layak: kesalahan input kita sendiri (400), karena penyedia lain akan gagal serupa.
 */
export function isFallbackWorthyError(error: unknown): boolean {
  const status = extractStatusCode(error);
  if (status === null) {
    // Kegagalan jaringan atau kesalahan tak dikenal — masih layak dicoba ke penyedia lain.
    return true;
  }
  if (status === 401 || status === 402 || status === 403 || status === 429) {
    return true;
  }
  return status >= 500;
}

function extractStatusCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const candidate = error as { statusCode?: unknown; status?: unknown };
  if (typeof candidate.statusCode === "number") {
    return candidate.statusCode;
  }
  if (typeof candidate.status === "number") {
    return candidate.status;
  }
  return null;
}
