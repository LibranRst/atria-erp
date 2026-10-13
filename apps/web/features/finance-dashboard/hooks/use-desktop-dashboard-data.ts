"use client";
import React from "react";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { useBrowserUrlSearchParam, updateBrowserUrl } from "@/lib/utils/use-url-search-param";
import { readDesktopDashboard, readDesktopCashFlow } from "./desktop-read-client";
import {
  dashboardDesktopInputSchema,
  type DashboardDesktopInput,
  type DashboardDesktopData,
} from "@atria/core/finance/dashboard-desktop";
import type { DashboardCashFlowTrend } from "@atria/core/finance/dashboard-cash-flow";
import type { DashboardPageTab } from "@atria/core/finance/dashboard-overview";

export type DesktopDashboardQuery = {
  readonly input: DashboardDesktopInput;
  readonly data: DashboardDesktopData | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly update: (patch: Partial<DashboardDesktopInput>) => void;
  readonly reload: () => void;
};
export function useDesktopDashboardData(tab: DashboardPageTab, stamp: Date): DesktopDashboardQuery {
  const desktop = useWorkspacePresentation() === "desktop";
  const page = useBrowserUrlSearchParam(`${tab}-page`),
    size = useBrowserUrlSearchParam(`${tab}-pageSize`),
    search = useBrowserUrlSearchParam(`${tab}-search`),
    filter = useBrowserUrlSearchParam(`${tab}-filter`),
    bucket = useBrowserUrlSearchParam(`${tab}-bucket`),
    sort = useBrowserUrlSearchParam(`${tab}-sort`),
    direction = useBrowserUrlSearchParam(`${tab}-direction`);
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
  const key = JSON.stringify(input),
    enabled = desktop && tab !== "overview" && tab !== "accounts";
  const [revision, setRevision] = React.useState(0);
  const [state, setState] = React.useState<{
    key: string;
    data: DashboardDesktopData | null;
    error: string | null;
    loading: boolean;
  }>({ key: "", data: null, error: null, loading: true });
  const generatedAt = stamp.toISOString();
  const requestKey = `${key}:${generatedAt}:${revision}`;
  React.useEffect(() => {
    if (!enabled) return;
    let current = true;
    const request: DashboardDesktopInput = dashboardDesktopInputSchema.parse(JSON.parse(key));
    void readDesktopDashboard(request)
      .then((result) => {
        if (!current) return;
        setState({
          key: requestKey,
          data: result.success ? result.data : null,
          error: result.success ? null : result.error.message,
          loading: false,
        });
      })
      .catch(() => {
        if (current)
          setState({
            key: requestKey,
            data: null,
            error: "Daftar belum dapat dimuat. Coba lagi.",
            loading: false,
          });
      });
    return () => {
      current = false;
    };
  }, [enabled, key, requestKey]);
  const update = (patch: Partial<DashboardDesktopInput>): void => {
    const url = new URL(window.location.href);
    for (const [field, value] of Object.entries({ ...patch, page: patch.page ?? 1 }))
      url.searchParams.set(`${tab}-${field}`, String(value));
    updateBrowserUrl(`${url.pathname}${url.search}${url.hash}`, "replace");
  };
  return {
    input,
    data: state.key === requestKey ? state.data : null,
    loading: enabled && state.key !== requestKey,
    error: state.key === requestKey ? state.error : null,
    update,
    reload: () => setRevision((v) => v + 1),
  };
}

export function useDashboardCashFlow(stamp: Date): {
  readonly months: 6 | 12;
  readonly data: DashboardCashFlowTrend | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly change: (value: string) => void;
  readonly reload: () => void;
} {
  const months = useBrowserUrlSearchParam("trendMonths") === "12" ? 12 : 6;
  const [revision, setRevision] = React.useState(0);
  const [state, setState] = React.useState<{
    requestKey: string;
    months: 6 | 12;
    data: DashboardCashFlowTrend | null;
    loading: boolean;
    error: string | null;
  }>({ requestKey: "", months, data: null, loading: true, error: null });
  const generatedAt = stamp.toISOString();
  const requestKey = `${months}:${generatedAt}:${revision}`;
  React.useEffect(() => {
    let current = true;
    void readDesktopCashFlow(months)
      .then((result) => {
        if (current)
          setState({
            requestKey,
            months,
            data: result.success ? result.data : null,
            loading: false,
            error: result.success ? null : result.error.message,
          });
      })
      .catch(() => {
        if (current)
          setState({
            requestKey,
            months,
            data: null,
            loading: false,
            error: "Tren kas belum dapat dimuat.",
          });
      });
    return () => {
      current = false;
    };
  }, [months, requestKey]);
  return {
    months,
    data: state.requestKey === requestKey ? state.data : null,
    loading: state.requestKey !== requestKey,
    error: state.requestKey === requestKey ? state.error : null,
    change: (value: string): void => {
      const url = new URL(window.location.href);
      url.searchParams.set("trendMonths", value === "12" ? "12" : "6");
      updateBrowserUrl(`${url.pathname}${url.search}${url.hash}`, "replace");
    },
    reload: () => setRevision((v) => v + 1),
  };
}
