import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { WorkflowFormSheet } from "@/components/ui";
import type { ProjectTabsProps } from "../../types/project-tabs-types";
import type { reserveMaterialForProject } from "@/app/actions/material/inventory";

const browser = new Window({
  url: "https://atria.test/projects/fixture?tab=stok&keep=1#rincian",
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
const nextNavigation = await import("next/navigation");
mock.module("next/navigation", (): typeof nextNavigation => ({
  ...nextNavigation,
  usePathname: (): string => "/projects/fixture",
  useSearchParams: (): ReturnType<typeof nextNavigation.useSearchParams> =>
    new nextNavigation.ReadonlyURLSearchParams(window.location.search),
  useRouter: (): ReturnType<typeof nextNavigation.useRouter> => ({
    bfcacheId: "stock-source-fixture",
    back: (): void => {},
    forward: (): void => {},
    refresh: (): void => {},
    push: (): void => {},
    replace: (): void => {},
    prefetch: (): void => {},
  }),
}));

const ui = await import("@/components/ui");
/** Geometry only. Real stock owner, selectors, inputs, review and dismissal stay under test. */
function SheetProbe(
  props: React.ComponentProps<typeof WorkflowFormSheet>,
): React.JSX.Element | null {
  if (!props.open) return null;
  return (
    <section data-stock-sheet aria-label={props.title}>
      <aside data-stock-summary>{props.desktopAsideSummary}</aside>
      {props.children}
      <button
        type="button"
        data-stock-primary
        disabled={props.disabled || props.pending}
        onClick={props.onPrimary}
      >
        {props.primaryLabel}
      </button>
      {props.secondaryLabel ? (
        <button
          type="button"
          data-stock-secondary
          disabled={props.pending}
          onClick={props.onSecondary}
        >
          {props.secondaryLabel}
        </button>
      ) : null}
      <button type="button" data-stock-close disabled={props.pending} onClick={props.onClose}>
        Test close stock
      </button>
      <output data-stock-pending>{String(props.pending)}</output>
    </section>
  );
}
mock.module("@/components/ui", () => ({ ...ui, WorkflowFormSheet: SheetProbe }));
mock.module("@/features/projects/detail/components/shared/rap-rab-manager", () => ({
  RapRabManager: (): React.JSX.Element => <p>Specialized RAP</p>,
}));
type StockInput = Parameters<typeof reserveMaterialForProject>[0];
type StockResult = Awaited<ReturnType<typeof reserveMaterialForProject>>;
let submitted: StockInput | null = null;
let finish: ((result: StockResult) => void) | null = null;
const inventoryActions = await import("@/app/actions/material/inventory");
mock.module("@/app/actions/material/inventory", () => ({
  ...inventoryActions,
  reserveMaterialForProject: (input: StockInput): Promise<StockResult> => {
    submitted = input;
    return new Promise<StockResult>((resolve) => {
      finish = resolve;
    });
  },
}));
const { createRoot } = await import("react-dom/client");
const { PermissionsProvider } = await import("@/components/auth/permissions-provider");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { useWorkspaceViewportPresentation } = await import("@/lib/navigation/workspace-viewport");
const { ActivityDetailProvider } =
  await import("@/features/activity-detail/components/activity-detail-provider");
const { ProjectStateProvider, useProjectState } = await import("../shared/project-state-context");
const { ProjectTabs } = await import("../shared/project-tabs");
const { projectOperationsFixtureData, projectOperationsFixturePermissions } =
  await import("../../../../../.storybook/project-operations-data.fixture");
const initial = projectOperationsFixtureData("stock-only");
assert.deepEqual(initial.project.raps, [], "stock-only fixture has no internal RAP access");
const item = initial.projectStockData?.rap?.items.find((entry) => entry.materialId);
assert(item?.materialId);
const material = initial.projectStockData?.materials.find((entry) => entry.id === item.materialId);
const inventory = material?.inventories[0];
assert(inventory);
function LockProbe(): React.JSX.Element {
  const state = useProjectState();
  return <output data-project-lock>{String(state.isLocked)}</output>;
}
function Owner({ data }: { readonly data: ProjectTabsProps }): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation();
  return (
    <WorkspacePresentationProvider presentation={presentation}>
      <ui.DesktopUIProvider responsive>
        <PermissionsProvider permissions={projectOperationsFixturePermissions("stock-only")}>
          <ProjectStateProvider>
            <ActivityDetailProvider>
              <LockProbe />
              <ProjectTabs {...data} />
            </ActivityDetailProvider>
          </ProjectStateProvider>
        </PermissionsProvider>
      </ui.DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
async function settle(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 650));
  });
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  });
}
async function click(element: HTMLElement): Promise<void> {
  await act(async (): Promise<void> => {
    element.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        buttons: 1,
      }),
    );
    element.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, buttons: 1 }),
    );
    element.focus();
  });
  await act(async (): Promise<void> => {
    element.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        buttons: 0,
      }),
    );
    element.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }),
    );
    element.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }),
    );
  });
  await settle();
}
function button(text: string): HTMLButtonElement {
  const found = [...document.querySelectorAll("button")].find((node) => node.textContent === text);
  assert(found, `Button ${text} exists`);
  return found;
}
function option(text: string): HTMLElement {
  const found = [
    ...document.querySelectorAll<HTMLElement>('[role="option"], [role="menuitem"]'),
  ].find((node) => node.textContent?.includes(text));
  assert(found, `Option ${text} exists`);
  return found;
}
function control(label: string): HTMLButtonElement {
  const found = [
    ...host.querySelectorAll<HTMLButtonElement>("[data-stock-sheet] button[aria-haspopup]"),
  ].find((node) => {
    const labelId = node.getAttribute("aria-labelledby") ?? "";
    return labelId
      .split(" ")
      .some((key) => document.getElementById(key)?.textContent?.includes(label));
  });
  assert(found, `Select ${label} exists`);
  return found;
}
function note(): HTMLTextAreaElement {
  const found = host.querySelector<HTMLTextAreaElement>("[data-stock-sheet] textarea");
  assert(found, "Stock note input exists");
  return found;
}
async function type(element: HTMLInputElement | HTMLTextAreaElement, value: string): Promise<void> {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  assert(setter);
  await act(async (): Promise<void> => {
    setter.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function resize(width: number): Promise<void> {
  await act(async (): Promise<void> => {
    browser.happyDOM.setWindowSize({ width, height: 976 });
    window.dispatchEvent(new Event("resize"));
  });
}
async function render(data: ProjectTabsProps): Promise<void> {
  await act(async (): Promise<void> => {
    root.render(<Owner data={data} />);
  });
}
const sourceChanged: ProjectTabsProps = {
  ...initial,
  project: { ...initial.project, name: "Incoming project revision", status: "COMPLETED" },
  projectBudgetDashboard: null,
  projectBudgetSource: { status: "unavailable" },
  projectStockData: { source: { status: "unavailable" }, rap: null, materials: [] },
  stockMovements: [],
};
try {
  await render(initial);
  assert.equal(host.querySelector("[data-project-lock]")?.textContent, "false");
  assert(
    host.textContent?.includes(item.name),
    "Quantity-only context renders without internal RAP permission",
  );
  await click(button("Operasi stok"));
  assert.equal(
    document.querySelectorAll('[role="menuitem"]').length,
    1,
    "reserve-only role gets only its writer-authorized action",
  );
  await click(option("Reservasi"));
  await click(control("RAP material"));
  await click(option(item.name));
  await click(control("Lokasi inventori"));
  await click(option(inventory.locationName));
  const quantity = host.querySelector<HTMLInputElement>(
    '[data-stock-sheet] input[inputmode="decimal"]',
  );
  assert(quantity);
  await type(quantity, "1.25");
  const originalNote = note();
  await type(originalNote, "Reservasi kabinet untuk pemasangan kitchen");
  await act(async (): Promise<void> => {
    originalNote.focus();
  });
  const reviewedSummary = host.querySelector("[data-stock-summary]")?.textContent;
  await resize(390);
  await resize(1440);
  assert.equal(note(), originalNote, "Resize retains the exact focused note input DOM");
  assert.equal(document.activeElement, originalNote, "Focused field retains focus through resize");
  assert.equal(note().value, "Reservasi kabinet untuk pemasangan kitchen");
  const previousStock = initial.projectStockData;
  assert(previousStock?.rap);
  await render({
    ...initial,
    project: { ...initial.project, name: "Incoming unreviewed material revision" },
    projectBudgetDashboard: initial.projectBudgetDashboard
      ? { ...initial.projectBudgetDashboard, status: "DRAFT" }
      : null,
    projectStockData: {
      ...previousStock,
      rap: {
        id: "unreviewed-rap",
        items: previousStock.rap.items.map((row) => ({ ...row, id: `unreviewed-${row.id}` })),
      },
    },
  });
  assert.equal(note(), originalNote, "Incoming replacement RAP also preserves the editor DOM");
  assert.equal(host.querySelector("[data-stock-summary]")?.textContent, reviewedSummary);
  assert.equal(host.querySelector("[data-project-lock]")?.textContent, "false");
  await render(sourceChanged);
  assert.equal(note(), originalNote, "Incoming null stock source does not reset an open editor");
  assert.equal(
    host.querySelector("[data-project-lock]")?.textContent,
    "false",
    "Incoming missing budget does not lock the reviewed stock workflow",
  );
  assert.equal(host.querySelector("[data-stock-summary]")?.textContent, reviewedSummary);
  assert(
    !host.textContent?.includes("Incoming project revision"),
    "Project identity stays on the reviewed snapshot",
  );
  const primary = host.querySelector<HTMLButtonElement>("[data-stock-primary]");
  assert(
    primary && !primary.disabled,
    "Complete actual selectors, quantity, and note enable review",
  );
  await click(primary);
  assert(
    host.querySelector("[data-stock-sheet]")?.textContent?.includes("Tinjau operasi material"),
  );
  await click(button("Catat"));
  assert(submitted);
  assert.equal(Reflect.get(submitted, "projectId"), initial.project.id);
  assert.equal(Reflect.get(submitted, "projectRapItemId"), item.id);
  assert.equal(Reflect.get(submitted, "materialId"), item.materialId);
  assert.equal(Reflect.get(submitted, "inventoryLocationId"), inventory.locationId);
  assert.equal(Reflect.get(submitted, "quantity"), 1.25);
  assert.equal(Reflect.get(submitted, "note"), "Reservasi kabinet untuk pemasangan kitchen");
  assert.equal(host.querySelector("[data-stock-pending]")?.textContent, "true");
  await render({
    ...sourceChanged,
    projectStockData: { source: { status: "missing" }, rap: null, materials: [] },
  });
  await resize(360);
  await resize(1280);
  assert.equal(
    host.querySelector("[data-project-lock]")?.textContent,
    "false",
    "Pending action keeps its project/budget baseline",
  );
  assert(finish);
  await act(async (): Promise<void> => {
    finish?.({
      success: false,
      error: { code: "CONFLICT", message: "Safe stock fixture failure" },
    });
  });
  await click(button("Ubah"));
  assert.equal(
    note().value,
    "Reservasi kabinet untuk pemasangan kitchen",
    "Failed mutation retains the draft for correction",
  );
  await click(button("Test close stock"));
  assert(
    document.body.textContent?.includes("Buang perubahan operasi material?"),
    "Actual dirty dismissal requests explicit discard",
  );
  await click(button("Buang Perubahan"));
  assert.equal(
    host.querySelector("[data-project-lock]")?.textContent,
    "true",
    "Deferred source adopts only after explicit close",
  );
  assert.equal(host.querySelector("[data-stock-sheet]"), null);
  assert(host.textContent?.includes("Incoming project revision"));
  assert.equal(new URL(window.location.href).searchParams.get("keep"), "1");
  assert.equal(window.location.hash, "#rincian");
  console.log("Project stock actual owner source-freeze DOM regressions passed");
} finally {
  await act(async (): Promise<void> => {
    root.unmount();
  });
  await browser.happyDOM.close();
}
