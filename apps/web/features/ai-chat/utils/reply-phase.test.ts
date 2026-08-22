import { describe, expect, test } from "bun:test";
import type { UIMessage } from "ai";

import { deriveStatusPhase, hasPendingTool } from "./reply-phase";

function assistant(parts: unknown[]): UIMessage {
  return { id: "m1", role: "assistant", parts } as unknown as UIMessage;
}

const toolPart = (state: string) => ({
  type: "tool-getBankBalances" as const,
  toolCallId: "call-1",
  state,
});

const textPart = (state: string, text = "Halo") => ({ type: "text" as const, text, state });

describe("deriveStatusPhase", () => {
  test("diam ketika balasan tidak lagi berjalan", () => {
    expect(deriveStatusPhase(assistant([textPart("done")]), false)).toBeNull();
  });

  test("menganalisis sebelum giliran asisten terbentuk", () => {
    expect(deriveStatusPhase(null, true)).toBe("analyzing");
  });

  test("menganalisis ketika pesan asisten belum menghasilkan apa pun", () => {
    expect(deriveStatusPhase(assistant([]), true)).toBe("analyzing");
  });

  test("mengambil data selama tool belum mengembalikan hasil", () => {
    expect(deriveStatusPhase(assistant([toolPart("input-streaming")]), true)).toBe("fetching");
    expect(deriveStatusPhase(assistant([toolPart("input-available")]), true)).toBe("fetching");
  });

  test("menyusun jawaban setelah tool selesai atau gagal", () => {
    expect(deriveStatusPhase(assistant([toolPart("output-available")]), true)).toBe("composing");
    expect(deriveStatusPhase(assistant([toolPart("output-error")]), true)).toBe("composing");
  });

  test("menyusun jawaban saat teks terlihat, baik masih streaming maupun selesai", () => {
    expect(deriveStatusPhase(assistant([textPart("streaming", "Total")]), true)).toBe("composing");
    expect(deriveStatusPhase(assistant([textPart("done", "Total")]), true)).toBe("composing");
  });

  test("tetap menyusun setelah bubble muncul meski tool lain dipanggil", () => {
    const message = assistant([
      textPart("done", "Sebentar, saya cek lagi."),
      toolPart("input-available"),
    ]);

    expect(deriveStatusPhase(message, true)).toBe("composing");
  });

  test("tidak menganggap whitespace sebagai bubble yang terlihat", () => {
    const message = assistant([textPart("streaming", "\n  "), toolPart("input-available")]);

    expect(deriveStatusPhase(message, true)).toBe("fetching");
  });
});

describe("hasPendingTool", () => {
  test("membedakan tool yang masih berjalan dari yang sudah selesai", () => {
    expect(hasPendingTool(assistant([toolPart("input-available")]))).toBe(true);
    expect(hasPendingTool(assistant([toolPart("output-available")]))).toBe(false);
    expect(hasPendingTool(assistant([toolPart("output-error")]))).toBe(false);
  });

  test("mengabaikan bagian non-tool", () => {
    expect(hasPendingTool(assistant([textPart("streaming")]))).toBe(false);
  });
});
