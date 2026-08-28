import "server-only";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

/**
 * Penyedia model untuk AI chat agent.
 *
 * Ox Alpha via OpenRouter adalah model utama selama masih gratis (preview $0/$0);
 * API-nya kompatibel dengan format OpenAI. Ketika masa gratis berakhir, hapus
 * OPENROUTER_API_KEY dari environment agar chain otomatis melewati penyedia ini —
 * error 402/429 dari OpenRouter juga sudah ditangani fallback runtime ke DeepSeek.
 *
 * DeepSeek V4 Flash adalah cadangan pertama karena murah, mendukung tool calling
 * penuh, dan API-nya kompatibel dengan format OpenAI. Gemini 3.7 Flash dipakai
 * sebagai cadangan terakhir ketika kredit DeepSeek habis atau layanannya bermasalah.
 */
export type ChatProviderName = "OPENROUTER" | "DEEPSEEK" | "GEMINI";

const OPENROUTER_MODEL_ID = "stealth/ox-alpha";
const DEEPSEEK_MODEL_ID = "deepseek-v4-flash";
const GEMINI_MODEL_ID = "gemini-3.7-flash";

const openrouter = createOpenAICompatible({
  name: "openrouter",
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
});

const deepseek = createOpenAICompatible({
  name: "deepseek",
  baseURL: "https://api.deepseek.com/v1",
  apiKey: process.env.DEEPSEEK_API_KEY ?? "",
});

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY ?? "",
});

function getProviderApiKey(provider: ChatProviderName): string | undefined {
  if (provider === "OPENROUTER") {
    return process.env.OPENROUTER_API_KEY;
  }
  return provider === "DEEPSEEK" ? process.env.DEEPSEEK_API_KEY : process.env.GEMINI_API_KEY;
}

export function isProviderConfigured(provider: ChatProviderName): boolean {
  const key = getProviderApiKey(provider);
  return typeof key === "string" && key.length > 0;
}

export function resolveChatModel(provider: ChatProviderName): LanguageModel {
  if (provider === "OPENROUTER") {
    return openrouter(OPENROUTER_MODEL_ID);
  }
  return provider === "DEEPSEEK" ? deepseek(DEEPSEEK_MODEL_ID) : google(GEMINI_MODEL_ID);
}

/**
 * Urutan percobaan penyedia: Ox Alpha via OpenRouter dulu selama masih gratis,
 * lalu DeepSeek, lalu Gemini.
 * Penyedia yang API key-nya belum diset dilewati supaya tidak membuang satu percobaan.
 */
export function resolveProviderChain(): ChatProviderName[] {
  return (["OPENROUTER", "DEEPSEEK", "GEMINI"] as const).filter(isProviderConfigured);
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
