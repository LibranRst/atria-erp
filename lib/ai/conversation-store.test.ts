import { buildTitle, extractText } from "@/lib/ai/conversation-store";
import type { UIMessage } from "ai";
import { describe, expect, it } from "bun:test";

describe("judul percakapan AI", () => {
  it("memakai pesan pertama apa adanya bila cukup pendek", () => {
    expect(buildTitle("Budget material proyek Melati sisa berapa?")).toBe(
      "Budget material proyek Melati sisa berapa?",
    );
  });

  it("merapikan spasi berlebih", () => {
    expect(buildTitle("  Sisa   budget\nproyek  ")).toBe("Sisa budget proyek");
  });

  it("memotong pada batas kata, bukan di tengah kata", () => {
    const long =
      "Tolong jelaskan kondisi keuangan seluruh proyek aktif beserta kategori yang sudah melewati batas anggaran";
    const title = buildTitle(long);

    expect(title.length).toBeLessThanOrEqual(81);
    expect(title.endsWith("…")).toBe(true);
    // Kata terakhir sebelum elipsis harus utuh.
    expect(long.startsWith(title.slice(0, -1))).toBe(true);
    expect(title.slice(0, -1).endsWith(" ")).toBe(false);
  });

  it("memberi judul cadangan saat teks kosong", () => {
    expect(buildTitle("   ")).toBe("Percakapan baru");
  });
});

describe("ekstraksi teks pesan", () => {
  it("menggabungkan hanya bagian teks dan mengabaikan jejak tool", () => {
    const message = {
      id: "m1",
      role: "assistant",
      parts: [
        { type: "text", text: "Budget material" },
        { type: "tool-getProjectBudget", state: "output-available", output: {} },
        { type: "text", text: "sisa 20 persen." },
      ],
    } as unknown as UIMessage;

    expect(extractText(message)).toBe("Budget material sisa 20 persen.");
  });
});
