import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProjectBudgetDashboard } from "@/app/actions/project/excel-budget";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { ProjectOverviewDesktop, type BudgetCategorySort } from "./project-overview-desktop";

const budget: ProjectBudgetDashboard = {
  projectId: "project",
  projectName: "Proyek",
  budgetId: "budget",
  status: "APPROVED",
  contractValue: 200_000_000,
  approvedRabValue: 200_000_000,
  internalBudget: 140_000_000,
  pendingCost: 12_000_000,
  actualCost: 40_000_000,
  paidCost: 30_000_000,
  remainingBudget: 100_000_000,
  usedPercentage: 28.6,
  targetGrossAmount: 60_000_000,
  targetGrossPercentage: 30,
  projectedMarginAmount: 60_000_000,
  projectedMarginPercentage: 30,
  productionScopeTotal: 200_000_000,
  serviceFeeTotal: 0,
  physicalMarginAmount: 60_000_000,
  physicalMarginPercentage: 30,
  projectProgressPercentage: 20,
  categories: [
    {
      id: "material",
      code: "MATERIAL",
      name: "Material",
      allocatedAmount: 80_000_000,
      pendingAmount: 12_000_000,
      actualAmount: 25_000_000,
      paidAmount: 20_000_000,
      remainingAmount: 55_000_000,
      usedPercentage: 31.25,
      status: "SAFE",
      sortOrder: 0,
    },
    {
      id: "tukang",
      code: "TUKANG",
      name: "Tukang",
      allocatedAmount: 60_000_000,
      pendingAmount: 0,
      actualAmount: 15_000_000,
      paidAmount: 10_000_000,
      remainingAmount: 45_000_000,
      usedPercentage: 25,
      status: "SAFE",
      sortOrder: 1,
    },
    {
      id: "other",
      code: "LAIN_LAIN",
      name: "Lain-lain",
      allocatedAmount: 0,
      pendingAmount: 0,
      actualAmount: 0,
      paidAmount: 0,
      remainingAmount: 0,
      usedPercentage: 0,
      status: "SAFE",
      sortOrder: 3,
    },
  ],
};

function html(
  status: string,
  canUpdate: boolean,
  canApprove: boolean,
  categorySort?: BudgetCategorySort,
): string {
  return renderToStaticMarkup(
    <WorkspacePresentationProvider presentation="desktop">
      <ProjectOverviewDesktop
        budget={{ ...budget, status }}
        contractValue={budget.contractValue}
        actions={[]}
        readiness={[]}
        selectedCategoryId="material"
        categorySort={categorySort}
        canUpdateBudget={canUpdate}
        canApproveBudget={canApprove}
        canReallocate={canApprove && status === "APPROVED"}
        decisionPending={false}
        onCategorySelect={() => undefined}
        onCategorySort={() => undefined}
        onBudgetDecision={() => undefined}
        onReallocate={() => undefined}
        onNavigate={() => undefined}
      />
    </WorkspacePresentationProvider>,
  );
}

describe("compact project budget desktop", () => {
  test("keeps upstream category order until a user explicitly chooses a sortable header", () => {
    const canonical = html("APPROVED", false, false);
    expect(canonical.indexOf(">Material<")).toBeLessThan(canonical.indexOf(">Tukang<"));
    expect(canonical.indexOf(">Tukang<")).toBeLessThan(canonical.indexOf(">Lain-lain<"));
    const requested = html("APPROVED", false, false, {
      column: "category",
      direction: "ascending",
    });
    expect(requested.indexOf(">Lain-lain<")).toBeLessThan(requested.indexOf(">Material<"));
    expect(requested).toContain('aria-sort="ascending"');
  });
  test("leads with authoritative consumed/paid/remaining/margin before readiness and preserves selected-category semantics", () => {
    const markup = html("APPROVED", false, false);
    expect(markup).toContain("Rp 40 jt");
    expect(markup).toContain("Rp 30 jt");
    expect(markup).toContain("Rp 100 jt");
    expect(markup).toContain("Rp 60 jt");
    expect(markup.indexOf("Budget per kategori")).toBeLessThan(markup.indexOf("Kesiapan proyek"));
    expect(markup).toContain('aria-label="Budget proyek per kategori"');
    expect(markup).toContain('aria-current="true"');
    expect(markup).not.toContain("Atur alokasi");
  });
  test("draft and pending-review commands follow domain permission rather than viewport or role name", () => {
    expect(html("DRAFT", true, false)).toContain("Ajukan budget");
    expect(html("DRAFT", false, false)).not.toContain("Ajukan budget");
    expect(html("PENDING_APPROVAL", true, false)).not.toContain("Setujui budget");
    const approver = html("PENDING_APPROVAL", false, true);
    expect(approver).toContain("Setujui budget");
    expect(approver).toContain("Minta revisi");
    expect(approver).toContain("button--sm");
    expect(html("APPROVED", false, true)).toContain("Atur alokasi");
  });
});
