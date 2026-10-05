import { isFallbackWorthyError } from "@backend/lib/ai/providers";
import { describe, expect, it } from "bun:test";

describe("klasifikasi kegagalan penyedia AI", () => {
  it("berpindah ke penyedia cadangan saat kredit habis atau kena rate limit", () => {
    expect(isFallbackWorthyError({ statusCode: 402 })).toBe(true);
    expect(isFallbackWorthyError({ statusCode: 429 })).toBe(true);
  });

  it("berpindah saat otentikasi ditolak, karena API key bisa saja dicabut", () => {
    expect(isFallbackWorthyError({ statusCode: 401 })).toBe(true);
    expect(isFallbackWorthyError({ statusCode: 403 })).toBe(true);
  });

  it("berpindah saat penyedia mengalami gangguan sisi server", () => {
    expect(isFallbackWorthyError({ statusCode: 500 })).toBe(true);
    expect(isFallbackWorthyError({ status: 503 })).toBe(true);
  });

  it("tidak berpindah saat kesalahan berasal dari input kita sendiri", () => {
    // Penyedia lain akan menolak permintaan yang sama, jadi mencoba ulang hanya
    // membuang waktu dan menunda pesan kesalahan ke pengguna.
    expect(isFallbackWorthyError({ statusCode: 400 })).toBe(false);
    expect(isFallbackWorthyError({ statusCode: 404 })).toBe(false);
    expect(isFallbackWorthyError({ statusCode: 422 })).toBe(false);
  });

  it("berpindah saat kegagalan jaringan tidak membawa kode status", () => {
    expect(isFallbackWorthyError(new Error("fetch failed"))).toBe(true);
    expect(isFallbackWorthyError(null)).toBe(true);
  });
});

describe("konfigurasi dan resolusi rantai penyedia AI", () => {
  const originalEnv = { ...process.env };

  const restoreEnv = () => {
    process.env.NINEROUTER_API_KEY = originalEnv.NINEROUTER_API_KEY;
    process.env.NINEROUTER_BASE_URL = originalEnv.NINEROUTER_BASE_URL;
    process.env.NINEROUTER_MODEL_ID = originalEnv.NINEROUTER_MODEL_ID;
    process.env.NINEROUTER_REASONING_EFFORT = originalEnv.NINEROUTER_REASONING_EFFORT;
    process.env.DEEPSEEK_API_KEY = originalEnv.DEEPSEEK_API_KEY;
    process.env.GEMINI_API_KEY = originalEnv.GEMINI_API_KEY;
    process.env.OPENROUTER_API_KEY = originalEnv.OPENROUTER_API_KEY;
  };

  it("mengenali NINEROUTER sebagai terkonfigurasi jika NINEROUTER_API_KEY diset", async () => {
    const { isProviderConfigured } = await import("@backend/lib/ai/providers");
    process.env.NINEROUTER_API_KEY = "sk-9router-test";
    delete process.env.NINEROUTER_BASE_URL;

    expect(isProviderConfigured("NINEROUTER")).toBe(true);
    restoreEnv();
  });

  it("mengenali NINEROUTER sebagai terkonfigurasi jika NINEROUTER_BASE_URL diset", async () => {
    const { isProviderConfigured } = await import("@backend/lib/ai/providers");
    delete process.env.NINEROUTER_API_KEY;
    process.env.NINEROUTER_BASE_URL = "http://localhost:20128/v1";

    expect(isProviderConfigured("NINEROUTER")).toBe(true);
    restoreEnv();
  });

  it("mengenali NINEROUTER sebagai tidak terkonfigurasi jika key dan URL kosong", async () => {
    const { isProviderConfigured } = await import("@backend/lib/ai/providers");
    delete process.env.NINEROUTER_API_KEY;
    delete process.env.NINEROUTER_BASE_URL;

    expect(isProviderConfigured("NINEROUTER")).toBe(false);
    restoreEnv();
  });

  it("menempatkan NINEROUTER di posisi pertama sebelum DEEPSEEK lalu GEMINI pada rantai penyedia", async () => {
    const { resolveProviderChain } = await import("@backend/lib/ai/providers");
    process.env.NINEROUTER_API_KEY = "sk-9router-test";
    process.env.DEEPSEEK_API_KEY = "sk-deepseek-test";
    process.env.GEMINI_API_KEY = "aiza-gemini-test";
    delete process.env.OPENROUTER_API_KEY;

    const chain = resolveProviderChain();
    expect(chain).toEqual(["NINEROUTER", "DEEPSEEK", "GEMINI"]);
    restoreEnv();
  });

  it("melewati NINEROUTER jika tidak terkonfigurasi dan langsung ke DEEPSEEK lalu GEMINI", async () => {
    const { resolveProviderChain } = await import("@backend/lib/ai/providers");
    delete process.env.NINEROUTER_API_KEY;
    delete process.env.NINEROUTER_BASE_URL;
    process.env.DEEPSEEK_API_KEY = "sk-deepseek-test";
    process.env.GEMINI_API_KEY = "aiza-gemini-test";

    const chain = resolveProviderChain();
    expect(chain[0]).toBe("DEEPSEEK");
    expect(chain[1]).toBe("GEMINI");
    expect(chain).not.toContain("NINEROUTER");
    restoreEnv();
  });

  it("mengabaikan key placeholder seperti 9r_YOUR_API_KEY jika URL tidak diset", async () => {
    const { isProviderConfigured } = await import("@backend/lib/ai/providers");
    process.env.NINEROUTER_API_KEY = "9r_YOUR_API_KEY";
    delete process.env.NINEROUTER_BASE_URL;

    expect(isProviderConfigured("NINEROUTER")).toBe(false);
    restoreEnv();
  });

  it("mengembalikan model dengan ID ag/gemini-3.8-flash-high untuk NINEROUTER secara default", async () => {
    const { resolveChatModel } = await import("@backend/lib/ai/providers");
    delete process.env.NINEROUTER_MODEL_ID;

    const model = resolveChatModel("NINEROUTER") as { modelId?: string };
    expect(model.modelId).toBe("ag/gemini-3.8-flash-high");
    restoreEnv();
  });

  it("menormalkan alias chatgpt-5.6-luna ke cx/gpt-5.6-luna secara otomatis", async () => {
    const { resolveChatModel } = await import("@backend/lib/ai/providers");
    process.env.NINEROUTER_MODEL_ID = "chatgpt-5.6-luna";

    const model = resolveChatModel("NINEROUTER") as { modelId?: string };
    expect(model.modelId).toBe("cx/gpt-5.6-luna");
    restoreEnv();
  });

  it("menormalkan alias 3.7 flash medium ke ag/gemini-3.7-flash-medium secara otomatis", async () => {
    const { resolveChatModel } = await import("@backend/lib/ai/providers");
    process.env.NINEROUTER_MODEL_ID = "3.7 flash medium";

    const model = resolveChatModel("NINEROUTER") as { modelId?: string };
    expect(model.modelId).toBe("ag/gemini-3.7-flash-medium");
    restoreEnv();
  });

  it("menormalkan alias 3.8 flash dan variasinya ke model 3.8 yang valid di 9Router", async () => {
    const { resolveChatModel } = await import("@backend/lib/ai/providers");

    process.env.NINEROUTER_MODEL_ID = "3.8 flash";
    let model = resolveChatModel("NINEROUTER") as { modelId?: string };
    expect(model.modelId).toBe("ag/gemini-3.8-flash-high");

    process.env.NINEROUTER_MODEL_ID = "gemini-3.8-flash-high";
    model = resolveChatModel("NINEROUTER") as { modelId?: string };
    expect(model.modelId).toBe("ag/gemini-3.8-flash-high");

    process.env.NINEROUTER_MODEL_ID = "3.8 flash medium";
    model = resolveChatModel("NINEROUTER") as { modelId?: string };
    expect(model.modelId).toBe("ag/gemini-3.8-flash-medium");

    process.env.NINEROUTER_MODEL_ID = "gemini-3.8-flash-low";
    model = resolveChatModel("NINEROUTER") as { modelId?: string };
    expect(model.modelId).toBe("ag/gemini-3.8-flash-low");

    restoreEnv();
  });

  it("menggunakan NINEROUTER_MODEL_ID jika disesuaikan melalui environment variable", async () => {
    const { resolveChatModel } = await import("@backend/lib/ai/providers");
    process.env.NINEROUTER_MODEL_ID = "custom/model-x";

    const model = resolveChatModel("NINEROUTER") as { modelId?: string };
    expect(model.modelId).toBe("custom/model-x");
    restoreEnv();
  });

  it("menganggap error gateway/proxy model_not_found dan credentials sebagai layak fallback", async () => {
    const { isFallbackWorthyError } = await import("@backend/lib/ai/providers");

    expect(isFallbackWorthyError({ statusCode: 404 })).toBe(false);
    expect(isFallbackWorthyError({ statusCode: 404, message: "model_not_found" })).toBe(true);
    expect(
      isFallbackWorthyError({
        statusCode: 400,
        message:
          '{"code":"model_not_found","message":"No active credentials for provider: openai"}',
      }),
    ).toBe(true);
  });
});
