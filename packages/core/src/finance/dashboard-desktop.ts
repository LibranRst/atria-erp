import { z } from "zod";
import type { ApprovalDetail } from "./approval-types";
import type {
  FinanceDashboardCashDueItem,
  FinanceDashboardMaterialIssue,
} from "./dashboard-contracts";
import type { FinanceDashboardRiskyProject } from "./dashboard-overview";

export const dashboardDesktopInputSchema = z
  .object({
    tab: z.enum(["approvals", "budget", "cash", "materials"]),
    page: z.number().int().min(1).default(1),
    pageSize: z.union([z.literal(10), z.literal(25), z.literal(50)]).default(10),
    search: z.string().trim().max(120).default(""),
    filter: z.string().max(30).default("all"),
    bucket: z.enum(["all", "OVERDUE", "TODAY", "NEXT_7_DAYS", "LATER"]).default("all"),
    sort: z.enum(["priority", "name", "amount", "date", "remaining", "margin"]).default("priority"),
    direction: z.enum(["ascending", "descending"]).default("ascending"),
  })
  .superRefine((input, ctx) => {
    const filters = {
      approvals: ["all", "project_cost", "vendor_payment", "inventory_opening"],
      budget: ["all", "HEALTHY", "WARNING", "CRITICAL"],
      cash: ["all", "payable", "receivable"],
      materials: ["all", "RAP_SHORTAGE", "LOW_STOCK", "REVERSAL_REQUEST", "WASTE", "ADJUSTMENT"],
    };
    if (!filters[input.tab].includes(input.filter))
      ctx.addIssue({
        code: "custom",
        path: ["filter"],
        message: "Filter tidak tersedia untuk tab ini.",
      });
    const sorts = {
      approvals: ["priority", "name", "amount", "date"],
      budget: ["priority", "name", "amount", "remaining", "margin"],
      cash: ["priority", "name", "amount", "date"],
      materials: ["priority", "name", "amount", "date"],
    };
    if (!sorts[input.tab].includes(input.sort))
      ctx.addIssue({
        code: "custom",
        path: ["sort"],
        message: "Urutan tidak tersedia untuk tab ini.",
      });
  });
export type DashboardDesktopInput = z.infer<typeof dashboardDesktopInputSchema>;
export type DashboardDesktopRequest = z.input<typeof dashboardDesktopInputSchema>;
export type DashboardDesktopRow =
  | ApprovalDetail
  | FinanceDashboardRiskyProject
  | FinanceDashboardCashDueItem
  | FinanceDashboardMaterialIssue;
export type DashboardDesktopPage<T extends DashboardDesktopRow = DashboardDesktopRow> = {
  readonly tab: DashboardDesktopInput["tab"];
  readonly rows: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: 10 | 25 | 50;
  readonly generatedAt: Date;
  readonly dataQuality: {
    readonly partial: boolean;
    readonly unavailableSources: readonly string[];
  };
};
export type DashboardDesktopData =
  | (DashboardDesktopPage<ApprovalDetail> & { readonly tab: "approvals" })
  | (DashboardDesktopPage<FinanceDashboardRiskyProject> & { readonly tab: "budget" })
  | (DashboardDesktopPage<FinanceDashboardCashDueItem> & { readonly tab: "cash" })
  | (DashboardDesktopPage<FinanceDashboardMaterialIssue> & { readonly tab: "materials" });

export function paginateDashboardRows<T extends DashboardDesktopRow>(
  rows: readonly T[],
  input: DashboardDesktopInput,
  key: (row: T) => string,
  searchable: (row: T) => string,
  filter: (row: T) => boolean,
  value: (row: T) => string | number,
): { readonly rows: readonly T[]; readonly total: number; readonly page: number } {
  const matches = rows.filter(
    (row) =>
      filter(row) &&
      searchable(row).toLocaleLowerCase("id-ID").includes(input.search.toLocaleLowerCase("id-ID")),
  );
  const collator = new Intl.Collator("id-ID", { numeric: true, sensitivity: "base" });
  const sorted = [...matches].sort((a, b) => {
    const av = value(a),
      bv = value(b);
    const comparison =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : collator.compare(String(av), String(bv));
    return comparison * (input.direction === "descending" ? -1 : 1) || key(a).localeCompare(key(b));
  });
  const page = Math.min(input.page, Math.max(1, Math.ceil(sorted.length / input.pageSize)));
  return {
    rows: sorted.slice((page - 1) * input.pageSize, page * input.pageSize),
    total: matches.length,
    page,
  };
}
