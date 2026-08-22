import { shouldStopAfterFinalFollowUps } from "@/lib/ai/chat-stop-conditions";
import { describe, expect, it } from "bun:test";

describe("shouldStopAfterFinalFollowUps", () => {
  it("berhenti ketika follow-up dipanggil setelah jawaban tersedia", () => {
    expect(
      shouldStopAfterFinalFollowUps([
        { text: "Jawaban ringkas.", toolCalls: [] },
        { text: "", toolCalls: [{ toolName: "suggestFollowUps" }] },
      ]),
    ).toBe(true);
  });

  it("tidak berhenti jika follow-up dipanggil sebelum jawaban", () => {
    expect(
      shouldStopAfterFinalFollowUps([{ text: "", toolCalls: [{ toolName: "suggestFollowUps" }] }]),
    ).toBe(false);
  });

  it("tidak berhenti untuk tool biasa", () => {
    expect(
      shouldStopAfterFinalFollowUps([
        { text: "", toolCalls: [{ toolName: "getBankBalances" }] },
        { text: "Saldo tersedia.", toolCalls: [] },
      ]),
    ).toBe(false);
  });
});
