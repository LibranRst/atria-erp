"use client";

import { useBrowserUrlSearchParam, updateBrowserUrl } from "@/lib/utils/use-url-search-param";

interface StockQuery {
  readonly search: string;
  readonly condition: string;
  readonly location: string;
  readonly sort: string;
  readonly direction: "ascending" | "descending";
  readonly page: number;
  readonly pageSize: 10 | 25 | 50;
}

export function useProjectStockQuery(kind: "materials" | "activity"): {
  readonly input: StockQuery;
  readonly update: (patch: Partial<StockQuery>) => void;
} {
  const prefix = `stock-${kind}-`;
  const search = useBrowserUrlSearchParam(`${prefix}search`) ?? "";
  const condition = useBrowserUrlSearchParam(`${prefix}condition`) ?? "all";
  const location = useBrowserUrlSearchParam(`${prefix}location`) ?? "all";
  const sort =
    useBrowserUrlSearchParam(`${prefix}sort`) ?? (kind === "materials" ? "name" : "date");
  const directionParam = useBrowserUrlSearchParam(`${prefix}direction`);
  const direction =
    directionParam === "ascending" || directionParam === "descending"
      ? directionParam
      : kind === "materials"
        ? "ascending"
        : "descending";
  const requestedPage = Number(useBrowserUrlSearchParam(`${prefix}page`) ?? 1);
  const size = Number(useBrowserUrlSearchParam(`${prefix}pageSize`) ?? 10);
  return {
    input: {
      search,
      condition,
      location,
      sort,
      direction,
      page: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
      pageSize: size === 25 || size === 50 ? size : 10,
    },
    update: (patch): void => {
      const url = new URL(window.location.href);
      for (const [field, value] of Object.entries({ ...patch, page: patch.page ?? 1 }))
        url.searchParams.set(`${prefix}${field}`, String(value));
      updateBrowserUrl(`${url.pathname}${url.search}${url.hash}`, "replace");
    },
  };
}
