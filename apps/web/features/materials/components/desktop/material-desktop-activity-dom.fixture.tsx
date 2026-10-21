import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { ActionResponse } from "@atria/core/types/action-response";
import type {
  MaterialDesktopActivityData,
  MaterialDesktopActivityInput,
  MaterialDesktopCountRow,
  MaterialDesktopMovementRow,
  MaterialDesktopReceiptRow,
} from "@atria/core/material/material-desktop";
import type {
  CountView,
  MaterialOperationsDashboard,
  ReceiptView,
} from "@/app/actions/material/operations-dashboard";
import type { MaterialOperationDecision } from "../../types/material-dashboard-types";

const browser = new Window({
  url: "https://atria.test/materials?tab=activity&activity-kind=movements&activity-movements-page=3&activity-receipts-search=saved&preserve=yes#material",
  width: 1093,
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
const nextNavigation = await import("next/navigation");
mock.module("next/navigation", (): typeof nextNavigation => ({
  ...nextNavigation,
  usePathname: () => "/materials",
  useRouter: (): ReturnType<typeof nextNavigation.useRouter> => ({
    bfcacheId: "materials-activity-fixture",
    back: () => {},
    forward: () => {},
    refresh: () => {},
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
}));
type DeferredRead = {
  readonly input: MaterialDesktopActivityInput;
  readonly resolve: (result: ActionResponse<MaterialDesktopActivityData>) => void;
};
const reads: DeferredRead[] = [];
mock.module("../../hooks/material-desktop-read-client", () => ({
  readMaterialDesktopActivity: (
    input: MaterialDesktopActivityInput,
  ): Promise<ActionResponse<MaterialDesktopActivityData>> =>
    new Promise((resolve) => reads.push({ input, resolve })),
}));

const ui = await import("@/components/ui");
function Filter(props: React.ComponentProps<typeof ui.FilterSelect>): React.JSX.Element {
  return (
    <select
      aria-label={props.label}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
    >
      {props.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
function Pagination(
  props: React.ComponentProps<typeof ui.DesktopTablePagination>,
): React.JSX.Element {
  return (
    <nav aria-label={props.ariaLabel}>
      <p>
        {props.total} hasil · Halaman {props.page}
      </p>
      <button type="button" onClick={() => props.onPageChange(props.page + 1)}>
        Berikutnya
      </button>
      <select
        aria-label="Jumlah baris"
        value={props.pageSize}
        onChange={(event) => props.onPageSizeChange(Number(event.target.value))}
      >
        {[10, 25, 50].map((size) => (
          <option key={size} value={size}>
            {size} baris
          </option>
        ))}
      </select>
    </nav>
  );
}
// Shared select/pagination interactions have their own suites. Keep the real
// search, HeroUI table, peer tabs, responsive presenter and data owner here.
mock.module("@/components/ui", () => ({
  ...ui,
  FilterSelect: Filter,
  DesktopTablePagination: Pagination,
}));
const visibility = document.createElement("style");
const visibilityRules =
  ".hidden{display:none}@media (min-width:1280px){.xl\\:block{display:block}.xl\\:hidden{display:none}}";
visibility.textContent = visibilityRules;
document.head.append(visibility);
const { createRoot } = await import("react-dom/client");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { MaterialDesktopActivity } = await import("./material-desktop-activity");
const date = new Date("2026-10-15T05:00:00.000Z");
const locationId = "14141414-1414-1414-1414-141414141401";
const projectId = "77777777-7777-7777-7777-777777777771";
const movements: readonly MaterialDesktopMovementRow[] = [0, 1].map((index) => ({
  id: `movement-${index}`,
  movementType: "RESERVE",
  movementDirection: "OUT",
  quantity: index === 0 ? 2.5 : 8,
  unitCost: 150000.25,
  note: "Untuk proyek Menteng",
  createdAt: date,
  materialId: `material-${index}`,
  materialName: index === 0 ? "Kayu lapis" : "Cat dinding",
  unit: index === 0 ? "lembar" : "liter",
  locationId,
  locationName: "Gudang utama",
  projectId,
  projectName: "Menteng Villa",
  createdByName: "Rani",
}));
const count: MaterialDesktopCountRow = {
  id: "count-beyond-preview",
  countNumber: "Opname di luar preview",
  status: "DRAFT",
  canEdit: true,
  locationId,
  locationName: "Gudang utama",
  countedAt: date,
  createdByName: "Rani",
  note: "Hitung ulang gudang",
  items: [
    {
      materialId: "material-1",
      materialName: "Kayu lapis",
      systemQuantity: 8,
      countedQuantity: 7.5,
      varianceQuantity: -0.5,
      unit: "lembar",
    },
  ],
};
const receipt: MaterialDesktopReceiptRow = {
  id: "receipt-beyond-preview",
  receiptNumber: "Penerimaan proyek Menteng",
  status: "REVERSAL_REQUESTED",
  projectId,
  projectName: "Menteng Villa",
  locationId,
  locationName: "Gudang utama",
  vendorBillNumber: "Tagihan pemasok",
  receivedAt: date,
  receivedByName: "Rani",
  reversalReason: "Dokumen ganda, mohon tinjau.",
  total: 1234567.25,
  items: [{ materialName: "Kayu lapis", quantity: 2.5, unitCost: 493826.9, unit: "lembar" }],
};
let data: MaterialOperationsDashboard = {
  roleName: "Purchasing",
  capabilities: {
    canReceive: true,
    canOperate: true,
    canTransfer: true,
    canCount: true,
    canApproveCount: false,
    canRequestReversal: true,
    canApproveReversal: false,
    canEmergencyAdjust: false,
  },
  inventory: [],
  locations: [{ id: locationId, name: "Gudang utama" }],
  shortages: [],
  movements: [],
  movementsHasMore: true,
  receipts: [],
  counts: [],
  transfers: [],
  projects: [{ id: projectId, name: "Menteng Villa", rapItems: [] }],
  bills: [],
};
let pending = false;
let suspended = false;
let active = true;
const draftActions: CountView[] = [];
const receiptActions: ReceiptView[] = [];
const decisions: MaterialOperationDecision[] = [];
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
function Fixture(): React.JSX.Element {
  return (
    <WorkspacePresentationProvider presentation="desktop">
      <ui.DesktopUIProvider responsive>
        <MaterialDesktopActivity
          data={data}
          active={active}
          suspended={suspended}
          pending={pending}
          onOpenReceipt={(row) => receiptActions.push(row)}
          onDecision={(decision) => decisions.push(decision)}
          onLoadCountDraft={(row) => draftActions.push(row)}
        />
      </ui.DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
async function render(): Promise<void> {
  await act(async () => root.render(<Fixture />));
}
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  });
}
function latest(): DeferredRead {
  const read = reads.at(-1);
  assert.ok(read);
  return read;
}
function pageData(
  input: MaterialDesktopActivityInput,
  firstName?: string,
): MaterialDesktopActivityData {
  const page = { total: 31, page: input.page, pageSize: input.pageSize, updatedAt: date };
  if (input.kind === "counts") return { ...page, kind: "counts", rows: [count] };
  if (input.kind === "receipts") return { ...page, kind: "receipts", rows: [receipt] };
  if (input.kind === "transfers") return { ...page, kind: "transfers", rows: [] };
  return {
    ...page,
    kind: "movements",
    rows: movements.map((row, index) =>
      index === 0 && firstName ? { ...row, materialName: firstName } : row,
    ),
  };
}
async function answer(read: DeferredRead, firstName?: string): Promise<void> {
  await act(async () => read.resolve({ success: true, data: pageData(read.input, firstName) }));
  await settle();
}
function search(): HTMLInputElement {
  const input = host.querySelector<HTMLInputElement>('input[type="search"]');
  assert.ok(input);
  return input;
}
async function typeSearch(value: string): Promise<void> {
  await act(async () => {
    const input = search();
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    assert.ok(setter);
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
}
async function press(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.focus();
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    element.click();
  });
  await settle();
}
async function pressKey(element: HTMLElement, key: "Enter" | " "): Promise<void> {
  await act(async () => {
    element.focus();
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    element.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }));
  });
  await settle();
}
function button(label: string): HTMLButtonElement {
  const element = [...host.querySelectorAll<HTMLButtonElement>("button")].find((item) =>
    item.textContent?.trim().startsWith(label),
  );
  assert.ok(element, label);
  return element;
}
async function choose(label: string, value: string): Promise<void> {
  const select = host.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);
  assert.ok(select, label);
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await settle();
}
function table(label = "Gerakan stok"): HTMLTableElement {
  const element = host.querySelector<HTMLTableElement>(`table[aria-label="${label}"]`);
  assert.ok(element, label);
  return element;
}
function rows(label?: string): readonly HTMLTableRowElement[] {
  return [...table(label).querySelectorAll<HTMLTableRowElement>("tbody tr")];
}
function visible(element: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement)
    if (current.hasAttribute("hidden") || getComputedStyle(current).display === "none")
      return false;
  return true;
}
async function width(value: number): Promise<void> {
  await act(async () => {
    browser.happyDOM.setWindowSize({ width: value, height: 976 });
    visibility.textContent = visibilityRules;
    window.dispatchEvent(new Event("resize"));
  });
  await settle();
}
async function kind(label: string): Promise<void> {
  const tab = [...host.querySelectorAll<HTMLElement>('[role="tab"]')].find(
    (element) => element.textContent?.trim() === label,
  );
  assert.ok(tab, label);
  await press(tab);
}
function url(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

await render();
assert.equal(latest().input.page, 3);
await answer(latest());
await width(1440);
assert.equal(
  table().querySelectorAll('tbody tr[aria-selected="true"]').length,
  0,
  "wide activity starts without an implicitly selected first row",
);
assert.equal(host.querySelector('[aria-label="Rincian Kayu lapis"]'), null);
await press(rows()[0]!);
assert.equal(table().querySelectorAll('tbody tr[aria-selected="true"]').length, 1);
await press(rows()[0]!);
assert.equal(
  table().querySelectorAll('tbody tr[aria-selected="true"]').length,
  0,
  "activating the selected movement clears its detail",
);
await pressKey(rows()[0]!, "Enter");
assert.equal(table().querySelectorAll('tbody tr[aria-selected="true"]').length, 1);
await pressKey(rows()[0]!, " ");
assert.equal(table().querySelectorAll('tbody tr[aria-selected="true"]').length, 0);
const beforeInactive = reads.length;
active = false;
await render();
active = true;
await render();
assert.equal(
  reads.length,
  beforeInactive,
  "returning from another Material tab retains its exact activity page",
);
assert.ok(table(), "a visited activity page returns without a skeleton");
await width(1093);
for (const key of ["Enter", " "] as const) {
  const invoker = rows()[0]!;
  await pressKey(invoker, key);
  assert.equal(
    document.activeElement === button("Kembali ke daftar"),
    true,
    "narrow activity transfers keyboard focus to its visible Back action",
  );
  await press(button("Kembali ke daftar"));
  assert.equal(
    document.activeElement === invoker,
    true,
    "Back restores the activity row that opened the detail",
  );
}
assert.match(
  host.textContent ?? "",
  /31 hasil · Halaman 3/,
  "server total is not the two rendered rows",
);
const originalSearch = search();
await typeSearch("kayu ");
const stale = latest();
assert.equal(search().value, "kayu ", "trailing space remains editable for multiword queries");
assert.equal(stale.input.search, "kayu");
assert.equal(stale.input.page, 1);
assert.equal(search(), originalSearch, "loading keeps the same search node");
assert.equal(document.activeElement, originalSearch, "loading preserves keyboard focus");
await typeSearch("kayu lapis");
const newest = latest();
assert.notEqual(newest, stale);
await answer(newest, "Hasil terbaru");
await answer(stale, "Hasil lama yang terlambat");
assert.match(table().textContent ?? "", /Hasil terbaru/);
assert.doesNotMatch(table().textContent ?? "", /Hasil lama yang terlambat/);
assert.equal(search(), originalSearch);
await press(button("Berikutnya"));
assert.equal(latest().input.page, 2);
await answer(latest());
const quantityHeader = [...table().querySelectorAll<HTMLElement>("th")].find((item) =>
  item.textContent?.includes("Jumlah"),
);
assert.ok(quantityHeader);
await press(quantityHeader);
assert.equal(latest().input.sort, "quantity");
assert.equal(latest().input.page, 1);
assert.equal(latest().input.search, "kayu lapis");
assert.equal(url().get("activity-movements-page"), "1");
assert.equal(url().get("activity-receipts-search"), "saved");
assert.equal(url().get("preserve"), "yes");
assert.equal(window.location.hash, "#material");
await answer(latest());
await press(button("Berikutnya"));
await answer(latest());
await choose("Jenis gerakan stok", "USE");
assert.equal(latest().input.status, "USE");
assert.equal(latest().input.page, 1);
assert.equal(latest().input.sort, "quantity");
await answer(latest());
await press(button("Berikutnya"));
await answer(latest());
await choose("Jumlah baris", "25");
assert.equal(latest().input.pageSize, 25);
assert.equal(latest().input.page, 1);
await answer(latest());
assert.equal(
  table().querySelectorAll('tbody tr[aria-selected="true"]').length,
  0,
  "narrow list never highlights hidden context",
);
await press(rows()[0]!);
assert.equal(visible(table()), false, "first row opens on its first click");
assert.equal(visible(button("Kembali ke daftar")), true);
await press(button("Kembali ke daftar"));
assert.equal(visible(table()), true);
await press(rows()[1]!);
await width(1440);
assert.equal(visible(table()), true);
assert.match(
  table().querySelector('tbody tr[aria-selected="true"]')?.textContent ?? "",
  /Cat dinding/,
);
await width(1093);
assert.equal(visible(table()), false);
assert.equal(table().querySelectorAll('tbody tr[aria-selected="true"]').length, 0);
await width(1280);
assert.match(
  table().querySelector('tbody tr[aria-selected="true"]')?.textContent ?? "",
  /Cat dinding/,
  "context survives resize",
);
await kind("Stock opname");
assert.equal(latest().input.kind, "counts");
await answer(latest());
assert.equal(data.counts.length, 0);
assert.equal(table("Stock opname").querySelectorAll('tbody tr[aria-selected="true"]').length, 0);
assert.doesNotMatch(host.textContent ?? "", /Lanjutkan draft/);
await press(rows("Stock opname")[0]!);
await press(button("Lanjutkan draft"));
assert.equal(
  draftActions.at(-1)?.id,
  count.id,
  "editable complete row is passed beyond legacy preview",
);
assert.doesNotMatch(host.textContent ?? "", /Tinjau persetujuan/);
await kind("Penerimaan");
assert.equal(latest().input.kind, "receipts");
assert.equal(latest().input.search, "saved");
await answer(latest());
assert.equal(
  table("Penerimaan barang").querySelectorAll('tbody tr[aria-selected="true"]').length,
  0,
);
await press(rows("Penerimaan barang")[0]!);
assert.doesNotMatch(host.textContent ?? "", /Tinjau pembatalan/);
await press(button("Buka rincian penerimaan"));
assert.equal(receiptActions.at(-1)?.id, receipt.id);
const beforeVisitedKinds = reads.length;
await kind("Stock opname");
assert.equal(reads.length, beforeVisitedKinds, "a visited activity kind does not fetch again");
assert.ok(table("Stock opname"));
assert.ok(button("Lanjutkan draft"), "the selected context survives a kind round trip");
await kind("Penerimaan");
assert.equal(reads.length, beforeVisitedKinds);
assert.ok(table("Penerimaan barang"));
data = { ...data, capabilities: { ...data.capabilities, canApproveReversal: true } };
await render();
assert.equal(
  reads.length,
  beforeVisitedKinds + 1,
  "a new parent snapshot invalidates retained activity data",
);
await answer(latest());
await kind("Stock opname");
assert.equal(
  reads.length,
  beforeVisitedKinds + 2,
  "a parent refresh also invalidates previously visited sibling kinds",
);
await answer(latest());
await kind("Penerimaan");
assert.equal(
  reads.length,
  beforeVisitedKinds + 2,
  "the refreshed exact page is retained within its new generation",
);
await press(button("Tinjau pembatalan"));
assert.deepEqual(decisions, [{ type: "RECEIPT_APPROVE", id: receipt.id }]);
pending = true;
await render();
assert.equal(button("Tinjau pembatalan").disabled, true);
await press(button("Tinjau pembatalan"));
assert.equal(decisions.length, 1, "pending prevents repeated decision dispatch");
await press(rows("Penerimaan barang")[0]!);
assert.equal(
  table("Penerimaan barang").querySelectorAll('tbody tr[aria-selected="true"]').length,
  1,
  "pending keeps the reviewed context selected",
);
pending = false;
suspended = true;
await render();
await press(rows("Penerimaan barang")[0]!);
assert.equal(
  table("Penerimaan barang").querySelectorAll('tbody tr[aria-selected="true"]').length,
  1,
  "an open workflow keeps its owning context selected",
);
suspended = false;
await render();
await answer(latest());
await press(rows("Penerimaan barang")[0]!);
assert.equal(
  table("Penerimaan barang").querySelectorAll('tbody tr[aria-selected="true"]').length,
  0,
);
assert.doesNotMatch(host.textContent ?? "", /Buka rincian penerimaan/);
const beforeRefresh = reads.length;
await press(button("Segarkan"));
assert.equal(reads.length, beforeRefresh + 1, "manual refresh rereads the current exact query");
assert.equal(
  host.querySelector('table[aria-label="Penerimaan barang"]'),
  null,
  "invalidated data is not shown as current",
);
await answer(latest());
await kind("Stock opname");
assert.equal(
  reads.length,
  beforeRefresh + 2,
  "manual refresh invalidates all retained activity kinds",
);
await answer(latest());
await kind("Penerimaan");
assert.equal(reads.length, beforeRefresh + 2);
await choose("Jumlah baris", "50");
const changedPage = latest();
assert.equal(
  reads.length,
  beforeRefresh + 3,
  "a different exact query is never served from the retained page",
);
assert.equal(changedPage.input.pageSize, 50);
await kind("Stock opname");
assert.equal(
  reads.length,
  beforeRefresh + 3,
  "cached sibling remains immediately available during another query",
);
await answer(changedPage);
assert.ok(table("Stock opname"), "late response cannot replace the current kind");
await kind("Penerimaan");
assert.equal(
  reads.length,
  beforeRefresh + 4,
  "a canceled late response is not retained as a completed visited page",
);
await answer(latest());
await kind("Transfer");
const deniedRead = latest();
await act(async () =>
  deniedRead.resolve({
    success: false,
    error: { code: "FORBIDDEN", message: "Akses aktivitas dicabut." },
  }),
);
await settle();
assert.match(host.textContent ?? "", /Akses aktivitas dicabut/);
const afterDenied = reads.length;
await kind("Penerimaan");
assert.equal(
  reads.length,
  afterDenied,
  "denied generations cannot reuse or refetch another retained kind",
);
assert.equal(host.querySelector('table[aria-label="Penerimaan barang"]'), null);
assert.match(host.textContent ?? "", /Akses aktivitas dicabut/);
await press(button("Coba lagi"));
assert.equal(reads.length, afterDenied + 1, "explicit retry starts a fresh authorization read");
await answer(latest());
assert.ok(table("Penerimaan barang"));
await kind("Stock opname");
assert.equal(reads.length, afterDenied + 2, "access denial purges previously cached sibling data");
await answer(latest());
await kind("Transfer");
await act(async () =>
  latest().resolve({ success: false, error: { code: "FORBIDDEN", message: "" } }),
);
await settle();
assert.match(
  host.textContent ?? "",
  /Aktivitas material belum dapat dimuat\. Coba lagi\./,
  "a denial without a server message still displays its recovery notice",
);
const afterEmptyDenied = reads.length;
await kind("Penerimaan");
assert.equal(
  reads.length,
  afterEmptyDenied,
  "an empty-message denial keeps the authorization gate closed across kinds",
);
assert.equal(host.querySelector('table[aria-label="Penerimaan barang"]'), null);
await press(button("Coba lagi"));
assert.equal(reads.length, afterEmptyDenied + 1);
await answer(latest());
assert.ok(table("Penerimaan barang"), "explicit retry can recover an empty-message denial");
await choose("Proyek aktivitas", projectId);
assert.equal(
  latest().input.projectId,
  projectId,
  "a historical project ID remains an exact server filter",
);
assert.equal(latest().input.search, "saved");
await answer(latest());
await choose("Lokasi aktivitas", locationId);
assert.equal(latest().input.projectId, projectId);
assert.equal(latest().input.locationId, locationId);
await answer(latest());
const beforeInvalid = reads.length;
await act(async () => {
  const next = new URL(window.location.href);
  next.searchParams.set("activity-receipts-projectId", "malformed-id");
  window.history.replaceState({}, "", `${next.pathname}${next.search}${next.hash}`);
});
await settle();
assert.equal(
  reads.length,
  beforeInvalid,
  "invalid input never falls back to a broader collection read",
);
assert.match(host.textContent ?? "", /Filter aktivitas material tidak valid/);
assert.equal(host.querySelector('table[aria-label="Penerimaan barang"]') === null, true);
assert.equal(
  search().value,
  "saved",
  "unrelated editable filters are preserved while invalid input is explained",
);
await press(button("Reset filter"));
assert.equal(reads.length, beforeInvalid + 1);
assert.equal(latest().input.projectId, undefined);
assert.equal(latest().input.locationId, undefined);
assert.equal(latest().input.search, "");
await answer(latest());
await act(async () => root.unmount());
await browser.happyDOM.close();
console.log(
  "material activity owner preserves complete totals, focus, URL filters, response ordering, viewport selection and full-row actions",
);
