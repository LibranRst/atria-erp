import {
  FOLLOW_UP_QUESTIONS_DESCRIPTION,
  FOLLOW_UP_COMPLETION_INSTRUCTION,
  FOLLOW_UP_TOOL_DESCRIPTION,
  followUpInputSchema,
} from "@/lib/ai/tools/suggestion-tools";
import { describe, expect, it } from "bun:test";

describe("suggestFollowUps contract", () => {
  it("menargetkan dua pertanyaan tetapi mengizinkan satu yang benar-benar relevan", () => {
    expect(FOLLOW_UP_TOOL_DESCRIPTION).toContain("Aim for two");
    expect(FOLLOW_UP_TOOL_DESCRIPTION).toContain("return only one");
    expect(FOLLOW_UP_TOOL_DESCRIPTION).toContain("up to three");
    expect(FOLLOW_UP_TOOL_DESCRIPTION).toContain("do not emit any more user-facing text");
    expect(FOLLOW_UP_COMPLETION_INSTRUCTION).toContain("If the answer already exists");
    expect(FOLLOW_UP_COMPLETION_INSTRUCTION).toContain("If no answer exists yet");
  });

  it("mewajibkan grounding, actionability, dan hak akses", () => {
    expect(FOLLOW_UP_QUESTIONS_DESCRIPTION).toContain("concrete entity, risk, finding");
    expect(FOLLOW_UP_QUESTIONS_DESCRIPTION).toContain("available tools");
    expect(FOLLOW_UP_QUESTIONS_DESCRIPTION).toContain("current role");
    expect(FOLLOW_UP_QUESTIONS_DESCRIPTION).toContain("Do not repeat");
    expect(FOLLOW_UP_QUESTIONS_DESCRIPTION).toContain("generic");
    expect(FOLLOW_UP_QUESTIONS_DESCRIPTION).toContain("Never introduce a new topic");
  });

  it("mempertahankan schema satu sampai tiga chip", () => {
    expect(
      followUpInputSchema.safeParse({ questions: ["Cek risiko proyek Menteng"] }).success,
    ).toBe(true);
    expect(
      followUpInputSchema.safeParse({
        questions: [
          "Cek risiko proyek Menteng",
          "Tinjau sisa budget Material",
          "Lihat tagihan vendor terdekat",
        ],
      }).success,
    ).toBe(true);
    expect(followUpInputSchema.safeParse({ questions: [] }).success).toBe(false);
    expect(
      followUpInputSchema.safeParse({
        questions: [
          "Cek risiko proyek Menteng",
          "Tinjau sisa budget Material",
          "Lihat tagihan vendor terdekat",
          "Periksa saldo rekening perusahaan",
        ],
      }).success,
    ).toBe(false);
  });

  it("menerima pertanyaan kontekstual di atas 80 karakter tetapi menolak lebih dari 100", () => {
    const contextual =
      "Tinjau pengeluaran Material Proyek Menteng yang paling menekan sisa budget bulan ini";
    const tooLong = `${contextual} sebelum keputusan pembelian material berikutnya disetujui Owner`;

    expect(contextual.length).toBeGreaterThan(80);
    expect(contextual.length).toBeLessThanOrEqual(100);
    expect(followUpInputSchema.safeParse({ questions: [contextual] }).success).toBe(true);
    expect(tooLong.length).toBeGreaterThan(100);
    expect(followUpInputSchema.safeParse({ questions: [tooLong] }).success).toBe(false);
  });
});
