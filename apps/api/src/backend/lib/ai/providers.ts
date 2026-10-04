import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { approvedChatProviders } from "./provider-policy";

/**
 * Penyedia model untuk AI chat agent.
 *
 * 9Router adalah model utama (kompatibel OpenAI); diarahkan ke endpoint 9Router
 * dengan model chatgpt 5.6 luna dan reasoning max.
 *
 * DeepSeek V4 Flash adalah cadangan pertama karena murah, mendukung tool calling
 * penuh, dan API-nya kompatibel dengan format OpenAI. Gemini 3.7 Flash dipakai
 * sebagai cadangan terakhir ketika kredit DeepSeek habis atau layanannya bermasalah.
 *
 * OpenRouter tetap didukung sebagai opsi cadangan jika dikonfigurasi.
 */
export type ChatProviderName = "NINEROUTER" | "OPENROUTER" | "DEEPSEEK" | "GEMINI";

const NINEROUTER_DEFAULT_BASE_URL = "http://localhost:20128/v1";
const NINEROUTER_DEFAULT_MODEL_ID = "ag/gemini-3.8-flash-high";
const NINEROUTER_DEFAULT_REASONING_EFFORT = "high";

export function normalizeNineRouterModel(rawModelId?: string): string {
  if (!rawModelId) {
    return NINEROUTER_DEFAULT_MODEL_ID;
  }
  const trimmed = rawModelId.trim();
  if (
    trimmed === "chatgpt-5.6-luna" ||
    trimmed === "gpt-5.6-luna" ||
    trimmed === "chatgpt 5.6 luna" ||
    trimmed === "5.6-luna"
  ) {
    return "cx/gpt-5.6-luna";
  }
  if (
    trimmed === "3.7-flash-medium" ||
    trimmed === "3.7 flash medium" ||
    trimmed === "gemini-3.7-flash-medium" ||
    trimmed === "gemini 3.7 flash medium"
  ) {
    return "ag/gemini-3.7-flash-medium";
  }
  if (
    trimmed === "3.8-flash-high" ||
    trimmed === "3.8 flash high" ||
    trimmed === "gemini-3.8-flash-high" ||
    trimmed === "gemini 3.8 flash high"
  ) {
    return "ag/gemini-3.8-flash-high";
  }
  if (
    trimmed === "3.8-flash-medium" ||
    trimmed === "3.8 flash medium" ||
    trimmed === "gemini-3.8-flash-medium" ||
    trimmed === "gemini 3.8 flash medium"
  ) {
    return "ag/gemini-3.8-flash-medium";
  }
  if (
    trimmed === "3.8-flash-low" ||
    trimmed === "3.8 flash low" ||
    trimmed === "gemini-3.8-flash-low" ||
    trimmed === "gemini 3.8 flash low"
  ) {
    return "ag/gemini-3.8-flash-low";
  }
  if (
    trimmed === "3.8-flash" ||
    trimmed === "3.8 flash" ||
    trimmed === "gemini-3.8-flash" ||
    trimmed === "gemini 3.8 flash"
  ) {
    return "ag/gemini-3.8-flash-high";
  }
  return trimmed;
}

const OPENROUTER_MODEL_ID = "stealth/ox-alpha";
const DEEPSEEK_MODEL_ID = "deepseek-v4-flash";
const GEMINI_MODEL_ID = "gemini-3.8-flash";

function isPlaceholderApiKey(key?: string): boolean {
  if (!key) return true;
  const trimmed = key.trim().toLowerCase();
  return (
    trimmed === "" ||
    trimmed.includes("your_api_key") ||
    trimmed.includes("your-api-key") ||
    trimmed.includes("your9routerapikeyhere") ||
    trimmed.includes("yourdeepseekapikeyhere") ||
    trimmed.includes("yourgeminiapikeyhere") ||
    trimmed.includes("youropenrouterapikeyhere") ||
    trimmed.startsWith("9r_your_api_key") ||
    trimmed.startsWith("sk-your")
  );
}

function readEnvFileFallback(keyName: string): string | undefined {
  /*
   * Cadangan ini hanya untuk proses Node/Bun mandiri (skrip CLI) yang tidak
   * melewati loader env Next. Di produksi ia dimatikan karena
   * `path.resolve(process.cwd(), …)` membuat penelusuran berkas fungsi
   * serverless menyeret seluruh isi repo ke dalam bundel, sementara Vercel
   * sudah menyuntikkan variabel lingkungan yang sama.
   */
  if (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "production") {
    return undefined;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("node:path") as typeof import("node:path");
    for (const file of [".env.local", ".env"]) {
      const filePath = path.resolve(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        const match = content.match(new RegExp(`^${keyName}=["']?(.*?)["']?$`, "m"));
        if (match?.[1]) {
          const candidate = match[1].trim();
          if (!isPlaceholderApiKey(candidate)) {
            return candidate;
          }
        }
      }
    }
  } catch {
    // Abaikan jika fs tidak bisa diakses
  }
  return undefined;
}

function getProviderApiKey(provider: ChatProviderName): string | undefined {
  let rawKey: string | undefined;
  if (provider === "NINEROUTER") {
    rawKey = process.env.NINEROUTER_API_KEY;
  } else if (provider === "OPENROUTER") {
    rawKey = process.env.OPENROUTER_API_KEY;
  } else if (provider === "DEEPSEEK") {
    rawKey = process.env.DEEPSEEK_API_KEY;
  } else {
    rawKey = process.env.GEMINI_API_KEY;
  }

  if (rawKey && !isPlaceholderApiKey(rawKey)) {
    return rawKey;
  }

  const envKeyName =
    provider === "NINEROUTER"
      ? "NINEROUTER_API_KEY"
      : provider === "OPENROUTER"
        ? "OPENROUTER_API_KEY"
        : provider === "DEEPSEEK"
          ? "DEEPSEEK_API_KEY"
          : "GEMINI_API_KEY";

  return readEnvFileFallback(envKeyName);
}

function getNineRouterClient() {
  const apiKey = getProviderApiKey("NINEROUTER") ?? "";
  return createOpenAICompatible({
    name: "9router",
    baseURL: process.env.NINEROUTER_BASE_URL || NINEROUTER_DEFAULT_BASE_URL,
    apiKey,
    transformRequestBody: (body) => ({
      ...body,
      reasoning_effort:
        process.env.NINEROUTER_REASONING_EFFORT || NINEROUTER_DEFAULT_REASONING_EFFORT,
    }),
  });
}

export function isProviderConfigured(provider: ChatProviderName): boolean {
  const key = getProviderApiKey(provider);
  const hasKey = typeof key === "string" && key.length > 0 && !isPlaceholderApiKey(key);
  if (provider === "NINEROUTER") {
    const url = process.env.NINEROUTER_BASE_URL;
    const hasCustomUrl = typeof url === "string" && url.length > 0;
    return hasKey || hasCustomUrl;
  }
  return hasKey;
}

export function resolveChatModel(provider: ChatProviderName): LanguageModel {
  if (provider === "NINEROUTER") {
    const modelId = normalizeNineRouterModel(process.env.NINEROUTER_MODEL_ID);
    return getNineRouterClient()(modelId);
  }
  if (provider === "OPENROUTER") {
    const apiKey = getProviderApiKey("OPENROUTER") ?? "";
    const openrouter = createOpenAICompatible({
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
    });
    return openrouter(OPENROUTER_MODEL_ID);
  }
  if (provider === "DEEPSEEK") {
    const apiKey = getProviderApiKey("DEEPSEEK") ?? "";
    const deepseek = createOpenAICompatible({
      name: "deepseek",
      baseURL: "https://api.deepseek.com/v1",
      apiKey,
    });
    return deepseek(DEEPSEEK_MODEL_ID);
  }
  const apiKey = getProviderApiKey("GEMINI") ?? "";
  const google = createGoogleGenerativeAI({
    apiKey,
  });
  return google(GEMINI_MODEL_ID);
}

/**
 * Urutan percobaan penyedia: 9Router dulu, lalu DeepSeek, lalu Gemini.
 * OpenRouter tetap didukung sebagai opsi cadangan jika dikonfigurasi.
 * Penyedia yang API key-nya belum diset dilewati supaya tidak membuang satu percobaan.
 */
export function resolveProviderChain(): ChatProviderName[] {
  return approvedChatProviders().filter(isProviderConfigured);
}

/**
 * Menentukan apakah sebuah kegagalan layak dicoba ulang ke penyedia cadangan.
 *
 * Yang layak: kredit habis, rate limit, otentikasi gagal, model tidak ditemukan di gateway/proxy,
 * dan gangguan sisi server.
 * Yang tidak layak: kesalahan skema input kita sendiri (400 murni tanpa indikasi gateway),
 * karena penyedia lain akan gagal serupa.
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
  if (status === 400 || status === 404) {
    const message = extractErrorMessage(error).toLowerCase();
    if (
      message.includes("model_not_found") ||
      message.includes("credentials") ||
      message.includes("provider") ||
      message.includes("quota")
    ) {
      return true;
    }
    return false;
  }
  return status >= 500;
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const candidate = error as { message?: unknown; responseBody?: unknown; data?: unknown };
    const parts: string[] = [];
    if (typeof candidate.message === "string") parts.push(candidate.message);
    if (typeof candidate.responseBody === "string") parts.push(candidate.responseBody);
    if (typeof candidate.data === "string") parts.push(candidate.data);
    return parts.join(" ");
  }
  return "";
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
