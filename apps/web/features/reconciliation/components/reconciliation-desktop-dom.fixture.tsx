import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { ActionResponse } from "@atria/core/types/action-response";
import type {
  ReconciliationDesktopData,
  ReconciliationDesktopInput,
  ReconciliationHistoryRow,
  ReconciliationMatchContext,
  ReconciliationMatchContextInput,
  ReconciliationStatementRow,
} from "@atria/core/finance/reconciliation-desktop";

const browser = new Window({
  url: "https://atria.test/reconciliation?view=statement&statement-page=3&cash-search=saved&preserve=yes#evidence",
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
  usePathname: (): string => "/reconciliation",
  useRouter: (): ReturnType<typeof nextNavigation.useRouter> => ({
    bfcacheId: "reconciliation-desktop-fixture",
    back: (): void => {},
    forward: (): void => {},
    refresh: (): void => {},
    push: (): void => {},
    replace: (): void => {},
    prefetch: (): void => {},
  }),
}));

type DeferredRead = {
  readonly input: ReconciliationDesktopInput;
  readonly resolve: (result: ActionResponse<ReconciliationDesktopData>) => void;
};
const reads: DeferredRead[] = [];
const evidenceReads: ReconciliationMatchContextInput[] = [];
const deferredEvidence: {
  readonly input: ReconciliationMatchContextInput;
  readonly complete: () => void;
}[] = [];
let deferEvidence = false;
const accountId = "00000000-0000-4000-8000-000000000001";
const sourceDate = new Date("2026-10-15T05:00:00.000Z");
const statementRows: readonly ReconciliationStatementRow[] = [
  {
    id: "00000000-0000-4000-8000-000000000002",
    bankAccountId: accountId,
    bankAccountName: "Operasional BCA",
    type: "OUTFLOW",
    amount: 1250000.25,
    description: "Pembelian material proyek Kemang",
    transactionDate: sourceDate,
    suggestedCashTransactionId: null,
    candidateCount: 1,
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    bankAccountId: accountId,
    bankAccountName: "Operasional BCA",
    type: "INFLOW",
    amount: 2750000.75,
    description: "Termin proyek Cipete",
    transactionDate: sourceDate,
    suggestedCashTransactionId: null,
    candidateCount: 1,
  },
];
// Bank date and confirmation date intentionally differ, including their month.
// History sorts by confirmation, so its visible date must describe that event.
const historyRows: readonly ReconciliationHistoryRow[] = [
  {
    id: "00000000-0000-4000-8000-000000000005",
    cashTransactionId: "00000000-0000-4000-8000-000000000004",
    bankAccountName: "Operasional BCA",
    type: "OUTFLOW",
    amount: 1250000.25,
    cashDescription: "Pembayaran material yang sudah diverifikasi",
    statementDescription: "Transfer ke pemasok material",
    bankReference: "BCA-30-September",
    transactionDate: new Date("2026-09-29T17:30:00.000Z"),
    reconciledAt: sourceDate,
    reconciledByName: "Finance QA",
    importFileName: "September-2026.csv",
  },
];
mock.module("../hooks/reconciliation-read-client", () => ({
  readReconciliationDesktop: (
    input: ReconciliationDesktopInput,
  ): Promise<ActionResponse<ReconciliationDesktopData>> =>
    new Promise((resolve) => reads.push({ input, resolve })),
  readReconciliationMatchContext: async (
    input: ReconciliationMatchContextInput,
  ): Promise<ActionResponse<ReconciliationMatchContext>> => {
    evidenceReads.push(input);
    const statement =
      statementRows.find((row) => row.id === input.statementRowId) ?? statementRows[0]!;
    const result: ActionResponse<ReconciliationMatchContext> = {
      success: true,
      data: {
        statementRows: [statement],
        cashTransactions: [
          {
            id: "00000000-0000-4000-8000-000000000004",
            bankAccountId: statement.bankAccountId,
            bankAccountName: statement.bankAccountName,
            type: statement.type,
            amount: statement.amount,
            description: `Catatan untuk ${statement.description}`,
            source: null,
            bankReference: "BCA-15-Okt",
            createdAt: sourceDate,
            ageDays: 0,
            exceptionReason: null,
            exceptionAt: null,
            exceptionByName: null,
          },
        ],
      },
    };
    return deferEvidence
      ? new Promise((resolve) => deferredEvidence.push({ input, complete: () => resolve(result) }))
      : result;
  },
}));

const ui = await import("@/components/ui");
// Shared HeroUI controls have their own interaction suites. Keep this regression
// focused on the real page/data owner, while preserving its real search and table.
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
const { ReconciliationDesktopWorkspace } = await import("./reconciliation-desktop-workspace");
const refreshToken = {};
const matchActions: { readonly cashId: string; readonly statementId?: string }[] = [];
let manualActions = 0;
let importActions = 0;
const noop = (): void => {};
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
function Fixture({
  view,
  pending = false,
  token = refreshToken,
  suspended = false,
  active = true,
  forcedView,
}: {
  readonly view: ReconciliationDesktopInput["view"];
  readonly pending?: boolean;
  readonly token?: object;
  readonly suspended?: boolean;
  readonly active?: boolean;
  readonly forcedView?: ReconciliationDesktopInput["view"];
}): React.JSX.Element {
  const [activeView, setActiveView] = React.useState(view);
  return (
    <WorkspacePresentationProvider presentation="desktop">
      <ui.DesktopUIProvider responsive>
        <ReconciliationDesktopWorkspace
          active={active}
          activeView={forcedView ?? activeView}
          refreshToken={token}
          suspended={suspended}
          pending={pending}
          onChangeView={setActiveView}
          onOpenImport={() => {
            importActions += 1;
          }}
          onOpenManual={() => {
            manualActions += 1;
          }}
          onOpenHistory={noop}
          onOpenMatch={(cashId, statementId) => matchActions.push({ cashId, statementId })}
        />
      </ui.DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
await act(async (): Promise<void> => {
  root.render(<Fixture view="statement" />);
});

async function settle(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
  });
}
function latest(): DeferredRead {
  const read = reads.at(-1);
  assert.ok(read, "a desktop read is pending");
  return read;
}
function pageData(
  input: ReconciliationDesktopInput,
  firstDescription?: string,
): ReconciliationDesktopData {
  if (input.view === "cash")
    return {
      view: "cash",
      rows: statementRows.map((row, index) => ({
        id:
          index === 0
            ? "00000000-0000-4000-8000-000000000004"
            : "00000000-0000-4000-8000-000000000006",
        bankAccountId: row.bankAccountId,
        bankAccountName: row.bankAccountName,
        type: row.type,
        amount: row.amount,
        description: index === 0 && firstDescription ? firstDescription : row.description,
        source: null,
        bankReference: null,
        createdAt: row.transactionDate,
        ageDays: 0,
        exceptionReason: null,
        exceptionAt: null,
        exceptionByName: null,
      })),
      total: 38,
      page: input.page,
      pageSize: input.pageSize,
      updatedAt: sourceDate,
      counts: { cash: 38, statement: 31, history: 117, exceptions: 7, actionRequired: 31 },
      bankAccounts: [{ id: accountId, name: "Operasional BCA", bankName: "BCA" }],
    };
  if (input.view === "history")
    return {
      view: "history",
      rows: historyRows.map((row, index) =>
        index === 0 && firstDescription ? { ...row, cashDescription: firstDescription } : row,
      ),
      total: 117,
      page: input.page,
      pageSize: input.pageSize,
      updatedAt: sourceDate,
      counts: { cash: 38, statement: 31, history: 117, exceptions: 7, actionRequired: 31 },
      bankAccounts: [{ id: accountId, name: "Operasional BCA", bankName: "BCA" }],
    };
  assert.equal(input.view, "statement");
  return {
    view: "statement",
    rows: statementRows.map((row, index) =>
      index === 0 && firstDescription ? { ...row, description: firstDescription } : row,
    ),
    total: 31,
    page: input.page,
    pageSize: input.pageSize,
    updatedAt: sourceDate,
    counts: { cash: 38, statement: 31, history: 117, exceptions: 7, actionRequired: 31 },
    bankAccounts: [{ id: accountId, name: "Operasional BCA", bankName: "BCA" }],
  };
}
async function answer(read: DeferredRead, firstDescription?: string): Promise<void> {
  await act(async (): Promise<void> => {
    read.resolve({ success: true, data: pageData(read.input, firstDescription) });
  });
  await settle();
}
function search(): HTMLInputElement {
  const input = host.querySelector<HTMLInputElement>('input[aria-label="Cari rekonsiliasi"]');
  assert.ok(input, "the live search remains available");
  return input;
}
async function typeSearch(value: string): Promise<void> {
  await act(async (): Promise<void> => {
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
  await act(async (): Promise<void> => {
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    element.click();
  });
  await settle();
}
async function activateRow(element: HTMLElement, key: "Enter" | " "): Promise<void> {
  await act(async (): Promise<void> => {
    element.focus();
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    element.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }));
  });
  await settle();
}
function button(label: string): HTMLButtonElement {
  const item = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  assert.ok(item, label);
  return item;
}
async function choose(label: string, value: string): Promise<void> {
  const select = host.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);
  assert.ok(select, label);
  await act(async (): Promise<void> => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await settle();
}
function table(): HTMLTableElement {
  const item = host.querySelector<HTMLTableElement>('table[aria-label="Mutasi bank belum cocok"]');
  assert.ok(item, "statement table");
  return item;
}
function rows(): readonly HTMLTableRowElement[] {
  return [...table().querySelectorAll<HTMLTableRowElement>("tbody tr")];
}
function visible(element: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement) {
    if (current.hasAttribute("hidden") || getComputedStyle(current).display === "none")
      return false;
  }
  return true;
}
async function width(value: number): Promise<void> {
  await act(async (): Promise<void> => {
    browser.happyDOM.setWindowSize({ width: value, height: 976 });
    visibility.textContent = visibilityRules;
    window.dispatchEvent(new Event("resize"));
  });
  await settle();
}
function url(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}
function summaryValue(label: string): string {
  const term = [...host.querySelectorAll("dt")].find((item) => item.textContent === label);
  assert.ok(term, `workspace metadata remains available: ${label}`);
  return term.nextElementSibling?.textContent ?? "";
}

assert.equal(latest().input.page, 3, "initial page is restored from the view-specific URL");
assert(button("Catat mutasi").disabled, "Unknown source cannot enable manual workflow entry");
assert(button("Impor mutasi").disabled, "Unknown source cannot enable import workflow entry");
assert.ok(host.querySelector('[role="status"][aria-label="Memuat rekonsiliasi"]'));
assert.equal(
  host.querySelector('[role="tablist"][aria-label="Sumber rekonsiliasi"]'),
  null,
  "initial loading has no invented workspace metadata",
);
await answer(latest());
assert.equal(button("Catat mutasi").disabled, false);
assert.equal(button("Impor mutasi").disabled, false);
assert.match(
  host.textContent ?? "",
  /31 hasil · Halaman 3/,
  "total comes from the server, not the two rendered rows",
);
await width(1440);
assert.equal(table().querySelectorAll('tbody tr[aria-selected="true"]').length, 0);
assert.equal(host.querySelector('section[aria-label="Rincian rekonsiliasi"]'), null);
assert.equal(evidenceReads.length, 0, "unselected rows do not request a matching context");
await press(rows()[0]!);
assert.ok(host.querySelector('section[aria-label="Rincian rekonsiliasi"]'));
assert.equal(button("Tinjau pasangan").disabled, false);
await press(rows()[0]!);
assert.equal(table().querySelectorAll('tbody tr[aria-selected="true"]').length, 0);
assert.equal(host.querySelector('section[aria-label="Rincian rekonsiliasi"]'), null);
await activateRow(rows()[1]!, "Enter");
assert.equal(rows()[1]!.getAttribute("aria-selected"), "true");
await activateRow(rows()[1]!, "Enter");
assert.equal(host.querySelector('section[aria-label="Rincian rekonsiliasi"]'), null);
await activateRow(rows()[0]!, " ");
assert.equal(rows()[0]!.getAttribute("aria-selected"), "true");
await activateRow(rows()[0]!, " ");
assert.equal(host.querySelector('section[aria-label="Rincian rekonsiliasi"]'), null);
await press(rows()[0]!);
const originalSearch = search();
await typeSearch("lama");
const stale = latest();
assert.equal(stale.input.search, "lama");
assert.equal(stale.input.page, 1, "typing resets pagination");
assert.equal(search(), originalSearch, "pending response keeps the same search input node");
assert.equal(
  document.activeElement,
  originalSearch,
  "typing retains keyboard focus during loading",
);
assert.equal(
  host.querySelector('section[aria-label="Rincian rekonsiliasi"]'),
  null,
  "a pending same-view search hides stale matching detail and its actions",
);
assert.equal(
  [...host.querySelectorAll("button")].some(
    (item) => item.textContent?.trim() === "Tinjau pasangan",
  ),
  false,
);
await typeSearch("terbaru");
const newest = latest();
assert.notEqual(newest, stale);
assert.equal(newest.input.search, "terbaru");
assert.equal(search(), originalSearch);
assert.equal(document.activeElement, originalSearch);
await answer(newest, "Hasil terbaru");
await answer(stale, "Hasil lama yang terlambat");
assert.match(table().textContent ?? "", /Hasil terbaru/);
assert.doesNotMatch(
  table().textContent ?? "",
  /Hasil lama yang terlambat/,
  "stale response cannot overwrite the current query",
);
assert.equal(search(), originalSearch);
assert.ok(
  host.querySelector('section[aria-label="Rincian rekonsiliasi"]'),
  "matching context returns once the current search completes",
);
assert.equal(button("Tinjau pasangan").disabled, false);
await press(rows()[0]!);
assert.equal(host.querySelector('section[aria-label="Rincian rekonsiliasi"]'), null);
await width(1093);

await press(button("Berikutnya"));
assert.equal(latest().input.page, 2);
await answer(latest());
const amountHeader = [...table().querySelectorAll<HTMLElement>("th")].find((header) =>
  header.textContent?.includes("Nominal"),
);
assert.ok(amountHeader);
await press(amountHeader);
assert.equal(latest().input.sort, "amount", "header sorting reaches the server query");
assert.equal(latest().input.page, 1, "sorting resets the page");
assert.equal(latest().input.search, "terbaru", "sorting preserves search");
assert.equal(url().get("statement-sort"), "amount");
assert.equal(url().get("statement-page"), "1");
assert.equal(url().get("cash-search"), "saved", "another tab retains its query");
assert.equal(url().get("preserve"), "yes");
assert.equal(window.location.hash, "#evidence");
await answer(latest());
await press(button("Berikutnya"));
await answer(latest());
await choose("Arah dana", "INFLOW");
assert.equal(latest().input.direction, "INFLOW");
assert.equal(latest().input.page, 1, "a filter change resets pagination");
assert.equal(latest().input.sort, "amount");
assert.equal(url().get("statement-direction"), "INFLOW");
await answer(latest());
await press(button("Berikutnya"));
await answer(latest());
await choose("Jumlah baris", "25");
assert.equal(latest().input.pageSize, 25);
assert.equal(latest().input.page, 1, "changing page size resets pagination");
await answer(latest());

assert.equal(
  table().querySelectorAll('tbody tr[aria-selected="true"]').length,
  0,
  "narrow initial list has no hidden selected row",
);
assert.equal(host.querySelectorAll('section[aria-label="Rincian rekonsiliasi"]').length, 0);
const invokingRow = rows()[0]!;
await activateRow(invokingRow, "Enter");
assert.equal(
  document.activeElement,
  button("Kembali ke daftar"),
  "Narrow keyboard selection moves focus to visible detail",
);
assert.equal(visible(table()), false, "one first-row click progresses into narrow detail");
assert.equal(visible(button("Kembali ke daftar")), true);
assert.equal(evidenceReads.at(-1)?.statementRowId, statementRows[0]!.id);
await press(button("Kembali ke daftar"));
assert.equal(visible(table()), true, "Back returns to the list");
assert.equal(document.activeElement, invokingRow, "Back restores the invoking native table row");
assert.equal(table().querySelectorAll('tbody tr[aria-selected="true"]').length, 0);
await press(rows()[1]!);
assert.equal(evidenceReads.at(-1)?.statementRowId, statementRows[1]!.id);
await width(1440);
assert.equal(visible(table()), true, "wide presentation shows table beside detail");
let selected = table().querySelector<HTMLTableRowElement>('tbody tr[aria-selected="true"]');
assert.ok(
  selected?.textContent?.includes(statementRows[1]!.description),
  "the explicit second-row context survives widening",
);
await width(1093);
assert.equal(visible(table()), false);
assert.equal(
  table().querySelectorAll('tbody tr[aria-selected="true"]').length,
  0,
  "narrowed hidden table exposes no selected row",
);
await width(1280);
selected = table().querySelector<HTMLTableRowElement>('tbody tr[aria-selected="true"]');
assert.ok(
  selected?.textContent?.includes(statementRows[1]!.description),
  "selection survives narrow and wide transitions",
);
const review = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
  (item) => item.textContent?.trim() === "Tinjau pasangan",
);
assert.ok(review);
await act(async (): Promise<void> => root.render(<Fixture view="statement" pending />));
await settle();
await press(rows()[1]!);
assert.equal(rows()[1]!.getAttribute("aria-selected"), "true", "pending work prevents deselection");
await press(rows()[0]!);
assert.equal(
  rows()[1]!.getAttribute("aria-selected"),
  "true",
  "pending work prevents switching source",
);
await act(async (): Promise<void> => root.render(<Fixture view="statement" />));
await settle();
await press(review);
assert.deepEqual(
  matchActions,
  [{ cashId: "00000000-0000-4000-8000-000000000004", statementId: statementRows[1]!.id }],
  "candidate review hands the chosen pair to the existing workflow",
);
const refreshButton = [...host.querySelectorAll<HTMLButtonElement>("button")].find((item) =>
  item.textContent?.includes("Segarkan"),
);
assert.ok(refreshButton);
await press(refreshButton);
assert.equal(
  host.querySelector('section[aria-label="Rincian rekonsiliasi"]'),
  null,
  "refresh hides old matching actions while preserving the selected row's identity",
);
await answer(latest());
assert.ok(
  table()
    .querySelector('tbody tr[aria-selected="true"]')
    ?.textContent?.includes(statementRows[1]!.description),
  "the explicit second-row selection returns after refresh",
);
assert.equal(button("Tinjau pasangan").disabled, false);

const goToHistory = [...host.querySelectorAll<HTMLElement>('[role="tab"]')].find((tab) =>
  tab.textContent?.startsWith("Riwayat"),
);
assert.ok(goToHistory);
await press(goToHistory);
assert.equal(latest().input.view, "history");
assert.equal(latest().input.sort, "date");
await answer(latest());
const historyTable = host.querySelector<HTMLTableElement>(
  'table[aria-label="Riwayat rekonsiliasi"]',
);
assert.ok(historyTable, "the real history presenter is shown");
assert.equal(historyTable.querySelectorAll('tbody tr[aria-selected="true"]').length, 0);
assert.equal(host.querySelector('section[aria-label="Rincian rekonsiliasi"]'), null);
const historyRow = historyTable.querySelector<HTMLElement>("tbody tr");
assert.ok(historyRow);
await press(historyRow);
assert.equal(historyRow.getAttribute("aria-selected"), "true");
await press(historyRow);
assert.equal(host.querySelector('section[aria-label="Rincian rekonsiliasi"]'), null);
await activateRow(historyRow, "Enter");
const confirmationHeader = [...historyTable.querySelectorAll<HTMLElement>("th")].find((header) =>
  header.textContent?.includes("Dikonfirmasi"),
);
assert.ok(confirmationHeader, "history names the date event that its server query sorts");
const dateCell = historyTable.querySelectorAll("tbody tr td")[2];
assert.ok(dateCell, "history has a confirmation-date cell");
assert.match(dateCell.textContent ?? "", /15 Okt 2026/, "history displays the confirmation date");
assert.doesNotMatch(
  dateCell.textContent ?? "",
  /30 Sep 2026/,
  "the bank transaction date is reserved for evidence detail",
);
assert.equal(button("Buka bukti pencocokan").disabled, false);
await press(confirmationHeader);
assert.equal(
  host.querySelector('section[aria-label="Rincian rekonsiliasi"]'),
  null,
  "history sorting hides old evidence detail while the requested order loads",
);
assert.equal(
  [...host.querySelectorAll("button")].some(
    (item) => item.textContent?.trim() === "Buka bukti pencocokan",
  ),
  false,
);
assert.equal(latest().input.view, "history");
assert.equal(
  latest().input.sort,
  "date",
  "sorting the confirmation header requests the same server date field",
);
assert.equal(latest().input.sortDirection, "ascending");
assert.equal(url().get("history-sort"), "date");
assert.equal(url().get("history-page"), "1");
await answer(latest());
assert.equal(button("Buka bukti pencocokan").disabled, false);

const originalTablist = host.querySelector<HTMLElement>(
  '[role="tablist"][aria-label="Sumber rekonsiliasi"]',
);
assert.ok(originalTablist, "the real reconciliation segmented navigation is present");
const statementTab = [...originalTablist.querySelectorAll<HTMLElement>('[role="tab"]')].find(
  (tab) => tab.textContent?.startsWith("Mutasi bank"),
);
const historyTab = [...originalTablist.querySelectorAll<HTMLElement>('[role="tab"]')].find((tab) =>
  tab.textContent?.startsWith("Riwayat"),
);
assert.ok(statementTab);
assert.ok(historyTab);
const readsBeforeCachedTab = reads.length;
await act(async (): Promise<void> => statementTab.focus());
await press(statementTab);
assert.equal(reads.length, readsBeforeCachedTab, "returning to an exact visited tab needs no read");
assert.ok(host.querySelector('table[aria-label="Mutasi bank belum cocok"]'));
assert.equal(host.querySelector('[role="status"][aria-label="Memuat rekonsiliasi"]'), null);
assert.equal(document.activeElement, statementTab, "cached tab navigation keeps keyboard focus");
assert.equal(url().get("statement-search"), "terbaru");
assert.equal(url().get("cash-search"), "saved");
await typeSearch("uncached bank source");
const delayedStatement = latest();
assert.equal(delayedStatement.input.view, "statement");
assert.equal(delayedStatement.input.search, "uncached bank source");
assert.ok(
  host.querySelector('[role="tablist"][aria-label="Sumber rekonsiliasi"]') === originalTablist,
  "switching tabs keeps the same live segmented navigation while the requested source loads",
);
assert.equal(statementTab.getAttribute("aria-selected"), "true");
assert.equal(document.activeElement, search(), "pending uncached queries retain search focus");
assert.equal(summaryValue("Mutasi belum cocok"), "31");
assert.equal(summaryValue("Sudah cocok"), "117");
assert.ok(
  host.querySelector('[role="status"][aria-label="Memuat rekonsiliasi"][aria-busy="true"]'),
  "only the pending content shows an honest loading state",
);
assert.equal(
  host.querySelector('table[aria-label="Riwayat rekonsiliasi"]'),
  null,
  "history rows are not presented as the pending bank source",
);
const readsBeforeHistoryReturn = reads.length;
await press(historyTab);
assert.equal(
  reads.length,
  readsBeforeHistoryReturn,
  "a cached tab stays usable during another read",
);
assert.ok(
  host.querySelector('[role="tablist"][aria-label="Sumber rekonsiliasi"]') === originalTablist,
);
assert.equal(historyTab.getAttribute("aria-selected"), "true");
await answer(delayedStatement, "Mutasi lama yang terlambat");
assert.match(
  host.querySelector('table[aria-label="Riwayat rekonsiliasi"]')?.textContent ?? "",
  /Pembayaran material yang sudah diverifikasi/,
  "a delayed source cannot replace the current tab after a rapid switch",
);
assert.doesNotMatch(host.textContent ?? "", /Mutasi lama yang terlambat/);
assert.ok(
  host.querySelector('[role="tablist"][aria-label="Sumber rekonsiliasi"]') === originalTablist,
  "navigation ownership survives both completed and superseded requests",
);

await press(statementTab);
const failedStatement = latest();
await act(async (): Promise<void> => {
  failedStatement.resolve({
    success: false,
    error: { code: "INTERNAL_SERVER_ERROR", message: "Sumber mutasi bank sedang gagal." },
  });
});
await settle();
assert.ok(
  host.querySelector('[role="tablist"][aria-label="Sumber rekonsiliasi"]') === originalTablist,
  "a failed source does not replace the live workspace navigation",
);
assert.equal(statementTab.getAttribute("aria-selected"), "true");
assert.match(
  host.querySelector('[role="alert"]')?.textContent ?? "",
  /Sumber mutasi bank sedang gagal/,
);
assert.equal(summaryValue("Mutasi belum cocok"), "31", "failure never invents a zero count");
assert.equal(
  host.querySelector('table[aria-label="Mutasi bank belum cocok"]'),
  null,
  "a failed source does not expose old rows as current results",
);
const readsAfterFailure = reads.length;
await press(historyTab);
assert.equal(
  reads.length,
  readsAfterFailure,
  "a failed bank source does not invalidate healthy history",
);
await press(statementTab);
assert.equal(reads.length, readsAfterFailure, "failed sources wait for explicit retry");
assert.match(
  host.querySelector('[role="alert"]')?.textContent ?? "",
  /Sumber mutasi bank sedang gagal/,
);
assert.equal(host.querySelector('table[aria-label="Mutasi bank belum cocok"]'), null);
await press(button("Coba lagi"));
const retryStatement = latest();
assert.notEqual(retryStatement, failedStatement);
assert.equal(retryStatement.input.view, "statement");
assert.ok(
  host.querySelector('[role="tablist"][aria-label="Sumber rekonsiliasi"]') === originalTablist,
  "retry replaces content loading only",
);
assert.ok(
  host.querySelector('[role="status"][aria-label="Memuat rekonsiliasi"][aria-busy="true"]'),
);
await answer(retryStatement, "Mutasi setelah pemulihan sumber");
assert.match(table().textContent ?? "", /Mutasi setelah pemulihan sumber/);
assert.equal(host.querySelector('[role="alert"]'), null);

const cashTab = [...originalTablist.querySelectorAll<HTMLElement>('[role="tab"]')].find((tab) =>
  tab.textContent?.startsWith("Catatan Paduna Build"),
);
assert.ok(cashTab);
await press(cashTab);
assert.equal(latest().input.view, "cash");
await answer(latest());
const cashTable = host.querySelector<HTMLTableElement>(
  'table[aria-label="Catatan Paduna Build belum cocok"]',
);
assert.ok(cashTable);
assert.equal(cashTable.querySelectorAll('tbody tr[aria-selected="true"]').length, 0);
assert.equal(host.querySelector('section[aria-label="Rincian rekonsiliasi"]'), null);
const cashRows = [...cashTable.querySelectorAll<HTMLElement>("tbody tr")];
await press(cashRows[0]!);
assert.equal(cashRows[0]!.getAttribute("aria-selected"), "true");
await press(cashRows[0]!);
assert.equal(cashTable.querySelectorAll('tbody tr[aria-selected="true"]').length, 0);
assert.equal(host.querySelector('section[aria-label="Rincian rekonsiliasi"]'), null);
await activateRow(cashRows[1]!, "Enter");
assert.equal(cashRows[1]!.getAttribute("aria-selected"), "true");
await activateRow(cashRows[1]!, " ");
assert.equal(cashTable.querySelectorAll('tbody tr[aria-selected="true"]').length, 0);
assert.equal(host.querySelector('section[aria-label="Rincian rekonsiliasi"]'), null);

const cachedCashReads = reads.length;
await press(statementTab);
assert.equal(reads.length, cachedCashReads);
assert.match(table().textContent ?? "", /Mutasi setelah pemulihan sumber/);
await press(cashTab);
assert.equal(reads.length, cachedCashReads, "both visited source pages return synchronously");
assert.equal(host.querySelector('[role="status"][aria-label="Memuat rekonsiliasi"]'), null);
await press(button("Berikutnya"));
assert.equal(latest().input.view, "cash");
assert.equal(latest().input.page, 2, "a different cash page is not a cache hit");
assert.equal(latest().input.search, "saved", "cash restores only its own query namespace");
assert.equal(host.querySelector('table[aria-label="Catatan Paduna Build belum cocok"]'), null);
await answer(latest(), "Kas halaman kedua");
await press(statementTab);
assert.equal(url().get("statement-search"), "uncached bank source");
assert.match(table().textContent ?? "", /Mutasi setelah pemulihan sumber/);
const beforeHistoryPrime = reads.length;
await press(historyTab);
assert.equal(reads.length, beforeHistoryPrime + 1, "retry invalidates inactive history as well");
await answer(latest(), "Riwayat sebelum pergantian generasi");
await press(statementTab);
assert.equal(reads.length, beforeHistoryPrime + 1, "all three current-generation views are cached");

const nextToken = {};
const beforeSuspension = reads.length;
await act(async (): Promise<void> =>
  root.render(<Fixture view="statement" token={nextToken} suspended />),
);
await settle();
assert.equal(reads.length, beforeSuspension, "suspended refresh does not issue a read");
assert.equal(
  host.querySelector('table[aria-label="Mutasi bank belum cocok"]'),
  null,
  "a changed token cannot expose a previous-generation page",
);
await act(async (): Promise<void> => root.render(<Fixture view="statement" token={nextToken} />));
await settle();
assert.equal(reads.length, beforeSuspension + 1);
assert.equal(latest().input.view, "statement");
await answer(latest(), "Mutasi generasi baru");
await press(historyTab);
assert.equal(reads.length, beforeSuspension + 2, "token invalidation also clears inactive history");
assert.equal(latest().input.view, "history");
await answer(latest(), "Riwayat generasi baru");
await press(cashTab);
assert.equal(reads.length, beforeSuspension + 3, "token invalidation also clears inactive cash");
assert.equal(latest().input.view, "cash");
assert.equal(latest().input.page, 2);
await answer(latest(), "Kas generasi baru");

const refreshCached = [...host.querySelectorAll<HTMLButtonElement>("button")].find((item) =>
  item.textContent?.includes("Segarkan"),
);
assert.ok(refreshCached);
const beforeReload = reads.length;
await press(refreshCached);
const oldReloadedCash = latest();
assert.equal(reads.length, beforeReload + 1);
assert.equal(host.querySelector('table[aria-label="Catatan Paduna Build belum cocok"]'), null);
await press(statementTab);
assert.equal(reads.length, beforeReload + 2, "explicit reload invalidates other cached sources");
await answer(latest(), "Mutasi setelah segarkan");
await answer(oldReloadedCash, "Kas terlambat sebelum pindah");
assert.match(table().textContent ?? "", /Mutasi setelah segarkan/);
assert.doesNotMatch(host.textContent ?? "", /Kas terlambat sebelum pindah/);
await press(historyTab);
assert.equal(reads.length, beforeReload + 3, "reload invalidates every inactive source page");
await answer(latest(), "Riwayat setelah segarkan");

const beforeInactive = reads.length;
await act(async (): Promise<void> =>
  root.render(<Fixture view="statement" token={nextToken} active={false} />),
);
await settle();
await typeSearch("inactive history query");
assert.equal(
  reads.length,
  beforeInactive,
  "inactive desktop presentation does not read a changed query",
);
await act(async (): Promise<void> => root.render(<Fixture view="statement" token={nextToken} />));
await settle();
assert.equal(reads.length, beforeInactive + 1);
assert.equal(latest().input.view, "history");
assert.equal(latest().input.search, "inactive history query");
await answer(latest(), "Riwayat setelah aktif kembali");

await typeSearch("denied history query");
await act(async (): Promise<void> =>
  latest().resolve({
    success: false,
    error: { code: "FORBIDDEN", message: "Izin rekonsiliasi telah dicabut." },
  }),
);
await settle();
assert.match(
  host.querySelector('[role="alert"]')?.textContent ?? "",
  /Izin rekonsiliasi telah dicabut/,
);
assert.equal(host.querySelector('table[aria-label="Riwayat rekonsiliasi"]'), null);
assert.equal(host.querySelector("dt"), null, "access denial removes cached workspace metadata");
assert.ok(host.textContent?.includes("Akses rekonsiliasi tidak tersedia"));
assert(button("Catat mutasi").disabled, "Access denial disables manual mutation entry");
assert(button("Impor mutasi").disabled, "Access denial disables import mutation entry");
await press(button("Catat mutasi"));
await press(button("Impor mutasi"));
assert.equal(manualActions, 0);
assert.equal(importActions, 0);
const deniedReads = reads.length;
await act(async (): Promise<void> =>
  root.render(<Fixture view="statement" token={nextToken} forcedView="statement" />),
);
await settle();
assert.equal(
  reads.length,
  deniedReads,
  "access denial blocks other cached sources until explicit retry",
);
assert.equal(
  host.querySelector('table[aria-label="Mutasi bank belum cocok"]'),
  null,
  "denial purges the previously cached bank page too",
);
await press(button("Coba lagi"));
assert.equal(latest().input.view, "statement");
await answer(latest(), "Mutasi setelah akses diperiksa kembali");
assert.match(table().textContent ?? "", /Mutasi setelah akses diperiksa kembali/);

await act(async (): Promise<void> => root.render(<Fixture view="statement" token={nextToken} />));
await settle();
assert.equal(latest().input.view, "history");
await answer(latest(), "Riwayat untuk uji kesegaran pasangan");
const currentTabs = [...host.querySelectorAll<HTMLElement>('[role="tab"]')];
const currentStatementTab = currentTabs.find((tab) => tab.textContent?.startsWith("Mutasi bank"));
const currentHistoryTab = currentTabs.find((tab) => tab.textContent?.startsWith("Riwayat"));
assert.ok(currentStatementTab);
assert.ok(currentHistoryTab);
await press(currentStatementTab);
await press(rows()[0]!);
assert.equal(button("Tinjau pasangan").disabled, false);
deferEvidence = true;
const beforeCachedEvidenceReturn = reads.length;
await press(currentHistoryTab);
await press(currentStatementTab);
assert.equal(
  reads.length,
  beforeCachedEvidenceReturn,
  "returning to cached rows does not refetch the collection",
);
assert.ok(table());
assert.equal(host.querySelector('[role="status"][aria-label="Memuat rekonsiliasi"]'), null);
assert.equal(deferredEvidence.length, 1, "selected cached rows recheck their matching evidence");
assert.equal(deferredEvidence[0]!.input.statementRowId, statementRows[0]!.id);
assert.equal(
  [...host.querySelectorAll("button")].some(
    (item) => item.textContent?.trim() === "Tinjau pasangan",
  ),
  false,
  "old candidate actions stay hidden while fresh matching evidence is pending",
);
await act(async (): Promise<void> => deferredEvidence[0]!.complete());
await settle();
assert.equal(
  button("Tinjau pasangan").disabled,
  false,
  "fresh evidence restores the matching action",
);
const collectionReadsBeforeResume = reads.length;
await act(async (): Promise<void> =>
  root.render(<Fixture view="statement" token={nextToken} suspended />),
);
await settle();
assert.equal(deferredEvidence.length, 1, "suspension does not request matching evidence");
await act(async (): Promise<void> => root.render(<Fixture view="statement" token={nextToken} />));
await settle();
assert.equal(
  reads.length,
  collectionReadsBeforeResume,
  "resume retains the exact cached collection",
);
assert.ok(table());
assert.equal(host.querySelector('[role="status"][aria-label="Memuat rekonsiliasi"]'), null);
assert.equal(
  deferredEvidence.length,
  2,
  "resume rechecks matching evidence without refetching rows",
);
assert.equal(
  [...host.querySelectorAll("button")].some(
    (item) => item.textContent?.trim() === "Tinjau pasangan",
  ),
  false,
  "resuming a selected cached row cannot expose its old matching action",
);
await act(async (): Promise<void> => deferredEvidence[1]!.complete());
await settle();
assert.equal(button("Tinjau pasangan").disabled, false);
deferEvidence = false;

await act(async (): Promise<void> => root.unmount());
await browser.happyDOM.close();
console.log(
  "reconciliation desktop owner preserves focus, queries, response order, viewport selection and history confirmation dates",
);
