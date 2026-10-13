import type { SetupProposal } from "@atria/core/ai/rap-finalization";
export type SetupReviewRow = {
  readonly index: number;
  readonly label: string;
  readonly detail: string;
  readonly packageIds: readonly string[];
};
const checkedPart = { TUKANG: "Material", SUBCON: "Tukang", REVIEW: "Subcon" };
/** Compress consecutive wizard transitions while retaining every business decision and its order. */
export function setupReviewRows(steps: SetupProposal["steps"]): SetupReviewRow[] {
  const rows: SetupReviewRow[] = [];
  let checks: string[] = [],
    first = -1;
  function flush(): void {
    if (checks.length === 0) return;
    rows.push({
      index: first,
      label: "Konfirmasi kesiapan RAP",
      detail: `Kesiapan ${checks.join(", ")} diperiksa untuk melanjutkan penyusunan RAP.`,
      packageIds: [],
    });
    checks = [];
    first = -1;
  }
  steps.forEach((item, index) => {
    if (item.step.action === "ADVANCE") {
      if (first < 0) first = index;
      checks.push(checkedPart[item.step.targetStage]);
    } else {
      flush();
      rows.push({ index, label: item.label, detail: item.detail, packageIds: item.packageIds });
    }
  });
  flush();
  return rows;
}
