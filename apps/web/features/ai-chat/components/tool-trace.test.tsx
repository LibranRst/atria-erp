import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ToolTraceList } from "./tool-trace";
import { activitySummary, waitingDuration, type ActivityTrace } from "../utils/activity-summary";
const traces: ActivityTrace[] = [
  { key: "read", label: "Stok dibaca", state: "done", count: 2, kind: "read" },
  { key: "proposal", label: "Draft disiapkan", state: "done", count: 1, kind: "proposal" },
  { key: "suggest", label: "Saran disiapkan", state: "done", count: 1, kind: "suggestion" },
];
test("mixed calls count actual sources separately from proposals and suggestions", () => {
  const summary = activitySummary(traces, false);
  expect(summary.label).toBe("2 sumber diperiksa · 1 usulan siap");
});
test("current tool action is contextual and detail stays manually collapsed", () => {
  const html = renderToStaticMarkup(
    <ToolTraceList
      traces={[{ key: "a", label: "Memeriksa stok", state: "running", count: 1, kind: "read" }]}
      isActive
      elapsedSeconds={12}
    />,
  );
  expect(html).toContain("Memeriksa stok");
  expect(html).toContain("12 dtk");
  expect(html).toContain('aria-expanded="false"');
  expect(html).toContain("aria-controls=");
});
test("failed and interrupted calls remain distinct from successful work", () => {
  expect(
    activitySummary([...traces, { key: "f", label: "Budget", state: "failed", count: 2 }], false)
      .detail,
  ).toContain("2 gagal");
  expect(
    activitySummary(
      [...traces, { key: "s", label: "Budget", state: "interrupted", count: 1 }],
      false,
    ).label,
  ).toBe("Proses dihentikan");
});
test("no tools does not invent data sources", () => {
  expect(renderToStaticMarkup(<ToolTraceList traces={[]} />)).toBe("");
  expect(renderToStaticMarkup(<ToolTraceList traces={[]} isActive />)).toContain(
    "Menyusun jawaban",
  );
});
test("waiting time appears only after ten seconds and has no invented ETA", () => {
  expect(waitingDuration(9)).toBe("");
  expect(waitingDuration(10)).toBe("10 dtk");
  expect(waitingDuration(70)).toBe("1 m 10 dtk");
});
test("waiting and recovered activity use neutral copy while blocking errors remain clear", () => {
  const state: ActivityTrace[] = [
    { key: "retry", label: "Pencarian awal diulang", state: "recovered", count: 1, kind: "read" },
    {
      key: "input",
      label: "Form input siap diisi",
      state: "done",
      count: 1,
      kind: "input",
      waitingForInput: "project",
    },
  ];
  expect(activitySummary(state, false).state).toBe("waiting");
  const html = renderToStaticMarkup(<ToolTraceList traces={state} />);
  expect(html).toContain("Pilih proyek untuk melanjutkan");
  expect(html).toContain("percobaan dipulihkan");
  expect(html).not.toContain("pemeriksaan belum selesai");
  const blocked = activitySummary(
    [
      ...state,
      {
        key: "denied",
        label: "Akses data",
        detail: "Akses data ditolak.",
        state: "failed",
        count: 1,
        kind: "read",
      },
    ],
    false,
  );
  expect(blocked.state).toBe("failed");
  expect(blocked.detail).toContain("1 gagal");
});
