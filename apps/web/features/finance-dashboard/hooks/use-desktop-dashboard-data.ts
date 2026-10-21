"use client";

import { z } from "zod";
import React from "react";
import {
  useCan,
  useCurrentUserProfile,
  usePermissions,
} from "@/components/auth/permissions-provider";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { useBrowserUrlSearchParam, updateBrowserUrl } from "@/lib/utils/use-url-search-param";
import { useRetainedQueryPages } from "@/lib/utils/use-retained-query-pages";
import { readDesktopDashboard, readDesktopCashFlow } from "./desktop-read-client";
import {
  dashboardDesktopInputSchema,
  type DashboardDesktopInput,
  type DashboardDesktopData,
} from "@atria/core/finance/dashboard-desktop";
import type { DashboardCashFlowTrend } from "@atria/core/finance/dashboard-cash-flow";
import type { DashboardPageTab } from "@atria/core/finance/dashboard-overview";
import type { ActionResponse } from "@atria/core/types/action-response";

type RetainedDashboardData = DashboardDesktopData | DashboardCashFlowTrend;
type DashboardSlot = DashboardDesktopInput["tab"] | "trend-6" | "trend-12";
const dashboardSlots: readonly DashboardSlot[] = [
  "approvals",
  "budget",
  "cash",
  "materials",
  "trend-6",
  "trend-12",
];
const dashboardQuerySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("table"), input: dashboardDesktopInputSchema }),
  z.object({ kind: z.literal("trend"), months: z.union([z.literal(6), z.literal(12)]) }),
]);
async function readDashboardQuery(key: string): Promise<ActionResponse<RetainedDashboardData>> {
  const request = dashboardQuerySchema.parse(JSON.parse(key));
  return request.kind === "trend"
    ? readDesktopCashFlow(request.months)
    : readDesktopDashboard(request.input);
}

export type DesktopDashboardTrendQuery = {
  readonly months: 6 | 12;
  readonly data: DashboardCashFlowTrend | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly change: (value: string) => void;
  readonly reload: () => void;
};
export type DesktopDashboardQuery = {
  readonly input: DashboardDesktopInput;
  readonly data: DashboardDesktopData | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly restricted: boolean;
  readonly update: (patch: Partial<DashboardDesktopInput>) => void;
  readonly reload: () => void;
  readonly trend: DesktopDashboardTrendQuery;
};
export function useDesktopDashboardData(
  tab: DashboardPageTab,
  stamp: Date,
  options: { readonly generation?: object | string | number; readonly suspended?: boolean } = {},
): DesktopDashboardQuery {
  const desktop = useWorkspacePresentation() === "desktop";
  const can = useCan();
  const user = useCurrentUserProfile();
  const permissions = usePermissions();
  const globalAccess = can("view:ledger") && user?.dataScope === "GLOBAL";
  const allowed =
    globalAccess &&
    (tab === "approvals"
      ? can("view:approval_queue")
      : tab === "budget"
        ? can("view:budget")
        : tab === "materials"
          ? can("view:inventory")
          : true);
  const fingerprint = JSON.stringify([
    user?.id,
    user?.sessionId,
    user?.dataScope,
    [...permissions].sort(),
  ]);
  const sourceGeneration = options.generation ?? stamp.toISOString();
  const generation = React.useMemo(
    () => ({ sourceGeneration, fingerprint }),
    [sourceGeneration, fingerprint],
  );
  const page = useBrowserUrlSearchParam(`${tab}-page`),
    size = useBrowserUrlSearchParam(`${tab}-pageSize`),
    search = useBrowserUrlSearchParam(`${tab}-search`),
    filter = useBrowserUrlSearchParam(`${tab}-filter`),
    bucket = useBrowserUrlSearchParam(`${tab}-bucket`),
    sort = useBrowserUrlSearchParam(`${tab}-sort`),
    direction = useBrowserUrlSearchParam(`${tab}-direction`);
  const months = useBrowserUrlSearchParam("trendMonths") === "12" ? 12 : 6;
  const tableTab = tab === "approvals" || tab === "cash" || tab === "materials" ? tab : "budget";
  const parsed = dashboardDesktopInputSchema.safeParse({
    tab: tableTab,
    page: Number(page ?? 1),
    pageSize: Number(size ?? 10),
    search: search ?? "",
    filter: filter ?? "all",
    bucket: bucket ?? "all",
    sort: sort ?? "priority",
    direction: direction ?? "ascending",
  });
  const input = parsed.success ? parsed.data : dashboardDesktopInputSchema.parse({ tab: tableTab });
  const overview = tab === "overview";
  const enabled = desktop && tab !== "accounts" && allowed;
  const slot: DashboardSlot = overview ? (months === 12 ? "trend-12" : "trend-6") : tableTab;
  const query = useRetainedQueryPages<DashboardSlot, RetainedDashboardData>({
    slots: dashboardSlots,
    slot,
    queryKey: JSON.stringify(overview ? { kind: "trend", months } : { kind: "table", input }),
    generation,
    enabled,
    suspended: options.suspended,
    read: readDashboardQuery,
    errorMessage: overview
      ? "Tren kas belum dapat dimuat."
      : "Daftar belum dapat dimuat. Coba lagi.",
  });
  const update = (patch: Partial<DashboardDesktopInput>): void => {
    const url = new URL(window.location.href);
    for (const [field, value] of Object.entries({ ...patch, page: patch.page ?? 1 }))
      url.searchParams.set(`${tab}-${field}`, String(value));
    updateBrowserUrl(`${url.pathname}${url.search}${url.hash}`, "replace");
  };
  return {
    input,
    data:
      allowed && query.data && "tab" in query.data && query.data.tab === tableTab
        ? query.data
        : null,
    loading: enabled && !overview && query.loading,
    error: !allowed
      ? "Izin untuk membuka bagian Dashboard ini tidak tersedia."
      : !overview
        ? query.error
        : null,
    restricted: !allowed,
    update,
    reload: query.reload,
    trend: {
      months,
      data:
        allowed && query.data && "months" in query.data && query.data.months === months
          ? query.data
          : null,
      loading: enabled && overview && query.loading,
      error: overview ? query.error : null,
      change: (value: string): void => {
        const url = new URL(window.location.href);
        url.searchParams.set("trendMonths", value === "12" ? "12" : "6");
        updateBrowserUrl(`${url.pathname}${url.search}${url.hash}`, "replace");
      },
      reload: query.reload,
    },
  };
}
