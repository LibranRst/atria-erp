import { buildSystemPrompt } from "@/lib/ai/prompts";
import type { AiToolContext } from "@/lib/ai/tools/context";
import { describe, expect, it } from "bun:test";

describe("buildSystemPrompt", () => {
  it("menyertakan daftar topik tidak tersedia untuk peran berlingkup proyek", () => {
    const context: AiToolContext = {
      userId: "00000000-0000-0000-0000-000000000001",
      roleName: "PROJECT_MANAGER",
    };
    const prompt = buildSystemPrompt("DEEPSEEK", "Siti Aminah", context);

    expect(prompt).toContain("Tool untuk topik berikut akan menolak peran ini");
    expect(prompt).toContain("saldo dan mutasi rekening bank perusahaan");
    expect(prompt).toContain("antrean persetujuan lintas seluruh proyek perusahaan");
  });

  it("tidak menyertakan pembatasan apa pun untuk peran berlingkup global", () => {
    const context: AiToolContext = {
      userId: "00000000-0000-0000-0000-000000000002",
      roleName: "OWNER",
    };
    const prompt = buildSystemPrompt("DEEPSEEK", "Ronald", context);

    expect(prompt).not.toContain("Tool untuk topik berikut akan menolak peran ini");
    expect(prompt).toContain("akses finansial global");
  });
});
