"use client";

import { useBrowserUrlSearchParam, updateBrowserUrl } from "@/lib/utils/use-url-search-param";

type MaterialCollection = "inventory" | "needs";
export type MaterialDesktopQuery = {
  readonly search: string;
  readonly location: string;
  readonly status: string;
  readonly project: string;
  readonly sort: string;
  readonly direction: "ascending" | "descending";
  readonly page: number;
  readonly pageSize: number;
};

/** Material comparison controls keep their own canonical URL state, separate from operation drafts. */
export function useMaterialDesktopQuery(view: MaterialCollection): {
  readonly input: MaterialDesktopQuery;
  readonly update: (patch: Partial<MaterialDesktopQuery>) => void;
} {
  const search = useBrowserUrlSearchParam(`${view}-search`) ?? "";
  const location = useBrowserUrlSearchParam(`${view}-location`) ?? "ALL";
  const status = useBrowserUrlSearchParam(`${view}-status`) ?? "ALL";
  const project = useBrowserUrlSearchParam(`${view}-project`) ?? "ALL";
  const sort = useBrowserUrlSearchParam(`${view}-sort`) ?? "name";
  const direction =
    useBrowserUrlSearchParam(`${view}-direction`) === "descending" ? "descending" : "ascending";
  const requestedPage = Number(useBrowserUrlSearchParam(`${view}-page`) ?? 1);
  const requestedSize = Number(useBrowserUrlSearchParam(`${view}-pageSize`) ?? 10);
  return {
    input: {
      search,
      location,
      status,
      project,
      sort,
      direction,
      page: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
      pageSize: requestedSize === 25 || requestedSize === 50 ? requestedSize : 10,
    },
    update: (patch): void => {
      const url = new URL(window.location.href);
      for (const [field, value] of Object.entries({ ...patch, page: patch.page ?? 1 }))
        url.searchParams.set(`${view}-${field}`, String(value));
      updateBrowserUrl(`${url.pathname}${url.search}${url.hash}`, "replace");
    },
  };
}
