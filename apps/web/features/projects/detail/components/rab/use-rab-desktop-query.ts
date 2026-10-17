"use client";

import { useBrowserUrlSearchParam, updateBrowserUrl } from "@/lib/utils/use-url-search-param";

type RabTableQuery = {
  readonly search: string;
  readonly kind: string;
  readonly visibility: string;
  readonly sort: string;
  readonly direction: "ascending" | "descending";
  readonly page: number;
  readonly pageSize: 10 | 25 | 50;
};

export function useRabDesktopQuery(prefix: "rab-lines" | "rab-history" | "rab-orders"): {
  readonly input: RabTableQuery;
  readonly update: (patch: Partial<RabTableQuery>) => void;
} {
  const search = useBrowserUrlSearchParam(`${prefix}-search`) ?? "";
  const kind = useBrowserUrlSearchParam(`${prefix}-kind`) ?? "all";
  const visibility = useBrowserUrlSearchParam(`${prefix}-visibility`) ?? "all";
  const sort = useBrowserUrlSearchParam(`${prefix}-sort`) ?? "order";
  const direction =
    useBrowserUrlSearchParam(`${prefix}-direction`) === "descending" ? "descending" : "ascending";
  const page = Number(useBrowserUrlSearchParam(`${prefix}-page`) ?? 1);
  const pageSize = Number(useBrowserUrlSearchParam(`${prefix}-pageSize`) ?? 10);
  return {
    input: {
      search,
      kind,
      visibility,
      sort,
      direction,
      page: Number.isSafeInteger(page) && page > 0 ? page : 1,
      pageSize: pageSize === 25 || pageSize === 50 ? pageSize : 10,
    },
    update: (patch): void => {
      const url = new URL(window.location.href);
      for (const [field, value] of Object.entries({ ...patch, page: patch.page ?? 1 }))
        url.searchParams.set(`${prefix}-${field}`, String(value));
      updateBrowserUrl(`${url.pathname}${url.search}${url.hash}`, "replace");
    },
  };
}
