import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import { requestTypedBackendOperation } from "@atria/api-client";
import { createUnifiedFixtureAPI, QA_BRIDGE_SECRET } from "@/e2e/unified-fixture-api";
import type { FinanceDashboardOverview } from "@atria/core/finance/dashboard-contracts";
import type { ApprovalDetail } from "@atria/core/finance/approval-types";
import type {
  DashboardDesktopData,
  DashboardDesktopInput,
} from "@atria/core/finance/dashboard-desktop";
import {
  buildCashFlowTrend,
  type DashboardCashFlowTrend,
} from "@atria/core/finance/dashboard-cash-flow";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { PermissionKey } from "@atria/core/auth/permissions";

const browser = new Window({
  url: "https://atria.test/ledger?tab=approvals&cash-search=kept#review",
  width: 1440,
  height: 976,
});
Reflect.set(browser.Element.prototype, "animate", undefined);
for (const key of [
  "window",
  "document",
  "navigator",
  "performance",
  "CSS",
  "HTMLElement",
  "HTMLAnchorElement",
  "HTMLButtonElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "HTMLSelectElement",
  "Element",
  "Node",
  "NodeList",
  "HTMLCollection",
  "NodeFilter",
  "Event",
  "CustomEvent",
  "FocusEvent",
  "MouseEvent",
  "PointerEvent",
  "KeyboardEvent",
  "SVGElement",
  "MutationObserver",
  "ResizeObserver",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
]) {
  const value: unknown = key === "window" ? browser : Reflect.get(browser, key);
  Reflect.set(
    globalThis,
    key,
    typeof value === "function" &&
      ["getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"].includes(key)
      ? value.bind(browser)
      : value,
  );
}
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
const navigation = await import("next/navigation");
let refreshCalls = 0;
const router: ReturnType<typeof navigation.useRouter> = {
  bfcacheId: "dashboard-tab-retention",
  back: (): void => {},
  forward: (): void => {},
  refresh: (): void => {
    refreshCalls++;
  },
  push: (): void => {},
  replace: (): void => {},
  prefetch: (): void => {},
};
mock.module("next/navigation", (): typeof navigation => ({
  ...navigation,
  usePathname: (): string => "/ledger",
  useRouter: () => router,
}));
type TableRead = {
  readonly input: DashboardDesktopInput;
  readonly resolve: (result: ActionResponse<DashboardDesktopData>) => void;
};
type TrendRead = {
  readonly months: 6 | 12;
  readonly resolve: (result: ActionResponse<DashboardCashFlowTrend>) => void;
};
const tableReads: TableRead[] = [],
  trendReads: TrendRead[] = [];
mock.module("./desktop-read-client", () => ({
  readDesktopDashboard: (
    input: DashboardDesktopInput,
  ): Promise<ActionResponse<DashboardDesktopData>> =>
    new Promise((resolve) => tableReads.push({ input, resolve })),
  readDesktopCashFlow: (months: 6 | 12): Promise<ActionResponse<DashboardCashFlowTrend>> =>
    new Promise((resolve) => trendReads.push({ months, resolve })),
}));
const api = createUnifiedFixtureAPI();
const { envelope } = await requestTypedBackendOperation({
  connection: { origin: "http://fixture.invalid", bridgeSecret: QA_BRIDGE_SECRET, timeoutMs: 1000 },
  operation: "app/actions/finance/dashboard-overview.getFinanceDashboardOverview",
  args: [],
  headers: new Headers({ cookie: "better-auth.session_token=qa-fixture-session" }),
  fetcher: (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
    api.fetch(new Request(input, init)),
});
if (!envelope.ok || !envelope.data.success) throw new Error("Dashboard fixture unavailable");
let snapshot: FinanceDashboardOverview = { ...envelope.data.data, generatedAt: new Date() };
const { createRoot } = await import("react-dom/client");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { DesktopUIProvider } = await import("@/components/ui");
const { PermissionsProvider } = await import("@/components/auth/permissions-provider");
const { FinanceDashboard } = await import("../components/workspaces/finance-dashboard");
const { updateBrowserUrl } = await import("@/lib/utils/use-url-search-param");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
const ownerPermissions: readonly PermissionKey[] = [
  "view:ledger",
  "view:approval_queue",
  "view:project",
  "view:budget",
  "view:inventory",
  "view:bank_account",
  "view:cost",
  "view:vendor_bill",
];
let currentPermissions = ownerPermissions;
function Fixture({ mobile = false }: { readonly mobile?: boolean }): React.JSX.Element {
  return (
    <WorkspacePresentationProvider presentation={mobile ? "mobile" : "desktop"}>
      <DesktopUIProvider responsive>
        <PermissionsProvider
          permissions={currentPermissions}
          user={{ id: "dashboard-owner", name: "Owner fixture", image: null, dataScope: "GLOBAL" }}
        >
          <FinanceDashboard data={snapshot} userName="Owner fixture" setup={null} />
        </PermissionsProvider>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
async function settle(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
  });
}
async function render(mobile = false): Promise<void> {
  await act(async (): Promise<void> => root.render(<Fixture mobile={mobile} />));
  await settle();
}
async function query(patch: Readonly<Record<string, string | null>>): Promise<void> {
  await act(async (): Promise<void> => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
    updateBrowserUrl(`${url.pathname}${url.search}${url.hash}`, "replace");
  });
  await settle();
}
async function tab(label: string): Promise<void> {
  const target = [...host.querySelectorAll<HTMLElement>('[role="tab"]')].find((item) =>
    item.textContent?.startsWith(label),
  );
  assert.ok(target, label);
  await act(async (): Promise<void> => target.click());
  await settle();
}
function latestTable(): TableRead {
  const read = tableReads.at(-1);
  assert.ok(read);
  return read;
}
function latestTrend(): TrendRead {
  const read = trendReads.at(-1);
  assert.ok(read);
  return read;
}
function approval(description: string): ApprovalDetail {
  return {
    id: "approval-cache",
    type: "project_cost",
    referenceId: "cost-cache",
    createdAt: snapshot.generatedAt,
    dueDate: null,
    notes: null,
    amount: 1250000.25,
    description,
    receiptImageUrl: null,
    projectName: "Proyek fixture",
    budgetItemName: "Material",
    allocatedAmount: 2000000,
    actualSpent: 0,
    requestedBy: "PM fixture",
    priority: "NORMAL",
    priorityReason: "Sesuai budget",
    budgetOverrun: false,
    consumesBudgetActual: true,
  };
}
async function answerTable(
  read: TableRead,
  marker = "Pengajuan terverifikasi dari fixture",
): Promise<void> {
  const base = {
    rows: [],
    total: 0,
    page: read.input.page,
    pageSize: read.input.pageSize,
    generatedAt: snapshot.generatedAt,
    dataQuality: { partial: false, unavailableSources: [] },
  };
  let data: DashboardDesktopData;
  switch (read.input.tab) {
    case "approvals":
      data = { ...base, tab: "approvals", rows: [approval(marker)], total: 1 };
      break;
    case "budget":
      data = { ...base, tab: "budget" };
      break;
    case "cash":
      data = { ...base, tab: "cash" };
      break;
    case "materials":
      data = { ...base, tab: "materials" };
      break;
  }
  await act(async (): Promise<void> => read.resolve({ success: true, data }));
  await settle();
}
async function answerTrend(read: TrendRead): Promise<void> {
  await act(async (): Promise<void> =>
    read.resolve({
      success: true,
      data: buildCashFlowTrend(read.months, snapshot.generatedAt, []),
    }),
  );
  await settle();
}
function tableLoading(): Element | null {
  return host.querySelector('[data-dashboard-skeleton="table"]');
}
function trendLoading(): Element | null {
  return host.querySelector('[aria-label="Memuat tren kas"]');
}
function readCount(): number {
  return tableReads.length + trendReads.length;
}

await render();
assert.equal(latestTable().input.tab, "approvals");
assert.ok(tableLoading());
await answerTable(latestTable());
for (const [label, expected] of [
  ["Budget", "budget"],
  ["Jatuh Tempo", "cash"],
  ["Material", "materials"],
]) {
  await tab(label!);
  assert.equal(latestTable().input.tab, expected);
  assert.ok(tableLoading());
  await answerTable(latestTable());
}
const fourTables = readCount();
await tab("Persetujuan");
assert.equal(readCount(), fourTables);
assert.equal(tableLoading(), null);
assert.match(host.textContent ?? "", /Pengajuan terverifikasi dari fixture/);
await tab("Ringkasan");
assert.equal(latestTrend().months, 6);
assert.ok(trendLoading());
await answerTrend(latestTrend());
await query({ trendMonths: "12" });
assert.equal(latestTrend().months, 12);
await answerTrend(latestTrend());
const allSlots = readCount();
await tab("Budget");
await tab("Ringkasan");
assert.equal(
  readCount(),
  allSlots,
  "overview remount reuses its completed trend from the persistent Dashboard owner",
);
assert.equal(trendLoading(), null);
await query({ trendMonths: "6" });
assert.equal(readCount(), allSlots, "6 and 12 months occupy separate retained slots");
await tab("Persetujuan");
await query({ "approvals-search": "old query" });
const stale = latestTable();
await query({ "approvals-search": "new query", "approvals-page": "2" });
const newest = latestTable();
assert.equal(newest.input.page, 2);
assert.equal(newest.input.search, "new query");
await answerTable(newest, "Hasil query terbaru");
await answerTable(stale, "Hasil lama terlambat");
assert.match(host.textContent ?? "", /Hasil query terbaru/);
assert.doesNotMatch(host.textContent ?? "", /Hasil lama terlambat/);
const beforeRevisit = readCount();
await tab("Jatuh Tempo");
assert.equal(latestTable().input.tab, "approvals");
await tab("Persetujuan");
assert.equal(readCount(), beforeRevisit);
assert.equal(tableLoading(), null);
assert.equal(new URLSearchParams(window.location.search).get("cash-search"), "kept");
assert.equal(window.location.hash, "#review");

snapshot = { ...snapshot, generatedAt: new Date(snapshot.generatedAt.getTime() + 1000) };
await render();
assert.ok(tableLoading());
assert.equal(readCount(), beforeRevisit + 1);
await answerTable(latestTable());
await tab("Ringkasan");
assert.equal(
  readCount(),
  beforeRevisit + 2,
  "new server generation invalidates trend and table pages together",
);
await answerTrend(latestTrend());
const refresh = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
  (item) => item.textContent?.trim() === "Segarkan",
);
assert.ok(refresh);
const beforeRefresh = readCount();
await act(async (): Promise<void> => refresh.click());
await settle();
assert.equal(refreshCalls, 1);
assert.equal(readCount(), beforeRefresh + 1);
await answerTrend(latestTrend());
await tab("Budget");
assert.equal(
  readCount(),
  beforeRefresh + 2,
  "manual snapshot refresh immediately invalidates other retained collections",
);
await answerTable(latestTable());

const beforeMobile = readCount();
await render(true);
await query({ tab: "approvals", "approvals-search": "mobile query" });
assert.equal(readCount(), beforeMobile, "mobile presentation issues no desktop reads");
await render();
assert.equal(readCount(), beforeMobile + 1);
await answerTable(latestTable());
await query({ "approvals-search": "failed query" });
await act(async (): Promise<void> =>
  latestTable().resolve({
    success: false,
    error: { code: "INTERNAL_SERVER_ERROR", message: "Sumber pengajuan belum tersedia." },
  }),
);
await settle();
assert.match(host.textContent ?? "", /Sumber pengajuan belum tersedia/);
assert.doesNotMatch(host.textContent ?? "", /Pengajuan terverifikasi dari fixture/);
const beforeErrorReturn = readCount();
await tab("Budget");
await tab("Persetujuan");
assert.equal(readCount(), beforeErrorReturn);
assert.match(host.textContent ?? "", /Sumber pengajuan belum tersedia/);
const retry = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
  (item) => item.textContent?.trim() === "Coba lagi",
);
assert.ok(retry);
await act(async (): Promise<void> => retry.click());
await settle();
await answerTable(latestTable());
await tab("Ringkasan");
assert.ok(trendLoading(), "table retry invalidates the trend slot as well");
await act(async (): Promise<void> =>
  latestTrend().resolve({
    success: false,
    error: { code: "FORBIDDEN", message: "Akses Dashboard telah berubah." },
  }),
);
await settle();
const deniedReads = readCount();
await tab("Persetujuan");
assert.equal(readCount(), deniedReads, "trend denial also blocks cached table sources");
assert.match(host.textContent ?? "", /Akses Dashboard telah berubah/);
assert.doesNotMatch(host.textContent ?? "", /Pengajuan terverifikasi dari fixture/);

currentPermissions = ["view:ledger", "view:approval_queue"];
await render();
await answerTable(latestTable());
await tab("Ringkasan");
await answerTrend(latestTrend());
const partialRoleReads = readCount();
const budgetTab = [...host.querySelectorAll<HTMLElement>('[role="tab"]')].find((item) =>
  item.textContent?.startsWith("Budget"),
);
const materialTab = [...host.querySelectorAll<HTMLElement>('[role="tab"]')].find((item) =>
  item.textContent?.startsWith("Material"),
);
assert.ok(budgetTab);
assert.ok(materialTab);
assert.equal(budgetTab.getAttribute("aria-disabled"), "true");
assert.equal(materialTab.getAttribute("aria-disabled"), "true");
await tab("Budget");
await tab("Material");
assert.equal(
  readCount(),
  partialRoleReads,
  "known domain restrictions never request forbidden collections",
);
assert.equal(new URLSearchParams(window.location.search).get("tab"), null);
for (const restrictedTab of ["budget", "materials"]) {
  await query({ tab: restrictedTab });
  assert.equal(
    readCount(),
    partialRoleReads,
    "restricted deep links do not enter the shared denial latch",
  );
  assert.match(host.textContent ?? "", /Akses tab tidak tersedia/);
  assert.equal(tableLoading(), null);
  await tab("Ringkasan");
  assert.equal(
    readCount(),
    partialRoleReads,
    "restricted siblings do not poison authorized trend retention",
  );
  assert.equal(trendLoading(), null);
}
await tab("Jatuh Tempo");
assert.equal(
  latestTable().input.tab,
  "cash",
  "global ledger roles can still open authorized due documents",
);
await answerTable(latestTable());
await tab("Ringkasan");
currentPermissions = ownerPermissions;
await render();
await answerTrend(latestTrend());
await tab("Budget");
await answerTable(latestTable());
const beforeBudgetRevoke = readCount();
currentPermissions = ["view:ledger", "view:approval_queue"];
await render();
assert.equal(readCount(), beforeBudgetRevoke);
assert.match(host.textContent ?? "", /Akses tab tidak tersedia/);
assert.equal(
  host.querySelector('table[aria-label="Budget proyek aktif"]'),
  null,
  "revoked capabilities immediately hide a previously cached budget page",
);
await tab("Ringkasan");
assert.equal(
  readCount(),
  beforeBudgetRevoke + 1,
  "permission changes invalidate previously retained authorized pages too",
);
await answerTrend(latestTrend());

await act(async (): Promise<void> => root.unmount());
await browser.happyDOM.close();
console.log("Dashboard retained table and trend ownership passed");
