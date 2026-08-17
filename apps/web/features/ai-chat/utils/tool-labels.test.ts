import {
  collapseTraces,
  toolLabel,
  toolNameFromPartType,
  toolTraceState,
} from "@/features/ai-chat/utils/tool-labels";
import { describe, expect, it } from "bun:test";

describe("nama tool dari part AI SDK", () => {
  it("mengambil nama tool dari awalan part", () => {
    expect(toolNameFromPartType("tool-getProjectBudget")).toBe("getProjectBudget");
  });

  it("mengabaikan part yang bukan tool", () => {
    expect(toolNameFromPartType("text")).toBeNull();
  });
});

describe("keadaan jejak tool", () => {
  it("membedakan tool yang gagal dari yang selesai", () => {
    expect(toolTraceState("output-error")).toBe("failed");
    expect(toolTraceState("output-available")).toBe("done");
  });

  it("menganggap state selain itu masih berjalan", () => {
    expect(toolTraceState("input-streaming")).toBe("running");
    expect(toolTraceState(undefined)).toBe("running");
  });

  it("memberi label kegagalan yang jelas, bukan label selesai", () => {
    expect(toolLabel("getProjectBudget", "failed")).toBe("Gagal membaca budget");
    expect(toolLabel("getProjectBudget", "done")).toBe("Budget dan realisasi biaya dibaca");
  });

  it("memakai label cadangan untuk tool yang belum dipetakan", () => {
    expect(toolLabel("toolBaru", "running")).toBe("Mengambil data");
  });
});

describe("penggabungan jejak berulang", () => {
  it("menggabungkan jejak identik berturut-turut menjadi satu baris bercacah", () => {
    const collapsed = collapseTraces([
      { key: "a", label: "Menilai kesehatan keuangan proyek", state: "done" },
      { key: "b", label: "Menilai kesehatan keuangan proyek", state: "done" },
      { key: "c", label: "Menilai kesehatan keuangan proyek", state: "done" },
    ]);

    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].count).toBe(3);
  });

  it("tidak menggabungkan jejak dengan keadaan berbeda", () => {
    const collapsed = collapseTraces([
      { key: "a", label: "Membaca budget dan realisasi biaya", state: "done" },
      { key: "b", label: "Membaca budget dan realisasi biaya", state: "failed" },
    ]);

    expect(collapsed).toHaveLength(2);
  });

  it("tidak menggabungkan jejak yang terpisah oleh jejak lain", () => {
    const collapsed = collapseTraces([
      { key: "a", label: "Daftar proyek dibaca", state: "done" },
      { key: "b", label: "Budget dibaca", state: "done" },
      { key: "c", label: "Daftar proyek dibaca", state: "done" },
    ]);

    expect(collapsed).toHaveLength(3);
  });

  it("mengembalikan daftar kosong untuk masukan kosong", () => {
    expect(collapseTraces([])).toEqual([]);
  });
});
