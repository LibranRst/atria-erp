import type { MaterialOperationsDashboard } from "@/app/actions/material/operations-dashboard";
import type { MaterialShortageRow } from "@/app/actions/material/inventory";
import {
  getGroupedMaterialStockSummary,
  type GroupedMaterial,
  type GroupedMaterialStockSummary,
} from "../../utils/material-ui-utils";

export type StockComparison = {
  readonly id: string;
  readonly material: GroupedMaterial;
  readonly summary: GroupedMaterialStockSummary;
  readonly unit: string;
};
export type NeedComparison = MaterialShortageRow & {
  readonly id: string;
  readonly projectId: string | null;
  readonly projectName: string;
  readonly unit: string | null;
};

/** Filter locations before the canonical aggregation so displayed quantities describe that warehouse. */
export function materialStockComparisons(
  grouped: readonly GroupedMaterial[],
  location: string,
): readonly StockComparison[] {
  return grouped.flatMap((material) => {
    const rows =
      location === "ALL"
        ? material.rows
        : material.rows.filter((row) => row.locationId === location);
    if (!rows.length) return [];
    const scoped = { ...material, rows };
    return [
      {
        id: material.id,
        material: scoped,
        summary: getGroupedMaterialStockSummary(scoped),
        unit: rows[0]?.unit ?? "",
      },
    ];
  });
}

export function materialNeedComparisons(
  data: MaterialOperationsDashboard,
): readonly NeedComparison[] {
  const rapItems = new Map(
    data.projects.flatMap((project) =>
      project.rapItems.map((item) => [item.id, { project, item }] as const),
    ),
  );
  return data.shortages.map((row) => {
    const source = rapItems.get(row.projectRapItemId);
    return {
      ...row,
      id: row.projectRapItemId,
      projectId: row.projectId ?? source?.project.id ?? null,
      projectName: row.projectName ?? source?.project.name ?? "Proyek belum tersedia",
      unit: row.unit ?? source?.item.unit ?? null,
    };
  });
}
