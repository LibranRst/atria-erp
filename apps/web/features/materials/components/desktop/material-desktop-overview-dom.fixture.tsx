import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { ActivityDetailRequest } from "@atria/core/activity-detail/types";
import type { GroupedMaterial } from "../../utils/material-ui-utils";
import { getGroupedMaterialStockSummary } from "../../utils/material-ui-utils";
import { materialsFixtureData } from "../../../../.storybook/materials-data.fixture";

const browser = new Window({
  url: "https://atria.test/materials?tab=overview",
  width: 1280,
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
    bfcacheId: "materials-overview-fixture",
    back: () => {},
    forward: () => {},
    refresh: () => {},
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
}));
const opened: ActivityDetailRequest[] = [];
mock.module("@/features/activity-detail/components/activity-detail-provider", () => ({
  useActivityDetail: () => ({
    activeId: null,
    setActiveId: () => {},
    openActivityDetail: (target: ActivityDetailRequest): void => {
      opened.push(target);
    },
  }),
  ActivityDetailChevron: () => null,
  ActivityDetailProvider: ({ children }: { readonly children: React.ReactNode }): React.ReactNode =>
    children,
}));
mock.module("../../hooks/material-desktop-read-client", () => ({
  readMaterialDesktopActivity: (): never => {
    throw new Error("Hidden activity must not fetch during an overview regression.");
  },
}));

const source = materialsFixtureData("complete");
const first = source.inventory[0];
assert.ok(first, "representative inventory exists");
const inventory = [
  {
    ...first,
    currentStock: 0,
    reservedStock: 0,
    availableStock: 0,
    status: "OUT_OF_STOCK" as const,
  },
  {
    ...first,
    inventoryId: "77000000-0000-4000-8000-000000008001",
    locationId: "77000000-0000-4000-8000-000000008002",
    locationName: "Gudang kedua",
    currentStock: 12,
    reservedStock: 3.5,
    availableStock: 8.5,
    status: "AVAILABLE" as const,
  },
];
const grouped: readonly GroupedMaterial[] = [
  {
    id: first.materialId,
    name: first.materialName,
    categoryName: first.categoryName,
    rows: inventory,
    shortages: [],
  },
];
const summary = getGroupedMaterialStockSummary(grouped[0]!);
assert.equal(summary.status, "OUT_OF_STOCK", "canonical risk still follows the affected location");
assert.equal(summary.availableStock, 8.5, "other warehouse remains physically available");
const movements = source.movements.slice(0, 3);
assert.equal(movements.length, 3);
const data = { ...source, inventory, shortages: [], movements };
const ui = await import("@/components/ui");
const { createRoot } = await import("react-dom/client");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { MaterialDesktopWorkspace } = await import("./material-desktop-workspace");
const { MaterialDesktopInventory, MaterialDesktopNeeds } =
  await import("./material-desktop-comparisons");
const visibility = document.createElement("style");
const visibilityRules =
  ".hidden{display:none}@media (min-width:1280px){.xl\\:block{display:block}.xl\\:hidden{display:none}}";
visibility.textContent = visibilityRules;
document.head.append(visibility);
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
const noop = (): void => {};
await act(async () => {
  root.render(
    <WorkspacePresentationProvider presentation="desktop">
      <ui.DesktopUIProvider responsive>
        <MaterialDesktopWorkspace
          data={data}
          grouped={grouped}
          tab="overview"
          active
          suspended={false}
          pending={false}
          totalStockValue={summary.stockValue}
          availableValue={8.5 * first.averageCost}
          lowCount={1}
          onNavigate={noop}
          onOperation={noop}
          onOpenMaterial={noop}
          onOpenReceipt={noop}
          onDecision={noop}
          onReload={noop}
          onLoadCountDraft={noop}
        />
      </ui.DesktopUIProvider>
    </WorkspacePresentationProvider>,
  );
});
const priority = host.querySelector<HTMLTableElement>('table[aria-label="Lima prioritas stok"]');
assert.ok(priority, "the actual overview priority table is rendered");
const firstRow = priority.querySelector("tbody tr");
assert.ok(firstRow);
assert.match(firstRow.textContent ?? "", /Habis/, "the canonical aggregate risk is retained");
assert.match(
  firstRow.textContent ?? "",
  /1 dari 2 lokasi/,
  "location qualifier explains risk beside positive aggregate availability",
);
assert.match(
  firstRow.textContent ?? "",
  /8,5/,
  "the overview still shows stock available in the other warehouse",
);

const eventButtons = [
  ...host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Buka detail "]'),
];
assert.equal(eventButtons.length, 3, "all three latest events are native focusable buttons");
for (const [index, button] of eventButtons.entries()) {
  const movement = movements[index];
  assert.ok(movement);
  assert.equal(button.disabled, false);
  assert.ok(button.tabIndex >= 0, "the shared event button remains in keyboard order");
  assert.ok(
    button.getAttribute("aria-label")?.includes(movement.materialName),
    "each button names its own event context",
  );
  await act(async () => button.focus());
  assert.equal(document.activeElement, button, "keyboard focus lands on the actual event action");
  await act(async () => {
    button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    button.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    button.click();
  });
  assert.deepEqual(
    opened[index],
    { kind: "STOCK_MOVEMENT", id: movement.id },
    "the clicked event opens its own shared activity detail",
  );
}
assert.equal(opened.length, 3, "each event dispatches one detail request without a stock mutation");

const otherMaterial = source.inventory.find((row) => row.materialId !== first.materialId);
assert.ok(otherMaterial);
let comparisonGroups: readonly GroupedMaterial[] = [
  ...grouped,
  {
    id: otherMaterial.materialId,
    name: otherMaterial.materialName,
    categoryName: otherMaterial.categoryName,
    rows: [otherMaterial],
    shortages: [],
  },
];
let comparisonView: "inventory" | "needs" = "inventory";
async function renderComparisons(): Promise<void> {
  await act(async () => {
    root.render(
      <WorkspacePresentationProvider presentation="desktop">
        <ui.DesktopUIProvider responsive>
          {comparisonView === "inventory" ? (
            <MaterialDesktopInventory
              data={source}
              grouped={comparisonGroups}
              onOpenMaterial={noop}
            />
          ) : (
            <MaterialDesktopNeeds data={source} onReload={noop} />
          )}
        </ui.DesktopUIProvider>
      </WorkspacePresentationProvider>,
    );
  });
}
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  });
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
async function width(value: number): Promise<void> {
  await act(async () => {
    browser.happyDOM.setWindowSize({ width: value, height: 976 });
    visibility.textContent = visibilityRules;
    window.dispatchEvent(new Event("resize"));
  });
  await settle();
}
function comparisonTable(): HTMLTableElement {
  const table = host.querySelector<HTMLTableElement>("table");
  assert.ok(table);
  return table;
}
function comparisonRows(): readonly HTMLTableRowElement[] {
  return [...comparisonTable().querySelectorAll<HTMLTableRowElement>("tbody tr")];
}
function selectedRows(): number {
  return comparisonTable().querySelectorAll('tbody tr[aria-selected="true"]').length;
}
function context(): Element | null {
  return host.querySelector(
    `[aria-label="${comparisonView === "inventory" ? "Konteks stok material" : "Konteks kebutuhan RAP"}"]`,
  );
}
function visible(element: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement)
    if (current.hasAttribute("hidden") || getComputedStyle(current).display === "none")
      return false;
  return true;
}
function back(): HTMLButtonElement {
  const button = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (row) => row.textContent?.trim() === "Kembali ke daftar",
  );
  assert.ok(button);
  return button;
}
async function filterSearch(value: string): Promise<void> {
  await act(async () => {
    const input = host.querySelector<HTMLInputElement>('input[type="search"]');
    assert.ok(input);
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    assert.ok(setter);
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
}
for (const view of ["inventory", "needs"] as const) {
  comparisonView = view;
  await renderComparisons();
  assert.equal(selectedRows(), 0, `${view} starts unselected on wide desktop`);
  assert.equal(context(), null, `${view} has no implicit first-row detail`);
  await press(comparisonRows()[0]!);
  assert.equal(selectedRows(), 1);
  assert.ok(context());
  await press(comparisonRows()[1]!);
  assert.equal(
    comparisonRows()[1]!.getAttribute("aria-selected"),
    "true",
    "another row replaces the explicit context",
  );
  await press(comparisonRows()[1]!);
  assert.equal(selectedRows(), 0, `${view} clears on a second pointer activation`);
  assert.equal(context(), null);
  await pressKey(comparisonRows()[0]!, "Enter");
  assert.equal(selectedRows(), 1);
  await pressKey(comparisonRows()[0]!, " ");
  assert.equal(selectedRows(), 0, `${view} preserves native keyboard toggle semantics`);
  assert.equal(context(), null);
  await width(1024);
  for (const key of ["Enter", " "] as const) {
    const invoker = comparisonRows()[0]!;
    await pressKey(invoker, key);
    assert.equal(
      visible(comparisonTable()),
      false,
      "narrow desktop opens on the first keyboard activation",
    );
    assert.equal(
      document.activeElement === back(),
      true,
      "keyboard focus follows the visible context",
    );
    await press(back());
    assert.equal(visible(comparisonTable()), true);
    assert.equal(document.activeElement === invoker, true, "Back restores its exact material row");
  }
  await width(1440);
  assert.equal(
    selectedRows(),
    0,
    "Back clears selection instead of restoring a fallback when resized",
  );
  assert.equal(context(), null);
  await press(comparisonRows()[0]!);
  await width(1024);
  assert.equal(visible(comparisonTable()), false);
  await width(1280);
  assert.equal(selectedRows(), 1, "explicit context survives viewport changes");
  const chosen = comparisonRows()[0]!.textContent ?? "";
  const alternative = source.inventory.find((row) => !chosen.includes(row.materialName));
  assert.ok(alternative);
  await filterSearch(alternative.materialName);
  assert.equal(context(), null, "filtering out an explicit choice does not select a replacement");
  assert.equal(selectedRows(), 0);
  await filterSearch("");
  assert.equal(selectedRows(), 1, "restoring rows only restores the user's explicit selection");
  await press(comparisonRows()[0]!);
  assert.equal(selectedRows(), 0);
}
comparisonView = "inventory";
await renderComparisons();
await press(comparisonRows()[0]!);
const selectedName = comparisonTable().querySelector('tr[aria-selected="true"]')?.textContent ?? "";
comparisonGroups = comparisonGroups.filter((row) => !selectedName.includes(row.name));
assert.equal(comparisonGroups.length, 1);
await renderComparisons();
assert.equal(
  selectedRows(),
  0,
  "source removal clears visible context without selecting its replacement",
);
assert.equal(context(), null);
await act(async () => root.unmount());
await browser.happyDOM.close();
console.log(
  "material overview qualifies mixed-location stock and routes each focusable recent event to shared detail; inventory and needs keep optional pointer and keyboard selection through resize and source changes",
);
