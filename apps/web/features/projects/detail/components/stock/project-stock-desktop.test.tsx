import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { desktopTablePage } from "@/components/ui";
import type { StockMovement } from "../../types/project-tabs-types";
import type { ProjectStockItem } from "./project-stock-types";
import {
  allowedProjectStockOperations,
  filterProjectStockItems,
  filterProjectStockMovements,
  formatStockQuantity,
  projectMovementLabel,
  projectStockCounts,
} from "./project-stock-desktop-model";
import {
  ProjectStockDesktop,
  projectStockMaterialColumns,
  projectStockMovementColumns,
} from "./project-stock-desktop";
import { ProjectStockMobileSummary } from "./project-stock-mobile-summary";
import { projectOperationsFixtureData } from "../../../../../.storybook/project-operations-data.fixture";
import { ProjectStockDesktopLoading } from "./project-stock-desktop-loading";

function material(index: number): ProjectStockItem {
  return {
    id: `item-${index}`,
    materialId: `material-${index}`,
    materialName: `Master ${index}`,
    name: `Material ${index}`,
    area: index % 2 ? "Kitchen" : "Foyer",
    totalQuantity: "3.25",
    unit: index % 2 ? "lembar" : "meter",
    availableStock: 4,
    needToBuy: index % 3 ? 2.25 : 0,
    reservedQuantity: index % 4 ? 0 : 1,
    usedQuantity: index % 2 ? 1 : 0,
    leftoverQuantity: 1,
    securedQuantity: 1,
    boughtQuantity: 0,
    returnedQuantity: 0,
    wasteQuantity: 0,
  };
}
const items = Array.from({ length: 36 }, (_, index) => material(index));
function movement(index: number): StockMovement {
  return {
    id: `move-${index}`,
    movementType: index % 2 ? "RESERVE" : "USE",
    quantity: `${index}.25`,
    unitCost: "123.45",
    note: index % 2 ? "Pasang kabinet" : null,
    createdAt: new Date(Date.UTC(2026, 9, index + 1)),
    material: { name: `Material ${index}`, unit: "lembar" },
    location: { name: index % 2 ? "Gudang A" : "Gudang B" },
    createdBy: { name: "Budi" },
  };
}
const movements = Array.from({ length: 32 }, (_, index) => movement(index));
function html(
  status: "ready" | "missing" | "restricted" | "unavailable" = "ready",
  rows: readonly ProjectStockItem[] = items,
): string {
  return renderToStaticMarkup(
    <WorkspacePresentationProvider presentation="desktop">
      <ProjectStockDesktop
        rap={status === "ready" ? { id: "rap", items: rows } : null}
        source={{ status }}
        stockMovements={movements}
        onActivityOpen={(): void => undefined}
      />
    </WorkspacePresentationProvider>,
  );
}

describe("project stock desktop source contracts", () => {
  test("uses the exact action rights enforced by stock writers", () => {
    expect(
      allowedProjectStockOperations((permission) => permission === "create:stock_movement"),
    ).toEqual([]);
    expect(allowedProjectStockOperations((permission) => permission === "reserve:stock")).toEqual([
      "RESERVE",
    ]);
    expect(allowedProjectStockOperations((permission) => permission === "use:stock")).toEqual([
      "USE",
      "RETURN",
    ]);
    expect(allowedProjectStockOperations((permission) => permission === "waste:stock")).toEqual([
      "WASTE",
    ]);
  });
  test("counts material records and retains unlike quantities and precision", () => {
    expect(projectStockCounts(items)).toEqual({
      materials: 36,
      shortage: 24,
      reserved: 9,
      used: 18,
      leftover: 36,
    });
    expect(formatStockQuantity("12.3456")).toBe("12,3456");
    expect(filterProjectStockItems(items, "Kitchen", "need")).toHaveLength(12);
    expect(filterProjectStockItems(items, "master 3", "all").map((row) => row.id)).toEqual([
      "item-3",
      "item-30",
      "item-31",
      "item-32",
      "item-33",
      "item-34",
      "item-35",
    ]);
    expect(html()).toContain("jumlah baris material");
    expect(html()).toContain("3,25");
    expect(html()).toContain("meter");
    expect(html()).toContain("lembar");
  });
  test("mobile identity counts material records rather than summing different units", () => {
    const source = projectOperationsFixtureData().projectStockData?.rap?.items ?? [];
    const counts = projectStockCounts(source);
    expect(counts).toMatchObject({ materials: 36, reserved: 36, used: 9, leftover: 36 });
    const markup = renderToStaticMarkup(<ProjectStockMobileSummary items={source} />);
    expect(markup).toContain("baris material RAP");
    expect(markup).toContain("Jumlah baris material; kuantitas mengikuti satuannya di rincian.");
    expect(markup).toContain(">36</div>");
    expect(markup).toContain(">9</p>");
    expect(markup).not.toContain("130,5");
    expect(markup).not.toContain("121,5");
  });
  test("sorts full collection before pagination and clamps after source shrink", () => {
    const page = desktopTablePage(
      items,
      projectStockMaterialColumns,
      (row) => row.id,
      { column: "name", direction: "descending" },
      2,
      10,
    );
    expect(page.total).toBe(36);
    expect(page.rows[0]?.name).toBe("Material 25");
    expect(
      desktopTablePage(
        items.slice(0, 2),
        projectStockMaterialColumns,
        (row) => row.id,
        { column: "name", direction: "ascending" },
        4,
        10,
      ).page,
    ).toBe(1);
    const activity = desktopTablePage(
      movements,
      projectStockMovementColumns,
      (row) => row.id,
      { column: "date", direction: "descending" },
      2,
      10,
    );
    expect(activity.total).toBe(32);
    expect(activity.rows[0]?.id).toBe("move-21");
  });
  test("filters all movements by source identity, translated type and location", () => {
    expect(filterProjectStockMovements(movements, "Budi", "RESERVE", "Gudang A")).toHaveLength(16);
    expect(filterProjectStockMovements(movements, "pemakaian", "all", "all")).toHaveLength(16);
    expect(projectMovementLabel("RELEASE_RESERVATION")).toBe("Lepas reservasi");
  });
  test("distinguishes empty, restricted and unavailable without healthy-zero claims", () => {
    expect(html("ready", [])).toContain("Belum ada kebutuhan material");
    expect(html("missing")).toContain("Belum ada kebutuhan material");
    expect(html("restricted")).toContain("Akses stok dibatasi");
    expect(html("restricted")).not.toContain("Belum ada kebutuhan material");
    expect(html("unavailable")).toContain("Posisi material belum tersedia");
    expect(html("unavailable")).not.toContain("Belum ada kebutuhan material");
    expect(html()).not.toContain('aria-current="true"');
  });
  test("body skeleton matches both native table shapes and hides placeholders", () => {
    for (const activity of [false, true]) {
      const markup = renderToStaticMarkup(
        <WorkspacePresentationProvider presentation="desktop">
          <ProjectStockDesktopLoading activity={activity} />
        </WorkspacePresentationProvider>,
      );
      expect(markup).toContain('aria-busy="true"');
      expect(markup).toContain('aria-hidden="true"');
      expect(markup).toContain("stock-loading-row-9");
      expect(markup).toContain(activity ? "Gerakan" : "Perlu beli");
      expect(markup).not.toContain("xl:grid-cols-[minmax(0,1fr)_18rem]");
      const selected = renderToStaticMarkup(
        <WorkspacePresentationProvider presentation="desktop">
          <ProjectStockDesktopLoading activity={activity} showDetail />
        </WorkspacePresentationProvider>,
      );
      expect(selected).toContain("xl:grid-cols-[minmax(0,1fr)_18rem]");
    }
  });
});
