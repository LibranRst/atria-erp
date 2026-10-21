"use client";

import type { ActionResponse } from "@atria/core/types/action-response";
import type { ZodType } from "zod";
import {
  materialDesktopActivityInputSchema,
  type MaterialDesktopActivityData,
  type MaterialDesktopActivityInput,
} from "@atria/core/material/material-desktop";
import { updateBrowserUrl, useBrowserUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { useRetainedQueryPages } from "@/lib/utils/use-retained-query-pages";
import { readMaterialDesktopActivity } from "./material-desktop-read-client";

export type MaterialDesktopActivityKind = MaterialDesktopActivityInput["kind"];
const activityKinds: readonly MaterialDesktopActivityKind[] = [
  "movements",
  "receipts",
  "transfers",
  "counts",
];

function readActivityPage(queryKey: string): Promise<ActionResponse<MaterialDesktopActivityData>> {
  return readMaterialDesktopActivity(
    materialDesktopActivityInputSchema.parse(JSON.parse(queryKey)),
  );
}
function displayValue<Value>(schema: ZodType<Value>, value: unknown, fallback: Value): Value {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

export function materialActivityKind(value: string | null): MaterialDesktopActivityKind {
  return value === "receipts" || value === "transfers" || value === "counts" ? value : "movements";
}

/** URL filters are per collection; stale responses cannot replace a newer request. */
export function useMaterialDesktopActivity({
  active,
  suspended,
  refreshToken,
}: {
  readonly active: boolean;
  readonly suspended: boolean;
  readonly refreshToken: object;
}): {
  readonly input: MaterialDesktopActivityInput;
  readonly searchValue: string;
  readonly data: MaterialDesktopActivityData | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly invalidInput: boolean;
  readonly reload: () => void;
  readonly changeKind: (kind: MaterialDesktopActivityKind) => void;
  readonly update: (patch: Partial<MaterialDesktopActivityInput>) => void;
} {
  const kind = materialActivityKind(useBrowserUrlSearchParam("activity-kind"));
  const prefix = `activity-${kind}`;
  const search = useBrowserUrlSearchParam(`${prefix}-search`);
  const projectId = useBrowserUrlSearchParam(`${prefix}-projectId`);
  const locationId = useBrowserUrlSearchParam(`${prefix}-locationId`);
  const period = useBrowserUrlSearchParam(`${prefix}-period`);
  const status = useBrowserUrlSearchParam(`${prefix}-status`);
  const sort = useBrowserUrlSearchParam(`${prefix}-sort`);
  const direction = useBrowserUrlSearchParam(`${prefix}-direction`);
  const page = useBrowserUrlSearchParam(`${prefix}-page`);
  const pageSize = useBrowserUrlSearchParam(`${prefix}-pageSize`);
  const parsed = materialDesktopActivityInputSchema.safeParse({
    kind,
    search: search ?? "",
    projectId: projectId || undefined,
    locationId: locationId || undefined,
    period: period ?? "all",
    status: status ?? "all",
    sort: sort ?? "date",
    direction: direction ?? "descending",
    page: Number(page ?? 1),
    pageSize: Number(pageSize ?? 10),
  });
  const fields = materialDesktopActivityInputSchema.shape;
  const input: MaterialDesktopActivityInput = parsed.success
    ? parsed.data
    : {
        kind,
        search: search ?? "",
        projectId: projectId || undefined,
        locationId: locationId || undefined,
        status: status ?? "all",
        period: displayValue(fields.period, period ?? "all", "all"),
        sort: displayValue(fields.sort, sort ?? "date", "date"),
        direction: displayValue(fields.direction, direction ?? "descending", "descending"),
        page: displayValue(fields.page, Number(page ?? 1), 1),
        pageSize: displayValue(fields.pageSize, Number(pageSize ?? 10), 10),
      };
  const key = JSON.stringify(input);
  const pageResult = useRetainedQueryPages<
    MaterialDesktopActivityKind,
    MaterialDesktopActivityData
  >({
    slots: activityKinds,
    slot: kind,
    queryKey: key,
    generation: refreshToken,
    enabled: active && parsed.success,
    suspended,
    read: readActivityPage,
    errorMessage: "Aktivitas material belum dapat dimuat. Coba lagi.",
  });
  return {
    input,
    searchValue: search ?? "",
    data: parsed.success && pageResult.data?.kind === kind ? pageResult.data : null,
    loading: parsed.success && pageResult.loading,
    error: parsed.success
      ? pageResult.error
      : "Filter aktivitas material tidak valid. Periksa atau reset pilihan.",
    invalidInput: !parsed.success,
    reload: pageResult.reload,
    changeKind: (next): void => {
      const url = new URL(window.location.href);
      url.searchParams.set("activity-kind", next);
      updateBrowserUrl(`${url.pathname}${url.search}${url.hash}`, "replace");
    },
    update: (patch): void => {
      const url = new URL(window.location.href);
      for (const [field, value] of Object.entries({ ...patch, page: patch.page ?? 1 })) {
        if (field === "kind") continue;
        if (value === undefined) url.searchParams.delete(`${prefix}-${field}`);
        else url.searchParams.set(`${prefix}-${field}`, String(value));
      }
      updateBrowserUrl(`${url.pathname}${url.search}${url.hash}`, "replace");
    },
  };
}
