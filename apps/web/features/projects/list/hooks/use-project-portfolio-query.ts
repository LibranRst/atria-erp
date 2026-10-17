"use client";

import { useBrowserUrlSearchParam, updateBrowserUrl } from "@/lib/utils/use-url-search-param";
import type {
  PortfolioFilters,
  PortfolioView,
  PortfolioHealth,
  PortfolioStatus,
} from "../utils/project-desktop-portfolio";

type PortfolioQuery = PortfolioFilters & {
  readonly sort: string;
  readonly direction: "ascending" | "descending";
  readonly page: number;
  readonly pageSize: 10 | 25 | 50;
};
function viewValue(raw: string | null): PortfolioView {
  return raw === "active" || raw === "setup" || raw === "attention" || raw === "closed"
    ? raw
    : "all";
}
function statusValue(raw: string | null): PortfolioStatus {
  return raw === "DRAFT" ||
    raw === "ACTIVE" ||
    raw === "ON_HOLD" ||
    raw === "COMPLETED" ||
    raw === "CANCELLED"
    ? raw
    : "ALL";
}
function healthValue(raw: string | null): PortfolioHealth {
  return raw === "HEALTHY" || raw === "WARNING" || raw === "CRITICAL" || raw === "MISSING"
    ? raw
    : "ALL";
}
export function useProjectPortfolioQuery(): {
  readonly input: PortfolioQuery;
  readonly update: (patch: Partial<PortfolioQuery>) => void;
} {
  const view = viewValue(useBrowserUrlSearchParam("portfolio-view"));
  const search = useBrowserUrlSearchParam("portfolio-search") ?? "";
  const client = useBrowserUrlSearchParam("portfolio-client") ?? "ALL";
  const pm = useBrowserUrlSearchParam("portfolio-pm") ?? "ALL";
  const status = statusValue(useBrowserUrlSearchParam("portfolio-status"));
  const health = healthValue(useBrowserUrlSearchParam("portfolio-health"));
  const sort = useBrowserUrlSearchParam("portfolio-sort") ?? "project";
  const direction =
    useBrowserUrlSearchParam("portfolio-direction") === "descending" ? "descending" : "ascending";
  const page = Number(useBrowserUrlSearchParam("portfolio-page") ?? 1);
  const size = Number(useBrowserUrlSearchParam("portfolio-pageSize") ?? 10);
  return {
    input: {
      view,
      search,
      client,
      pm,
      status,
      health,
      sort,
      direction,
      page: Number.isSafeInteger(page) && page > 0 ? page : 1,
      pageSize: size === 25 || size === 50 ? size : 10,
    },
    update: (patch): void => {
      const url = new URL(window.location.href);
      for (const [field, value] of Object.entries({ ...patch, page: patch.page ?? 1 }))
        url.searchParams.set(`portfolio-${field}`, String(value));
      updateBrowserUrl(`${url.pathname}${url.search}${url.hash}`, "replace");
    },
  };
}
