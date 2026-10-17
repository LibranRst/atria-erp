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

const browserWindow = new Window({
  url: "https://atria.test/projects/project-scope?tab=expenses&view=vendor-bills&unrelated=keep#notes",
  width: 1093,
  height: 976,
});
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
  usePathname: (): string => "/projects/project-scope",
  useSearchParams: (): ReturnType<typeof nextNavigation.useSearchParams> =>
    new nextNavigation.ReadonlyURLSearchParams(window.location.search),
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
const { ExpenseList } = await import("./expense-list");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);

const sourceProjectId = "project-scope";
let projectId: string | undefined = sourceProjectId;
const costs = Array.from({ length: 27 }, (_, index) => ({
  ...EXPENSES_FIXTURE_COSTS[0]!,
  id: `cost-${index}`,
  description: `Biaya ruang ${index + 1}`,
  amount: `${index + 1}.25`,
  status: "APPROVED" as const,
  project: { id: sourceProjectId, name: "Proyek terbatas" },
}));
const bills = Array.from({ length: 26 }, (_, index) => ({
  ...EXPENSES_FIXTURE_BILLS[0]!,
  id: `bill-${index}`,
  projectId: sourceProjectId,
  status: "UNPAID",
  amount: `${index + 1}.75`,
  billNumber: `INV-${index + 1}`,
  payments: [],
  project: { name: "Proyek terbatas" },
}));
const payments = Array.from({ length: 13 }, (_, index) => ({
  ...EXPENSES_FIXTURE_PAYMENTS[0]!,
  id: `payment-${index}`,
  vendorBillId: bills[index]!.id,
  status: "PENDING",
  approvalStatus: "APPROVED",
  amountPaid: `${index + 1}.15`,
  vendorBill: {
    billNumber: bills[index]!.billNumber,
    vendor: { name: "Vendor fixture" },
    project: { name: "Proyek terbatas" },
  },
}));
function Fixture(): React.JSX.Element {
  return (
    <WorkspacePresentationProvider presentation="desktop">
      <DesktopUIProvider responsive>
        <PermissionsProvider permissions={["view:cost", "view:vendor_bill"]}>
          <ExpenseList
            projectId={projectId}
            initialCosts={costs}
            bankAccounts={[]}
            vendorBills={bills}
            vendorPayments={payments}
            vendorPaymentApprovalThreshold={5000000}
          />
        </PermissionsProvider>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
async function settle(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 45));
  });
}
async function press(element: HTMLElement): Promise<void> {
  await act(async (): Promise<void> => {
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    element.click();
  });
  await settle();
}
function visible(element: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement)
    if (current.hasAttribute("hidden") || getComputedStyle(current).display === "none")
      return false;
  return true;
}
function table(label: string): HTMLTableElement {
  const result = host.querySelector<HTMLTableElement>(`table[aria-label="${label}"]`);
  assert.ok(result, label);
  return result;
}
function rows(label: string): readonly HTMLTableRowElement[] {
  return [...table(label).querySelectorAll<HTMLTableRowElement>("tbody tr")];
}
function tab(label: string): HTMLElement {
  const result = [...host.querySelectorAll<HTMLElement>('[role="tab"]')].find(
    (item) => visible(item) && item.textContent?.startsWith(label),
  );
  assert.ok(result, label);
  return result;
}
function button(label: string): HTMLButtonElement {
  const result = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => visible(item) && item.textContent?.trim() === label,
  );
  assert.ok(result, label);
  return result;
}
function assertRoute(): void {
  const params = new URLSearchParams(window.location.search);
  assert.equal(params.get("tab"), "expenses");
  assert.equal(params.get("view"), "vendor-bills");
  assert.equal(params.get("unrelated"), "keep");
  assert.equal(window.location.hash, "#notes");
}
await act(async (): Promise<void> => root.render(<Fixture />));
await settle();
assert.ok(
  visible(table("Pengeluaran lapangan")),
  "Standalone view parameter cannot switch project subview",
);
assert.equal(rows("Pengeluaran lapangan").length, 10);
assert.equal(table("Pengeluaran lapangan").querySelectorAll('[aria-selected="true"]').length, 0);
assert.equal(
  [...host.querySelectorAll("button")].filter(
    (item) => visible(item) && item.textContent?.includes("Tambah"),
  ).length,
  0,
  "Readonly permission hides create commands",
);
assert.equal(
  [...host.querySelectorAll("button")].filter(
    (item) => visible(item) && item.getAttribute("aria-label")?.includes("Proyek pengeluaran"),
  ).length,
  0,
  "Embedded project selector omitted",
);
await press(button("Berikutnya"));
assert.equal(
  new URLSearchParams(window.location.search).get(`project-${projectId}-expenses-claims-page`),
  "2",
);
assertRoute();
const sort = table("Pengeluaran lapangan").querySelector<HTMLElement>('th[data-key="amount"]');
assert.ok(sort, "Nominal sortable header");
await press(sort);
assert.equal(
  new URLSearchParams(window.location.search).get(`project-${projectId}-expenses-claims-page`),
  "1",
  "Sort resets page",
);
assert.equal(
  new URLSearchParams(window.location.search).get(`project-${projectId}-expenses-claims-sort`),
  "amount",
);
assert.ok(
  rows("Pengeluaran lapangan")[0]?.textContent?.includes("Biaya ruang 1"),
  "Entire collection sorted before slicing",
);
await press(tab("Tagihan Vendor"));
assert.ok(visible(table("Tagihan vendor")));
assert.equal(rows("Tagihan vendor").length, 10);
assert.equal(
  [...table("Tagihan vendor").querySelectorAll("th")].some(
    (item) => item.textContent?.trim() === "Proyek",
  ),
  false,
  "Embedded vendor table omits repeated project column",
);
await press(tab("Pembayaran"));
assert.ok(visible(table("Rencana pembayaran vendor")));
assert.equal(rows("Rencana pembayaran vendor").length, 10);
assertRoute();
await press(tab("Pengeluaran Lapangan"));
assert.ok(visible(table("Pengeluaran lapangan")), "Claims owner survives inner tab change");
assert.equal(
  new URLSearchParams(window.location.search).get(`project-${projectId}-expenses-claims-sort`),
  "amount",
);
const search = [...host.querySelectorAll<HTMLInputElement>("input")].find(
  (item) => visible(item) && item.getAttribute("aria-label") === "Cari pengeluaran lapangan",
);
assert.ok(search);
await act(async (): Promise<void> => search.focus());
await act(async (): Promise<void> => {
  browserWindow.happyDOM.setWindowSize({ width: 1440, height: 976 });
  window.dispatchEvent(new Event("resize"));
});
await settle();
assert.equal(document.activeElement, search, "Resize retains focused control DOM");
assertRoute();
projectId = undefined;
await act(async (): Promise<void> => {
  window.history.replaceState({}, "", "/expenses?view=vendor-bills&unrelated=keep#notes");
  root.render(<Fixture key="standalone" />);
});
await settle();
await press(tab("Pembayaran"));
const vendorPrefix = "project-inbox-expenses-vendor-";
const claimsPrefix = "project-inbox-expenses-claims-";
function params(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}
assert.equal(params().get(`${vendorPrefix}view`), "PAYMENTS");
await press(button("Berikutnya"));
assert.equal(params().get(`${vendorPrefix}payments-page`), "2");
assert.equal(rows("Rencana pembayaran vendor").length, 3);
const paymentAmount = table("Rencana pembayaran vendor").querySelector<HTMLElement>(
  'th[data-key="amount"]',
);
assert.ok(paymentAmount);
await press(paymentAmount);
assert.equal(params().get(`${vendorPrefix}payments-sort`), "amount");
assert.equal(
  params().get(`${vendorPrefix}payments-page`),
  "1",
  "standalone sort resets only its collection page",
);
async function typeSearch(label: string, value: string): Promise<void> {
  const input = [...host.querySelectorAll<HTMLInputElement>("input")].find(
    (element) => visible(element) && element.getAttribute("aria-label") === label,
  );
  assert.ok(input);
  await act(async (): Promise<void> => {
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    assert.ok(setter);
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
}
await typeSearch("Cari tagihan dan pembayaran vendor", "INV-1");
assert.equal(params().get(`${vendorPrefix}search`), "INV-1");
assert.equal(params().get(`${vendorPrefix}payments-page`), "1");
await typeSearch("Cari tagihan dan pembayaran vendor", "");
for (const pageSize of [25, 50, 10]) {
  await act(async (): Promise<void> => {
    const url = new URL(window.location.href);
    url.searchParams.set(`${vendorPrefix}payments-pageSize`, String(pageSize));
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  });
  await settle();
  assert.equal(rows("Rencana pembayaran vendor").length, Math.min(pageSize, payments.length));
}
await press(button("Berikutnya"));
assert.equal(params().get(`${vendorPrefix}payments-page`), "2");
await press(tab("Tagihan"));
await press(tab("Pembayaran"));
assert.equal(
  params().get(`${vendorPrefix}payments-page`),
  "2",
  "peer tabs retain their own pagination",
);
assert.equal(rows("Rencana pembayaran vendor").length, 3);
await act(async (): Promise<void> => root.render(<Fixture key="standalone-reloaded" />));
await settle();
assert.ok(
  visible(table("Rencana pembayaran vendor")),
  "standalone URL restores the payments subtab after remount",
);
assert.equal(
  rows("Rencana pembayaran vendor").length,
  3,
  "standalone URL restores its exact sort and page",
);
assert.equal(params().get(`${vendorPrefix}payments-sort`), "amount");
await press(tab("Pengeluaran Lapangan"));
await press(button("Berikutnya"));
assert.equal(params().get(`${claimsPrefix}page`), "2");
await typeSearch("Cari pengeluaran lapangan", "Biaya ruang 27");
assert.equal(params().get(`${claimsPrefix}search`), "Biaya ruang 27");
assert.equal(
  params().get(`${claimsPrefix}page`),
  "1",
  "standalone claim filtering resets its page",
);
assert.equal(rows("Pengeluaran lapangan").length, 1);
await act(async (): Promise<void> => root.render(<Fixture key="claims-reloaded" />));
await settle();
assert.equal(rows("Pengeluaran lapangan").length, 1, "claim filters survive remount");
assert.match(table("Pengeluaran lapangan").textContent ?? "", /Biaya ruang 27/);
assert.equal(params().get("unrelated"), "keep");
assert.equal(window.location.hash, "#notes");
await act(async (): Promise<void> => root.unmount());
await browserWindow.happyDOM.close();
console.log(
  "Embedded project expenses owner, pagination, query isolation and resize regression passed",
);
