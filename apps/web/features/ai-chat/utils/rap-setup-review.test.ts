import { expect, test } from "bun:test";
import { setupReviewRows } from "./rap-setup-review";
import type { SetupProposal } from "@atria/core/ai/rap-finalization";
const steps: SetupProposal["steps"] = [
  {
    step: { action: "READY_PACKAGES", itemIds: ["package"] },
    permission: "update:budget",
    label: "Tandai paket Siap",
    detail: "Scope ditinjau",
    packageIds: ["package"],
  },
  ...(["TUKANG", "SUBCON", "REVIEW"] as const).map((targetStage) => ({
    step: { action: "ADVANCE" as const, targetStage },
    permission: "update:budget" as const,
    label: `Lanjut ${targetStage}`,
    detail: "Detail internal",
    packageIds: [],
  })),
  {
    step: { action: "FINALIZE" },
    permission: "lock:rap",
    label: "Kunci RAP",
    detail: "Melalui revisi setelah dikunci",
    packageIds: [],
  },
];
test("summarizes adjacent transitions without dropping package decisions or changing the backend sequence", () => {
  const before = JSON.stringify(steps),
    rows = setupReviewRows(steps);
  expect(rows.map((row) => row.label)).toEqual([
    "Tandai paket Siap",
    "Konfirmasi kesiapan RAP",
    "Kunci RAP",
  ]);
  expect(rows[1].detail).toContain("Material, Tukang, Subcon");
  expect(rows[0].packageIds).toEqual(["package"]);
  expect(JSON.stringify(steps)).toBe(before);
});
test("keeps scope decisions between transition groups in their original place", () => {
  const scoped: SetupProposal["steps"] = [
    steps[1],
    {
      step: { action: "SET_SCOPE", category: "SUBCON", skipped: true },
      permission: "update:budget",
      label: "Subcon tidak digunakan",
      detail: "Dipilih user",
      packageIds: [],
    },
    steps[2],
  ];
  expect(setupReviewRows(scoped).map((row) => row.index)).toEqual([0, 1, 2]);
  expect(setupReviewRows(scoped)[1].label).toBe("Subcon tidak digunakan");
});
