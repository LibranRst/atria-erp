"use client";

import {
  reconciliationDesktopInputSchema,
  type ReconciliationDesktopInput,
  type ReconciliationDesktopData,
} from "@atria/core/finance/reconciliation-desktop";
import { useBrowserUrlSearchParam, updateBrowserUrl } from "@/lib/utils/use-url-search-param";
import type { ReconciliationView } from "../components/reconciliation-primitives";
import { readReconciliationDesktop } from "./reconciliation-read-client";
import { useRetainedQueryPages } from "@/lib/utils/use-retained-query-pages";
import type { ActionResponse } from "@atria/core/types/action-response";

type WorkspaceMetadata = Pick<ReconciliationDesktopData, "counts" | "bankAccounts" | "updatedAt">;

const views: readonly ReconciliationView[] = ["statement", "cash", "history"];

function readPage(key: string): Promise<ActionResponse<ReconciliationDesktopData>> {
  return readReconciliationDesktop(reconciliationDesktopInputSchema.parse(JSON.parse(key)));
}

export function useReconciliationDesktop({
  view,
  active,
  refreshToken,
  suspended,
}: {
  readonly view: ReconciliationView;
  readonly active: boolean;
  readonly refreshToken: object;
  readonly suspended: boolean;
}): {
  readonly input: ReconciliationDesktopInput;
  readonly data: ReconciliationDesktopData | null;
  readonly metadata: WorkspaceMetadata | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly accessDenied: boolean;
  readonly reload: () => void;
  readonly update: (patch: Partial<ReconciliationDesktopInput>) => void;
} {
  const search = useBrowserUrlSearchParam(`${view}-search`);
  const accountId = useBrowserUrlSearchParam(`${view}-accountId`);
  const direction = useBrowserUrlSearchParam(`${view}-direction`);
  const status = useBrowserUrlSearchParam(`${view}-status`);
  const sort = useBrowserUrlSearchParam(`${view}-sort`);
  const sortDirection = useBrowserUrlSearchParam(`${view}-sortDirection`);
  const page = useBrowserUrlSearchParam(`${view}-page`);
  const pageSize = useBrowserUrlSearchParam(`${view}-pageSize`);
  const parsed = reconciliationDesktopInputSchema.safeParse({
    view,
    search: search ?? "",
    accountId: accountId || undefined,
    direction: direction ?? "all",
    status: status ?? "all",
    sort: sort ?? "date",
    sortDirection: sortDirection ?? (view === "statement" ? "ascending" : "descending"),
    page: Number(page ?? 1),
    pageSize: Number(pageSize ?? 10),
  });
  const input = parsed.success ? parsed.data : reconciliationDesktopInputSchema.parse({ view });
  const key = JSON.stringify(input);
  const query = useRetainedQueryPages({
    slots: views,
    slot: view,
    queryKey: key,
    generation: refreshToken,
    enabled: active,
    suspended,
    read: readPage,
    errorMessage: "Data rekonsiliasi belum dapat dimuat. Coba lagi.",
  });
  return {
    input,
    data: query.data,
    metadata: query.data ?? query.previousData,
    loading: query.loading,
    error: query.error,
    accessDenied: query.accessDenied,
    reload: query.reload,
    update: (patch): void => {
      const url = new URL(window.location.href);
      for (const [field, value] of Object.entries({ ...patch, page: patch.page ?? 1 })) {
        if (value === undefined) url.searchParams.delete(`${view}-${field}`);
        else url.searchParams.set(`${view}-${field}`, String(value));
      }
      updateBrowserUrl(`${url.pathname}${url.search}${url.hash}`, "replace");
    },
  };
}
