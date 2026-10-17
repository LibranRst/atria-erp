"use client";

import { useBrowserUrlSearchParam, updateBrowserUrl } from "@/lib/utils/use-url-search-param";
import type { RapOverviewFilter } from "../../types/rap-rab-types";

interface RapDesktopQuery {
  readonly search: string;
  readonly condition: string;
  readonly sort: string;
  readonly direction: "ascending" | "descending";
  readonly page: number;
  readonly pageSize: 10 | 25 | 50;
}

export function useRapDesktopQuery(kind: RapOverviewFilter): {
  readonly input: RapDesktopQuery;
  readonly update: (patch: Partial<RapDesktopQuery>) => void;
} {
  const prefix = `rap-${kind.toLowerCase()}-`;
  const search = useBrowserUrlSearchParam(`${prefix}search`) ?? "";
  const rawCondition = useBrowserUrlSearchParam(`${prefix}condition`);
  const condition =
    kind === "MATERIAL"
      ? rawCondition === "need" || rawCondition === "covered"
        ? rawCondition
        : "all"
      : rawCondition === "draft" || rawCondition === "ready"
        ? rawCondition
        : "all";
  const sort = useBrowserUrlSearchParam(`${prefix}sort`) ?? "name";
  const direction =
    useBrowserUrlSearchParam(`${prefix}direction`) === "descending" ? "descending" : "ascending";
  const page = Number(useBrowserUrlSearchParam(`${prefix}page`) ?? 1);
  const size = Number(useBrowserUrlSearchParam(`${prefix}pageSize`) ?? 10);
  return {
    input: {
      search,
      condition,
      sort,
      direction,
      page: Number.isSafeInteger(page) && page > 0 ? page : 1,
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
