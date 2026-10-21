import { runChatStream } from "@backend/lib/ai/chat-stream";
import { describe, expect, it } from "bun:test";

describe("runChatStream", () => {
  it("melempar error jika tidak ada penyedia yang dikonfigurasi", async () => {
    const originalEnv = { ...process.env };
    delete process.env.NINEROUTER_API_KEY;
    delete process.env.NINEROUTER_BASE_URL;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    const streamResult = runChatStream({
      messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "halo" }] }],
      toolContext: {
        userId: "00000000-0000-0000-0000-000000000001",
        roleName: "Owner",
        roleId: "00000000-0000-0000-0000-000000000001",
        permissions: ["use:ai_chat"],
        dataScope: "GLOBAL",
      },
      userName: "Test User",
      conversationId: "test-conv-id",
      preference: { responseStyle: "STANDARD", primaryFocus: "AUTO", customNote: null },
      companyName: "Dekoria",
      onAssistantMessage: async () => {},
    });

    const reader = streamResult.stream.getReader();
    const chunks: unknown[] = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    } catch {
      // stream error ditangkap di reader
    } finally {
      process.env.NINEROUTER_API_KEY = originalEnv.NINEROUTER_API_KEY;
      process.env.NINEROUTER_BASE_URL = originalEnv.NINEROUTER_BASE_URL;
      process.env.DEEPSEEK_API_KEY = originalEnv.DEEPSEEK_API_KEY;
      process.env.GEMINI_API_KEY = originalEnv.GEMINI_API_KEY;
      process.env.OPENROUTER_API_KEY = originalEnv.OPENROUTER_API_KEY;
    }

    // Saat penyedia kosong, stream menghasilkan chunk error dari onError handler
    expect(chunks.some((c) => (c as { type: string }).type === "error")).toBe(true);
    expect(
      chunks.some(
        (c) =>
          (c as { errorText?: string }).errorText ===
          "Maaf, asisten sedang tidak bisa menjawab. Coba lagi sebentar lagi.",
      ),
    ).toBe(true);
  });
});
