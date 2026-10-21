import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { desktopTablePage } from "@/components/ui";
import type { ProjectCategoryPlanItemView, RapItemView, RapView } from "../../types/rap-rab-types";
import {
  countMaterialsNeedingPurchase,
  formatRapQuantity,
  rapSourceLabel,
  filterRapDesktopRows,
  materialDesktopRows,
  packageDesktopRows,
} from "./rap-desktop-model";
import { rapDesktopColumns, rapPlanningColumns } from "./rap-desktop-table";
import { RapDesktopWorkspace } from "./rap-desktop-workspace";
import { RapDesktopLoading } from "./rap-desktop-loading";
import { InternalPlanOverview } from "./internal-plan-overview";

function material(id: string, unit: string, needToBuy: number, estimate: string): RapItemView {
  return {
    id,
    materialId: id,
    materialName: `Master ${id}`,
    area: "Kitchen",
    name: `Material ${id}`,
    description: null,
    requiredQuantity: "2",
    bufferQuantity: "1",
    totalQuantity: "3",
    unit,
    estimatedUnitCost: "10.25",
    estimatedTotalCost: estimate,
    source: "STOCK_AND_PURCHASE",
    status: "PLANNED",
    internalNote: null,
    availableStock: 1,
    needToBuy,
    reservedQuantity: 0,
    boughtQuantity: 0,
    usedQuantity: 0,
    leftoverQuantity: 0,
    securedQuantity: 0,
    returnedQuantity: 0,
    wasteQuantity: 0,
    actualMaterialCost: 0.25,
    costVariance: 0,
  };
}
const materials = [
  material("1", "lembar", 2, "30.75"),
  material("2", "meter", 15, "500"),
  material("3", "sak", 0, "0"),
];
const item: ProjectCategoryPlanItemView = {
  id: "package",
  projectBudgetCategoryId: "tukang",
  expenseCategoryCode: "TUKANG",
  expenseCategoryName: "Tukang",
  vendorId: "vendor",
  vendorName: "Mandor Jaya",
  name: "Instalasi kitchen",
  scopeDescription: "Pasang kabinet",
  area: "Kitchen",
  quantity: "1",
  unit: "paket",
  estimatedUnitCost: "100.50",
  estimatedTotalCost: "100.50",
  status: "ACTIVE",
  internalNote: null,
  displayOrder: 0,
  actualCost: 20.25,
  variance: 80.25,
};
const rap: RapView = {
  id: "rap",
  status: "DRAFT",
  revision: 1,
  notes: null,
  setupStage: "REVIEW",
  tukangScopeSkipped: false,
  subconScopeSkipped: true,
  setupUpdatedById: null,
  items: materials,
};
const noop = (): void => undefined;
function html(overrides: Partial<ComponentProps<typeof RapDesktopWorkspace>> = {}): string {
  return renderToStaticMarkup(
    <WorkspacePresentationProvider presentation="desktop">
      <RapDesktopWorkspace
        rap={rap}
        plannedCost={530.75}
        tukangPlanItems={[item]}
        subconPlanItems={[]}
        canEditRap={false}
        onMaterialOpen={noop}
        onPackageOpen={noop}
        {...overrides}
      />
    </WorkspacePresentationProvider>,
  );
}

describe("RAP desktop source projection", () => {
  test("presentation localizes source labels and quantity precision without changing source values", () => {
    expect(formatRapQuantity("6.00")).toBe("6");
    expect(formatRapQuantity("12.3456")).toBe("12,3456");
    expect(formatRapQuantity(1234.5)).toBe("1.234,5");
    expect(rapSourceLabel("PURCHASE")).toBe("Pembelian");
    expect(rapSourceLabel("STOCK_AND_PURCHASE")).toBe("Stok & pembelian");
    expect(rapSourceLabel("UNKNOWN_SOURCE")).toBe("Belum ditentukan");
  });
  test("counts procurement records instead of adding quantities with different units", () => {
    expect(countMaterialsNeedingPurchase(materials)).toBe(2);
    const rows = materialDesktopRows(materials);
    expect(rows.map((row) => row.unit)).toEqual(["lembar", "meter", "sak"]);
    expect(rows[0]?.estimate).toBe(30.75);
    expect(rows[0]?.actual).toBe(0.25);
    expect(filterRapDesktopRows(rows, "", "need")).toHaveLength(2);
    expect(filterRapDesktopRows(rows, "", "covered").map((row) => row.id)).toEqual(["3"]);
    expect(filterRapDesktopRows(rows, "master 2", "all").map((row) => row.id)).toEqual(["2"]);
  });
  test("filters complete package source and sorts before slicing a page", () => {
    const rows = packageDesktopRows(
      Array.from({ length: 32 }, (_, index) => ({
        ...item,
        id: `p${index}`,
        name: `Paket ${index}`,
        estimatedTotalCost: String(index + 0.5),
        status: index < 15 ? "DRAFT" : "ACTIVE",
      })),
      "TUKANG",
    );
    expect(filterRapDesktopRows(rows, "mandor", "ready")).toHaveLength(17);
    const first = desktopTablePage(
      rows,
      rapDesktopColumns,
      (row) => row.id,
      { column: "estimate", direction: "descending" },
      1,
      10,
    );
    const second = desktopTablePage(
      rows,
      rapDesktopColumns,
      (row) => row.id,
      { column: "estimate", direction: "descending" },
      2,
      10,
    );
    expect(first.total).toBe(32);
    expect(first.rows[0]?.estimate).toBe(31.5);
    expect(second.rows[0]?.estimate).toBe(21.5);
    expect(
      desktopTablePage(
        rows.slice(0, 2),
        rapDesktopColumns,
        (row) => row.id,
        { column: "estimate", direction: "ascending" },
        4,
        10,
      ).page,
    ).toBe(1);
  });
  test("planning compares supplied unit prices before pagination and retains exact cents and source units", () => {
    const rows = materialDesktopRows([
      { ...material("panel", "lembar", 2, "40.75"), estimatedUnitCost: "10.25" },
      { ...material("finish", "meter", 1, "10.50"), estimatedUnitCost: "10.50" },
      { ...material("fitting", "set", 0, "900.00"), estimatedUnitCost: "9.75" },
    ]);
    const sorted = desktopTablePage(
      rows,
      rapPlanningColumns,
      (row) => row.id,
      { column: "unitCost", direction: "descending" },
      1,
      10,
    );
    expect(sorted.rows.map((row) => row.id)).toEqual(["finish", "panel", "fitting"]);
    expect(sorted.rows.map((row) => row.unit)).toEqual(["meter", "lembar", "set"]);
    expect(sorted.rows[1]?.estimate).toBe(40.75);
    const unitPrice = rapPlanningColumns.find((column) => column.key === "unitCost");
    const first = sorted.rows[0];
    expect(unitPrice).toBeDefined();
    expect(first).toBeDefined();
    if (!unitPrice || !first) return;
    expect(renderToStaticMarkup(<>{unitPrice.render(first)}</>)).toContain("10,50");
    expect(rapPlanningColumns.some((column) => column.label === "Estimasi total")).toBe(true);
    expect(rapPlanningColumns.some((column) => column.key === "actual")).toBe(false);
    const execution = desktopTablePage(
      rows.map((row, index) => ({ ...row, actual: index + 0.25 })),
      rapDesktopColumns,
      (row) => row.id,
      { column: "actual", direction: "descending" },
      1,
      10,
    );
    expect(execution.rows.map((row) => row.actual)).toEqual([2.25, 1.25, 0.25]);
    expect(rapDesktopColumns.some((column) => column.label === "Realisasi")).toBe(true);
  });
});

describe("RAP desktop operational contract", () => {
  test("mobile summary keeps compact primary money, exact cents and material-record counts", () => {
    const markup = renderToStaticMarkup(
      <WorkspacePresentationProvider presentation="mobile">
        <InternalPlanOverview
          rap={{ ...rap, status: "LOCKED" }}
          plannedCost={594669899.75}
          tukangPlanItems={[item]}
          subconPlanItems={[]}
          packageItemCount={1}
          needToBuy={17}
          canEditRap={false}
          rabEstimate={null}
          setInternalRevisionOpen={noop}
          rapOverviewFilter="MATERIAL"
          setRapOverviewFilter={noop}
          setRapDetailItemId={noop}
          setPackageDetailItemId={noop}
        />
      </WorkspacePresentationProvider>,
    );
    const summary = markup.slice(0, markup.indexOf("</section>"));
    expect(summary).toContain("money-value-compact");
    expect(summary).toContain("whitespace-nowrap");
    expect(summary).toContain("594.670.000,25");
    expect(summary).toContain("2 material perlu dibeli");
    expect(summary).not.toContain("17 perlu dibeli");
  });
  test("initial loading matches the unselected full-width list unless a detail is known", () => {
    const initial = renderToStaticMarkup(<RapDesktopLoading />);
    const selected = renderToStaticMarkup(<RapDesktopLoading showDetail />);
    expect(initial).toContain('aria-busy="true"');
    expect(initial).toContain("Memuat item RAP");
    expect(initial).not.toContain("xl:grid-cols-[minmax(0,1fr)_18rem]");
    expect(selected).toContain("xl:grid-cols-[minmax(0,1fr)_18rem]");
  });
  test("describes internal cost and counts without fabricating stock ownership or payments", () => {
    const markup = html();
    expect(markup).toContain("2 material perlu dibeli");
    expect(markup).not.toContain("17 perlu dibeli");
    expect(markup).toContain("631,25");
    expect(markup).toContain("30,75");
    expect(markup).not.toContain('aria-current="true"');
    expect(markup).not.toContain("Buat revisi RAP");
    expect(html({ canEditRap: true, canRevise: true, onRevise: noop })).toContain(
      "Buat revisi RAP",
    );
    expect(html({ rap: { ...rap, items: [] }, plannedCost: 0 })).toContain(
      "Belum ada kebutuhan material",
    );
  });
  test("review retains permission, completeness and pending finalization guards", () => {
    const setup: NonNullable<ComponentProps<typeof RapDesktopWorkspace>["setup"]> = {
      activeStage: "REVIEW",
      onStageChange: noop,
      isPending: false,
      canEditCategoryPlan: false,
      onAddMaterial: noop,
      onAddPackage: noop,
      onAdvance: noop,
      onScopeSkip: noop,
      canFinalize: false,
      onFinalize: noop,
    };
    const restricted = html({ setup });
    expect(restricted).toContain("Menunggu pengguna dengan izin finalisasi RAP.");
    expect(restricted).toContain("Lingkup lengkap");
    const unlocked = html({ setup: { ...setup, canFinalize: true } });
    expect(unlocked).toContain("Finalisasi RAP");
    const incomplete = html({ rap: { ...rap, items: [] }, setup: { ...setup, canFinalize: true } });
    expect(incomplete).toContain("Lingkup belum lengkap");
    expect(incomplete).toContain("Finalisasi tidak membuat pembayaran atau gerakan stok.");
    const pending = html({ setup: { ...setup, canFinalize: true, isPending: true } });
    expect(pending).toContain("Memproses...");
  });
});
