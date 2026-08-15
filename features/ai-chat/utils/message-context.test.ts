import { collectProjectNames, readToolProjectId } from "@/features/ai-chat/utils/message-context";
import type { UIMessage } from "ai";
import { describe, expect, it } from "bun:test";

function message(parts: unknown[]): UIMessage {
  return { id: "m1", role: "assistant", parts } as unknown as UIMessage;
}

describe("pemulihan nama proyek dari satu balasan", () => {
  it("memungut nama dari keluaran listProjects", () => {
    const names = collectProjectNames(
      message([
        {
          type: "tool-listProjects",
          state: "output-available",
          output: {
            projects: [
              { projectId: "p1", name: "Menteng Villa" },
              { projectId: "p2", name: "Sudirman Suites" },
            ],
          },
        },
      ]),
    );

    expect(names).toEqual({ p1: "Menteng Villa", p2: "Sudirman Suites" });
  });

  it("mengabaikan tool lain dan keluaran yang bentuknya tidak cocok", () => {
    const names = collectProjectNames(
      message([
        { type: "tool-getProjectBudget", state: "output-available", output: { categories: [] } },
        { type: "tool-listProjects", state: "output-available", output: { error: "ditolak" } },
        { type: "text", text: "halo" },
      ]),
    );

    expect(names).toEqual({});
  });

  it("membaca id proyek dari argumen tool, bukan hanya dari keluarannya", () => {
    // Ini yang memulihkan identitas kartu untuk pesan lama: keluarannya belum
    // menyimpan projectId, tetapi argumen yang dikirim model selalu tersimpan.
    expect(readToolProjectId({ type: "tool-getProjectBudget", input: { projectId: "p9" } })).toBe(
      "p9",
    );
  });

  it("mengembalikan undefined ketika argumen tidak memuat id proyek", () => {
    expect(readToolProjectId({ type: "tool-getBankBalances", input: {} })).toBeUndefined();
    expect(readToolProjectId({ type: "text", text: "halo" })).toBeUndefined();
    expect(readToolProjectId(null)).toBeUndefined();
  });
});
