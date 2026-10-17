import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProjectBudgetDashboard } from "@/app/actions/project/excel-budget";
import type { ProjectMarginData } from "@atria/core/types/project-margin";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import {
  ProjectMarginDesktop,
  ProjectMarginDesktopCash,
  ProjectMarginDesktopLoading,
} from "./project-margin-desktop";
import {
  canReviewProjectClosing,
  marginCategoryContext,
  marginFinalSnapshot,
  marginSource,
  marginVerdict,
} from "./project-margin-desktop-model";

const categoryCodes: readonly ProjectBudgetDashboard["categories"][number]["code"][] = [
  "MATERIAL",
  "TUKANG",
  "OPERASIONAL",
  "LAIN_LAIN",
  "SUBCON",
];
const budget: ProjectBudgetDashboard = {
  projectId: "project",
  projectName: "Proyek",
  budgetId: "budget",
  status: "APPROVED",
  contractValue: 200_000_000.25,
  approvedRabValue: 200_000_000.25,
  internalBudget: 140_000_000,
  pendingCost: 12_000_000,
  actualCost: 40_000_000.25,
  paidCost: 30_000_000.25,
  remainingBudget: 99_999_999.75,
  usedPercentage: 28.6,
  targetGrossAmount: 65_000_000,
  targetGrossPercentage: 32.5,
  projectedMarginAmount: 60_000_000.25,
  projectedMarginPercentage: 30,
  productionScopeTotal: 200_000_000,
  serviceFeeTotal: 0,
  physicalMarginAmount: 60_000_000,
  physicalMarginPercentage: 30,
  projectProgressPercentage: 20,
  categories: categoryCodes.map((code, index) => ({
    id: code,
    code,
    name: ["Material", "Tukang", "Operasional", "Lain-lain", "Subcon"][index] ?? "",
    allocatedAmount: 28_000_000,
    pendingAmount: 2_400_000,
    actualAmount: 8_000_000,
    paidAmount: 6_000_000,
    remainingAmount: 20_000_000,
    usedPercentage: 28.6,
    status: "SAFE",
    sortOrder: index,
  })),
};
const data: ProjectMarginData = {
  source: { status: "ready" },
  cashSource: { status: "ready" },
  finalSnapshotSource: { status: "missing" },
  cash: { received: 60_000_000.25, paid: 30_000_000, position: 30_000_000.25 },
  finalSnapshot: null,
};
function html(
  input: {
    readonly budget?: ProjectBudgetDashboard | null;
    readonly data?: ProjectMarginData;
    readonly status?: string;
  } = {},
): string {
  return renderToStaticMarkup(
    <WorkspacePresentationProvider presentation="desktop">
      <ProjectMarginDesktop
        budget={input.budget === undefined ? budget : input.budget}
        marginData={input.data ?? data}
        projectStatus={input.status ?? "ACTIVE"}
        selectedCategoryId={null}
        onCategorySelect={() => undefined}
        onCategoryClose={() => undefined}
        onNavigate={() => undefined}
        onRetry={() => undefined}
      />
    </WorkspacePresentationProvider>,
  );
}

describe("project margin desktop facts and source states", () => {
  test("uses configured target and five category rows without false narrow selection or artificial pagination", () => {
    const markup = html();
    expect(markup).toContain("32,5%");
    expect(markup).toContain("Di bawah target");
    expect(markup).toContain("nilai yang lebih besar");
    for (const category of budget.categories) expect(markup).toContain(`>${category.name}<`);
    expect(markup).not.toContain('data-selected="true"');
    expect(markup).not.toContain("10 baris");
    expect(markup).not.toContain("Kembali ke kategori");
  });
  test("restricted or failed budget never becomes healthy zero or a setup suggestion", () => {
    for (const status of ["restricted", "unavailable"] as const) {
      const markup = html({ data: { ...data, source: { status } } });
      expect(markup).not.toContain("Rp 0");
      expect(markup).not.toContain("Sesuai target");
      expect(markup).not.toContain("Budget per kategori");
    }
    expect(marginSource(undefined, budget).status).toBe("unavailable");
    expect(marginSource(data, null).status).toBe("unavailable");
  });
  test("uses stored snapshot for completed totals and labels category facts as current", () => {
    const markup = html({
      status: "COMPLETED",
      data: {
        ...data,
        finalSnapshotSource: { status: "ready" },
        finalSnapshot: {
          id: "final",
          snapshotAt: new Date("2026-10-15T06:00:00Z"),
          contractValue: "200000000.25",
          internalBudget: "140000000.00",
          actualCost: "50000000.25",
          remainingBudget: "89999999.75",
          targetGrossAmount: "65000000.00",
          targetGrossPercentage: "32.5",
          realizedMarginAmount: "150000000.00",
          realizedMarginPercentage: "75",
          cashPosition: "25000000.25",
        },
      },
    });
    expect(markup).toContain("Margin akhir tersimpan");
    expect(markup).toContain("Rp 150 jt");
    expect(markup).toContain("Data budget saat ini");
    expect(markup).not.toContain("Rp 60 jt");
    expect(html({ status: "COMPLETED" })).toContain("Ringkasan akhir belum tersedia");
  });
  test("independently authorized final snapshot survives failed or missing live budget without mixing contracts", () => {
    const finalData: ProjectMarginData = {
      ...data,
      finalSnapshotSource: { status: "ready" },
      finalSnapshot: {
        id: "final-independent",
        snapshotAt: new Date("2026-10-15T06:00:00Z"),
        contractValue: "350000000.25",
        internalBudget: "200000000.00",
        actualCost: "180000000.25",
        remainingBudget: "19999999.75",
        targetGrossAmount: "66500000.00",
        targetGrossPercentage: "19",
        realizedMarginAmount: "170000000.00",
        realizedMarginPercentage: "48.5714",
        cashPosition: "15000000.25",
      },
      cashSource: { status: "unavailable" },
      cash: null,
    };
    for (const status of ["unavailable", "missing"] as const) {
      const combined = { ...finalData, source: { status } };
      const markup = html({ budget: null, data: combined, status: "COMPLETED" });
      expect(markup).toContain("Margin akhir tersimpan");
      expect(markup).toContain("Rp 170 jt");
      expect(markup).toContain("Rp 350 jt");
      expect(markup).toContain("Rp 200 jt");
      expect(markup).toContain("19%");
      expect(markup).toContain("Posisi kas saat ditutup");
      expect(markup).toContain("Rp 15 jt");
      expect(markup).not.toContain("Perbandingan kategori terhadap margin");
      expect(markup).toContain(
        status === "missing"
          ? "Budget saat ini belum tersedia"
          : "Kategori saat ini belum dapat dimuat",
      );
      expect(marginFinalSnapshot("COMPLETED", combined)?.id).toBe("final-independent");
      expect(marginFinalSnapshot("ACTIVE", combined)).toBeNull();
      const staleLive = html({ budget, data: combined, status: "COMPLETED" });
      expect(staleLive).toContain("Rp 350 jt");
      expect(staleLive).not.toContain("Rp 60 jt");
    }
    const denied = { ...finalData, source: { status: "restricted" as const } };
    expect(marginFinalSnapshot("COMPLETED", denied)).toBeNull();
    const restricted = html({ budget: null, data: denied, status: "COMPLETED" });
    expect(restricted).toContain("Akses margin terbatas");
    expect(restricted).not.toContain("Rp 170 jt");
    expect(restricted).not.toContain("Margin akhir tersimpan");
  });
  test("cash cents and zero are valid only with complete authorized sources", () => {
    const cash = (marginData: ProjectMarginData): string =>
      renderToStaticMarkup(
        <ProjectMarginDesktopCash marginData={marginData} onRetry={() => undefined} />,
      );
    expect(cash(data)).toContain("30.000.000,25");
    expect(cash({ ...data, cash: { received: 0, paid: 0, position: 0 } })).toContain("Rp 0");
    const failed = cash({ ...data, cashSource: { status: "unavailable" } });
    expect(failed).toContain("belum dapat dimuat");
    expect(failed).not.toContain("Rp 0");
  });
  test("skeleton covers comparison and independent lower panels", () => {
    const markup = renderToStaticMarkup(<ProjectMarginDesktopLoading />);
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("Memuat biaya kategori");
    expect(markup).not.toContain("Chargement");
  });
  test("margin and category context preserve zero, loss, configured targets and narrow first-click behavior", () => {
    expect(marginVerdict(-0.25, -0.001, 0).tone).toBe("critical");
    expect(marginVerdict(1, 20, 32.5).tone).toBe("warning");
    expect(marginVerdict(0, 0, 0).tone).toBe("healthy");
    expect(marginCategoryContext(budget.categories, null)).toBeNull();
    expect(marginCategoryContext(budget.categories, null)).toBeNull();
    expect(marginCategoryContext(budget.categories, "TUKANG")?.id).toBe("TUKANG");
    expect(marginCategoryContext(budget.categories, "stale")).toBeNull();
  });
  test("completion review requires server readiness plus explicit rights, active project and current input", () => {
    const valid = {
      projectStatus: "ACTIVE",
      sourceReady: true,
      checklist: { canComplete: true, blockers: [] },
      permitted: true,
      note: "Catatan final proyek",
      pending: false,
    };
    expect(canReviewProjectClosing(valid)).toBe(true);
    expect(canReviewProjectClosing({ ...valid, checklist: null })).toBe(false);
    expect(
      canReviewProjectClosing({ ...valid, checklist: { canComplete: false, blockers: [] } }),
    ).toBe(false);
    expect(
      canReviewProjectClosing({
        ...valid,
        checklist: { canComplete: true, blockers: ["Tagihan belum final"] },
      }),
    ).toBe(false);
    expect(canReviewProjectClosing({ ...valid, permitted: false })).toBe(false);
    expect(canReviewProjectClosing({ ...valid, sourceReady: false })).toBe(false);
    expect(canReviewProjectClosing({ ...valid, projectStatus: "COMPLETED" })).toBe(false);
    expect(canReviewProjectClosing({ ...valid, note: "Singkat" })).toBe(false);
    expect(canReviewProjectClosing({ ...valid, pending: true })).toBe(false);
  });
});
