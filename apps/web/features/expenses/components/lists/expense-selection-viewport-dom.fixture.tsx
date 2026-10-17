import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  EXPENSES_FIXTURE_COSTS,
  EXPENSES_FIXTURE_BILLS,
  EXPENSES_FIXTURE_PAYMENTS,
} from "../../../../.storybook/expenses-data.fixture";

const browserWindow = new Window({ url: "https://atria.test/expenses", width: 1093, height: 976 });
Reflect.set(browserWindow.Element.prototype, "animate", undefined);
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
  const value: unknown = key === "window" ? browserWindow : Reflect.get(browserWindow, key);
  Reflect.set(
    globalThis,
    key,
    typeof value === "function" &&
      ["getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"].includes(key)
      ? value.bind(browserWindow)
      : value,
  );
}
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
const nextNavigation = await import("next/navigation");
mock.module("next/navigation", (): typeof nextNavigation => ({
  ...nextNavigation,
  usePathname: (): string => "/expenses",
  useRouter: (): ReturnType<typeof nextNavigation.useRouter> => ({
    bfcacheId: "expense-selection-fixture",
    back: (): void => {},
    forward: (): void => {},
    refresh: (): void => {},
    push: (): void => {},
    replace: (): void => {},
    prefetch: (): void => {},
  }),
}));
mock.module("@/app/actions/activity-detail", () => ({
  getActivityDetail: async (): Promise<ActionResponse<never>> => {
    throw new Error("Viewport selection regression must not request backend details");
  },
}));

// Use the actual Tailwind visibility utility rules rather than asserting class strings.
const visibility = document.createElement("style");
const visibilityRules =
  ".hidden{display:none}@media (min-width: 1280px){.xl\\:block{display:block}.xl\\:hidden{display:none}}";
visibility.textContent = visibilityRules;
document.head.append(visibility);
const { createRoot } = await import("react-dom/client");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { DesktopUIProvider } = await import("@/components/ui");
const { PermissionsProvider } = await import("@/components/auth/permissions-provider");
const { FieldClaimsPanel } = await import("./field-claims-panel");
const { VendorBillListContent } = await import("./vendor-bill-list-content");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
type Mode = "claims" | "bills" | "payments";
const costs = EXPENSES_FIXTURE_COSTS.slice(0, 3);
const bills = EXPENSES_FIXTURE_BILLS.slice(0, 5);
const payments = EXPENSES_FIXTURE_PAYMENTS.slice(0, 5);
const noop = (): void => {};
function Fixture({
  mode,
  pending = false,
}: {
  readonly mode: Mode;
  readonly pending?: boolean;
}): React.JSX.Element {
  return (
    <WorkspacePresentationProvider presentation="desktop">
      <DesktopUIProvider responsive>
        <PermissionsProvider permissions={["view:cost", "view:vendor_bill"]}>
          {mode === "claims" ? (
            <FieldClaimsPanel
              initialCosts={costs}
              filteredCosts={costs}
              filter="ALL"
              filterTabs={[{ label: "Aktif", value: "ALL", count: costs.length }]}
              needsActionCount={2}
              readyToPayCount={1}
              activeClaimTotal={costs.reduce((sum, cost) => sum + Number(cost.amount), 0)}
              isOwnerOrFinance={false}
              pending={pending}
              historyExpanded={false}
              onFilterChange={noop}
              onHistoryExpandedChange={noop}
              onOpenExpenseDrawer={noop}
              onVerify={noop}
              onDisburse={noop}
              onOpenReceipt={noop}
            />
          ) : (
            <VendorBillListContent
              vendorBills={bills}
              vendorPayments={payments}
              canCreateVendorBill={false}
              canPayVendorBill={false}
              isOwnerOrFinance={false}
              onAddBill={noop}
              onSchedule={noop}
              onDisburse={noop}
              pending={pending}
            />
          )}
        </PermissionsProvider>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
async function settle(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 40));
  });
}
async function width(next: number): Promise<void> {
  await act(async (): Promise<void> => {
    browserWindow.happyDOM.setWindowSize({ width: next, height: 976 });
    visibility.textContent = visibilityRules;
    window.dispatchEvent(new Event("resize"));
  });
  await settle();
}
async function press(element: HTMLElement): Promise<void> {
  await act(async (): Promise<void> => {
    element.focus();
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
function currentTable(mode: Mode): HTMLTableElement {
  const label =
    mode === "claims"
      ? "Pengeluaran lapangan"
      : mode === "bills"
        ? "Tagihan vendor"
        : "Rencana pembayaran vendor";
  const table = host.querySelector<HTMLTableElement>(`table[aria-label="${label}"]`);
  assert.ok(table, label);
  return table;
}
function rows(mode: Mode): readonly HTMLTableRowElement[] {
  return [...currentTable(mode).querySelectorAll<HTMLTableRowElement>("tbody tr")];
}
function selected(mode: Mode): readonly HTMLTableRowElement[] {
  return [
    ...currentTable(mode).querySelectorAll<HTMLTableRowElement>('tbody tr[aria-selected="true"]'),
  ];
}
function visible(element: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement) {
    if (current.hasAttribute("hidden") || getComputedStyle(current).display === "none")
      return false;
  }
  return true;
}
function findDetail(mode: Mode): HTMLElement | null {
  const selector =
    mode === "claims"
      ? 'section[aria-label="Detail pengeluaran lapangan"]'
      : mode === "payments"
        ? 'section[aria-label="Rincian pembayaran vendor"]'
        : 'section[aria-label^="Rincian tagihan "]';
  return host.querySelector<HTMLElement>(selector);
}
function detail(mode: Mode): HTMLElement {
  const value = findDetail(mode);
  assert.ok(value, `Current ${mode} detail exists`);
  return value;
}
function back(mode: Mode): HTMLButtonElement {
  const value = [...detail(mode).querySelectorAll<HTMLButtonElement>("button")].find((button) =>
    mode === "claims"
      ? button.textContent?.includes("Daftar")
      : button.textContent?.includes("Kembali ke daftar"),
  );
  assert.ok(value, "Existing detail back action");
  return value;
}

for (const mode of ["claims", "bills", "payments"] as const) {
  await width(1093);
  await act(async (): Promise<void> => root.render(<Fixture key={mode} mode={mode} />));
  await settle();
  if (mode === "payments") {
    const tab = [...host.querySelectorAll<HTMLElement>('[role="tab"]')].find((candidate) =>
      candidate.textContent?.startsWith("Pembayaran"),
    );
    assert.ok(tab);
    await press(tab);
  }
  assert.ok(rows(mode).length >= 2, `${mode} has a complete representative native collection`);
  assert.equal(
    selected(mode).length,
    0,
    `${mode}: narrow list has no initial current/selected row`,
  );
  assert.equal(currentTable(mode).querySelectorAll('[data-atria-selected="true"]').length, 0);
  assert.equal(currentTable(mode).querySelectorAll('[aria-current="true"]').length, 0);
  assert.equal(findDetail(mode) === null, true, `${mode}: initial list has no fallback detail`);
  await press(rows(mode)[0]!);
  assert.equal(visible(detail(mode)), true, `${mode}: first row opens detail with one click`);
  assert.equal(
    visible(currentTable(mode)),
    false,
    `${mode}: narrow detail progression replaces list`,
  );
  await press(back(mode));
  assert.equal(visible(currentTable(mode)), true, `${mode}: back returns to list`);
  assert.equal(findDetail(mode) === null, true, `${mode}: back clears explicit detail`);
  assert.equal(selected(mode).length, 0);
  assert.equal(currentTable(mode).querySelectorAll('[aria-current="true"]').length, 0);
  for (const key of ["Enter", " "] as const) {
    const invoker = rows(mode)[1]!;
    await activateRow(invoker, key);
    assert.equal(visible(detail(mode)), true, `${mode}: keyboard opens the visible narrow detail`);
    assert.equal(
      document.activeElement === back(mode),
      true,
      `${mode}: ${key === " " ? "Space" : "Enter"} focuses the visible Back action instead of a hidden row`,
    );
    await press(back(mode));
    assert.equal(findDetail(mode) === null, true);
    assert.equal(
      document.activeElement === invoker,
      true,
      `${mode}: Back restores its invoking row`,
    );
    assert.equal(visible(invoker), true);
  }
  await width(1280);
  assert.equal(selected(mode).length, 0, `${mode}: widening does not automatically select a row`);
  assert.equal(findDetail(mode) === null, true);
  assert.equal(
    currentTable(mode).querySelectorAll('[aria-current="true"]').length,
    0,
    `${mode}: no context is announced before explicit selection`,
  );
  const search = host.querySelector<HTMLInputElement>(
    `input[aria-label="${mode === "claims" ? "Cari pengeluaran lapangan" : "Cari tagihan dan pembayaran vendor"}"]`,
  );
  assert.ok(search);
  await act(async (): Promise<void> => search.focus());
  await width(1440);
  assert.equal(
    document.activeElement === search,
    true,
    `${mode}: the list-detail owner never steals toolbar search focus`,
  );
  await width(1280);
  assert.equal(document.activeElement === search, true);
  await press(rows(mode)[0]!);
  assert.equal(selected(mode).length, 1);
  assert.equal(visible(detail(mode)), true);
  await press(rows(mode)[0]!);
  assert.equal(selected(mode).length, 0, `${mode}: repeated pointer click deselects the row`);
  assert.equal(findDetail(mode) === null, true);
  await activateRow(rows(mode)[1]!, "Enter");
  assert.equal(selected(mode).length, 1, `${mode}: Enter selects a row`);
  await activateRow(rows(mode)[1]!, "Enter");
  assert.equal(selected(mode).length, 0, `${mode}: repeated Enter clears selection`);
  assert.equal(findDetail(mode) === null, true);
  await activateRow(rows(mode)[1]!, " ");
  assert.equal(selected(mode).length, 1, `${mode}: Space selects a row`);
  await activateRow(rows(mode)[1]!, " ");
  assert.equal(selected(mode).length, 0, `${mode}: repeated Space clears selection`);
  assert.equal(findDetail(mode) === null, true);
  await press(rows(mode)[1]!);
  const selectedText = selected(mode)[0]?.textContent;
  assert.ok(selectedText);
  assert.equal(
    selected(mode)[0],
    rows(mode)[1],
    `${mode}: second row becomes native selected context`,
  );
  assert.equal(currentTable(mode).querySelectorAll('[aria-current="true"]').length, 1);
  await press(rows(mode)[0]!);
  assert.ok(selected(mode)[0] === rows(mode)[0], `${mode}: another row can replace the selection`);
  await press(rows(mode)[1]!);
  await act(async (): Promise<void> => root.render(<Fixture key={mode} mode={mode} pending />));
  await settle();
  await press(rows(mode)[1]!);
  assert.ok(selected(mode)[0] === rows(mode)[1], `${mode}: pending work prevents deselection`);
  await press(rows(mode)[0]!);
  assert.ok(
    selected(mode)[0] === rows(mode)[1],
    `${mode}: pending work prevents another selection`,
  );
  await act(async (): Promise<void> => root.render(<Fixture key={mode} mode={mode} />));
  await settle();
  const toolbarTab = [
    ...host.querySelectorAll<HTMLElement>('[role="tab"][aria-selected="true"]'),
  ].find(visible);
  assert.ok(toolbarTab);
  await act(async (): Promise<void> => toolbarTab.focus());
  await width(1093);
  assert.equal(
    document.activeElement === toolbarTab,
    true,
    `${mode}: a visible toolbar keeps focus when the selected list collapses`,
  );
  await width(1440);
  await act(async (): Promise<void> => rows(mode)[1]!.focus());
  await width(1093);
  assert.equal(
    document.activeElement === back(mode),
    true,
    `${mode}: narrowing repairs focus from the hidden selected list`,
  );
  assert.equal(
    selected(mode).length,
    0,
    `${mode}: narrowing never creates a hidden selected list row`,
  );
  assert.equal(
    currentTable(mode).querySelectorAll('[aria-current="true"]').length,
    0,
    `${mode}: narrowed table exposes no stale current-row announcement`,
  );
  assert.equal(
    visible(detail(mode)),
    true,
    `${mode}: explicit second-row context survives narrow resize`,
  );
  await width(1440);
  assert.ok(document.activeElement instanceof HTMLElement);
  assert.equal(
    visible(document.activeElement),
    true,
    `${mode}: widening never leaves focus on the now-hidden Back action`,
  );
  assert.ok(
    detail(mode).contains(document.activeElement),
    `${mode}: widening preserves focus in the visible detail`,
  );
  assert.equal(selected(mode).length, 1);
  assert.equal(
    selected(mode)[0]?.textContent,
    selectedText,
    `${mode}: nonfirst selection survives narrowing and widening`,
  );
  assert.equal(visible(detail(mode)), true);
  await press(rows(mode)[1]!);
  assert.equal(selected(mode).length, 0);
  assert.equal(
    findDetail(mode) === null,
    true,
    `${mode}: deselection removes the detail after resize`,
  );
}
await act(async (): Promise<void> => root.unmount());
await browserWindow.happyDOM.close();
console.log("Expenses claims/bills/payments viewport selection regression passed");
