"use client";

import React from "react";
import { updateBrowserUrl, useBrowserUrlSearchParam } from "@/lib/utils/use-url-search-param";
import type { ApprovalFilter, ApprovalPriorityFilter } from "../utils/approval-desktop";

const sortKeys: readonly ApprovalDesktopSort[] = [
  "subject",
  "type",
  "requester",
  "amount",
  "date",
  "priority",
];
export type ApprovalDesktopSort = "subject" | "type" | "requester" | "amount" | "date" | "priority";
export type ApprovalDesktopQuery = {
  readonly search: string;
  readonly filter: ApprovalFilter;
  readonly project: string;
  readonly priority: ApprovalPriorityFilter;
  readonly sort: ApprovalDesktopSort;
  readonly direction: "ascending" | "descending";
  readonly page: number;
  readonly pageSize: 10 | 25 | 50;
};

/** Desktop history owns only its namespace; mobile controls keep their local state. */
export function useApprovalDesktopQuery(active: boolean): {
  readonly input: ApprovalDesktopQuery;
  readonly update: (patch: Partial<ApprovalDesktopQuery>) => void;
} {
  const search = useBrowserUrlSearchParam("approvals-search") ?? "";
  const rawFilter = useBrowserUrlSearchParam("approvals-filter");
  const project = useBrowserUrlSearchParam("approvals-project") ?? "";
  const rawPriority = useBrowserUrlSearchParam("approvals-priority");
  const rawSort = useBrowserUrlSearchParam("approvals-sort");
  const direction =
    useBrowserUrlSearchParam("approvals-direction") === "descending" ? "descending" : "ascending";
  const rawPage = Number(useBrowserUrlSearchParam("approvals-page") ?? 1);
  const rawSize = Number(useBrowserUrlSearchParam("approvals-pageSize") ?? 10);
  const filter =
    rawFilter === "FIELD" ||
    rawFilter === "VENDOR" ||
    rawFilter === "STOCK" ||
    rawFilter === "CRITICAL"
      ? rawFilter
      : "ALL";
  const priority =
    rawPriority === "CRITICAL" || rawPriority === "WARNING" || rawPriority === "NORMAL"
      ? rawPriority
      : "ALL";
  const sort = sortKeys.find((key) => key === rawSort) ?? "priority";
  const update = React.useCallback(
    (patch: Partial<ApprovalDesktopQuery>): void => {
      if (!active) return;
      const url = new URL(window.location.href);
      for (const [key, value] of Object.entries({ ...patch, page: patch.page ?? 1 }))
        url.searchParams.set(`approvals-${key}`, String(value));
      updateBrowserUrl(`${url.pathname}${url.search}${url.hash}`, "replace");
    },
    [active],
  );
  return {
    input: {
      search,
      filter,
      project,
      priority,
      sort,
      direction,
      page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
      pageSize: rawSize === 25 || rawSize === 50 ? rawSize : 10,
    },
    update,
  };
}
