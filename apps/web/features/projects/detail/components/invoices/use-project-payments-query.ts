"use client";
import { useBrowserUrlSearchParam, updateBrowserUrl } from "@/lib/utils/use-url-search-param";
import {
  projectPaymentsQueryUrl,
  type ProjectPaymentsQuery,
  type ProjectPaymentsView,
} from "./project-payments-desktop-model";

export function useProjectPaymentsQuery(kind: ProjectPaymentsView): {
  readonly input: ProjectPaymentsQuery;
  readonly update: (patch: Partial<ProjectPaymentsQuery>) => void;
} {
  const prefix = kind === "invoices" ? "project-invoices-" : "project-receipts-";
  const search = useBrowserUrlSearchParam(`${prefix}search`) ?? "";
  const statusValue = useBrowserUrlSearchParam(`${prefix}status`) ?? "all";
  const dateValue = useBrowserUrlSearchParam(`${prefix}date`) ?? "all";
  const sortValue =
    useBrowserUrlSearchParam(`${prefix}sort`) ?? (kind === "invoices" ? "due" : "date");
  const directionValue = useBrowserUrlSearchParam(`${prefix}direction`);
  const pageValue = Number(useBrowserUrlSearchParam(`${prefix}page`) ?? 1);
  const sizeValue = Number(useBrowserUrlSearchParam(`${prefix}pageSize`) ?? 10);
  return {
    input: {
      search,
      status: ["all", "active", "UNPAID", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID"].includes(
        statusValue,
      )
        ? statusValue
        : "all",
      date: ["all", "this-month", "last-month"].includes(dateValue) ? dateValue : "all",
      sort: (kind === "invoices"
        ? ["invoice", "due", "amount", "paid", "remaining", "status"]
        : ["date", "invoice", "reference", "amount"]
      ).includes(sortValue)
        ? sortValue
        : kind === "invoices"
          ? "due"
          : "date",
      direction:
        directionValue === "ascending" || directionValue === "descending"
          ? directionValue
          : kind === "invoices"
            ? "ascending"
            : "descending",
      page: Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1,
      pageSize: sizeValue === 25 || sizeValue === 50 ? sizeValue : 10,
    },
    update: (patch): void =>
      updateBrowserUrl(projectPaymentsQueryUrl(window.location.href, kind, patch), "replace"),
  };
}
