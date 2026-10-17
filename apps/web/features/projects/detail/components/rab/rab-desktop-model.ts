import type { RabBundleView, RabEstimateView, RabItemView } from "../../types/rap-rab-types";

export type RabDesktopRow =
  | {
      readonly key: string;
      readonly kind: "bundle";
      readonly position: number;
      readonly clientVisible: boolean;
      readonly record: RabBundleView;
    }
  | {
      readonly key: string;
      readonly kind: "item";
      readonly position: number;
      readonly clientVisible: boolean;
      readonly record: RabItemView;
    };

export type RabDesktopKind =
  "all" | "bundle" | "material" | "package" | "manual" | "service" | "members";
export type RabDesktopVisibility = "all" | "visible" | "hidden";

/** Presentation copies only: browsing never rewrites displayOrder or export inputs. */
export function buildRabDesktopRows(estimate: RabEstimateView): readonly RabDesktopRow[] {
  const records: readonly RabDesktopRow[] = [
    ...estimate.bundles.map((record): RabDesktopRow => ({
      key: `bundle:${record.id}`,
      kind: "bundle",
      record,
      position: 0,
      clientVisible: !record.isHidden,
    })),
    ...estimate.items.map((record): RabDesktopRow => ({
      key: `item:${record.id}`,
      kind: "item",
      record,
      position: 0,
      clientVisible:
        !record.isHidden &&
        (!record.bundleId ||
          estimate.bundles.some((bundle) => bundle.id === record.bundleId && !bundle.isHidden)),
    })),
  ];
  return [...records]
    .sort((a, b) => a.record.displayOrder - b.record.displayOrder)
    .map((row, position): RabDesktopRow =>
      row.kind === "bundle"
        ? { ...row, kind: "bundle", record: row.record, position }
        : { ...row, kind: "item", record: row.record, position },
    );
}

export function rabDesktopRowType(row: RabDesktopRow): string {
  if (row.kind === "bundle") return "Paket RAB";
  if (row.record.bundleId) return "Item dalam paket";
  if (row.record.itemNature === "SERVICE_FEE") return "Jasa & fee";
  if (row.record.sourceType === "RAP_MATERIAL") return "Material";
  if (row.record.sourceType === "CATEGORY_PLAN") return "Paket kerja";
  return "Manual";
}

export function filterRabDesktopRows(
  rows: readonly RabDesktopRow[],
  input: {
    readonly search: string;
    readonly kind: RabDesktopKind;
    readonly visibility: RabDesktopVisibility;
  },
): readonly RabDesktopRow[] {
  const search = input.search.trim().toLocaleLowerCase("id-ID");
  return rows.filter((row): boolean => {
    const member = row.kind === "item" && Boolean(row.record.bundleId);
    if (input.kind === "members" ? !member : member) return false;
    if (input.kind === "bundle" && row.kind !== "bundle") return false;
    if (
      input.kind === "material" &&
      (row.kind !== "item" ||
        row.record.sourceType !== "RAP_MATERIAL" ||
        row.record.itemNature === "SERVICE_FEE")
    )
      return false;
    if (
      input.kind === "package" &&
      (row.kind !== "item" ||
        row.record.sourceType !== "CATEGORY_PLAN" ||
        row.record.itemNature === "SERVICE_FEE")
    )
      return false;
    if (
      input.kind === "service" &&
      (row.kind !== "item" || row.record.itemNature !== "SERVICE_FEE")
    )
      return false;
    if (
      input.kind === "manual" &&
      (row.kind !== "item" ||
        row.record.itemNature === "SERVICE_FEE" ||
        row.record.sourceType === "RAP_MATERIAL" ||
        row.record.sourceType === "CATEGORY_PLAN")
    )
      return false;
    if (input.visibility === "hidden" && row.clientVisible) return false;
    if (input.visibility === "visible" && !row.clientVisible) return false;
    return (
      !search ||
      [
        row.record.clientLabel,
        row.record.description ?? "",
        row.record.unit,
        rabDesktopRowType(row),
      ]
        .join(" ")
        .toLocaleLowerCase("id-ID")
        .includes(search)
    );
  });
}

export function rabDesktopContext(
  rows: readonly RabDesktopRow[],
  selectedKey: string | null,
): RabDesktopRow | null {
  return rows.find((row) => row.key === selectedKey) ?? null;
}
