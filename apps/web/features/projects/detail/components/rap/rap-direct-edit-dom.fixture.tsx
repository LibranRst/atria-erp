import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { PermissionKey } from "@atria/core/auth/permissions";
import type { RapRabFixtureData } from "../../../../../.storybook/rap-rab-data.fixture";
import type { advanceProjectRapSetup } from "@/app/actions/project/rap-setup";

const browser = new Window({
  url: "https://atria.test/projects/direct-edit?tab=rap&keep=1#plan",
  width: 1024,
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
const next = await import("next/navigation");
mock.module("next/navigation", (): typeof next => ({
  ...next,
  usePathname: (): string => "/projects/direct-edit",
  useSearchParams: (): ReturnType<typeof next.useSearchParams> =>
    new next.ReadonlyURLSearchParams(window.location.search),
  useRouter: (): ReturnType<typeof next.useRouter> => ({
    bfcacheId: "rap-direct-edit",
    back: (): void => {},
    forward: (): void => {},
    refresh: (): void => {},
    push: (): void => {},
    replace: (): void => {},
    prefetch: (): void => {},
  }),
}));
type AdvanceResult = Awaited<ReturnType<typeof advanceProjectRapSetup>>;
let finishAdvance: ((result: AdvanceResult) => void) | undefined;
let advanceCalls = 0;
const setupActions = await import("@/app/actions/project/rap-setup");
mock.module("@/app/actions/project/rap-setup", () => ({
  ...setupActions,
  advanceProjectRapSetup: (): Promise<AdvanceResult> => {
    advanceCalls += 1;
    return new Promise((resolve) => {
      finishAdvance = resolve;
    });
  },
}));
let unexpectedWrites = 0;
function forbiddenWrite(): Promise<never> {
  unexpectedWrites += 1;
  return Promise.reject(new Error("Direct edit regression never saves business data"));
}
const rapActions = await import("@/app/actions/project/rap-rab");
mock.module("@/app/actions/project/rap-rab", () => ({
  ...rapActions,
  addProjectRapItem: forbiddenWrite,
  updateProjectRapItem: forbiddenWrite,
  createProjectRap: forbiddenWrite,
  deleteProjectRapItem: forbiddenWrite,
}));
const packageActions = await import("@/app/actions/project/category-plan");
mock.module("@/app/actions/project/category-plan", () => ({
  ...packageActions,
  createProjectCategoryPlanItem: forbiddenWrite,
  updateProjectCategoryPlanItem: forbiddenWrite,
  deleteProjectCategoryPlanItem: forbiddenWrite,
  markProjectCategoryPlanItemActive: forbiddenWrite,
}));
const { createRoot } = await import("react-dom/client");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { useWorkspaceViewportPresentation } = await import("@/lib/navigation/workspace-viewport");
const { PermissionsProvider } = await import("@/components/auth/permissions-provider");
const { DesktopUIProvider } = await import("@/components/ui");
const { RapRabManager } = await import("../shared/rap-rab-manager");
const { rapRabFixtureData, rapRabFixturePermissions } =
  await import("../../../../../.storybook/rap-rab-data.fixture");
const ownerPermissions = rapRabFixturePermissions("owner");
const visibility = document.createElement("style");
visibility.textContent =
  ".hidden{display:none}@media(min-width:1280px){.xl\\:block{display:block}.xl\\:hidden{display:none}}";
document.head.append(visibility);
function Owner({
  data,
  permissions,
}: {
  readonly data: RapRabFixtureData;
  readonly permissions: readonly PermissionKey[];
}): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation();
  return (
    <WorkspacePresentationProvider presentation={presentation}>
      <DesktopUIProvider responsive>
        <PermissionsProvider permissions={permissions}>
          <RapRabManager {...data} userRole="OWNER" mode="rap" />
        </PermissionsProvider>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
async function settle(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 45));
  });
}
async function render(
  data: RapRabFixtureData,
  key: string,
  permissions = ownerPermissions,
): Promise<void> {
  await act(async (): Promise<void> => {
    root.render(<Owner key={key} data={data} permissions={permissions} />);
  });
  await settle();
}
async function resize(width: number): Promise<void> {
  await act(async (): Promise<void> => {
    browser.happyDOM.setWindowSize({ width, height: 976 });
    window.dispatchEvent(new Event("resize"));
  });
  await settle();
}
function visible(element: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement) {
    if (
      current.hasAttribute("hidden") ||
      current.hasAttribute("inert") ||
      getComputedStyle(current).display === "none"
    )
      return false;
  }
  return true;
}
function table(): HTMLTableElement {
  const found = [...host.querySelectorAll<HTMLTableElement>("table")].find(visible);
  assert(found, "The actual RAP owner exposes its current desktop collection");
  return found;
}
function row(name: string): HTMLElement {
  const found = [...table().querySelectorAll<HTMLElement>("tbody tr")].find((item) =>
    item.textContent?.includes(name),
  );
  assert(found, `RAP row ${name} exists on the current page`);
  return found;
}
function findButton(label: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => visible(item) && item.textContent?.trim() === label,
  );
}
function button(label: string): HTMLButtonElement {
  const found = findButton(label);
  assert(found, `Visible action ${label} exists`);
  return found;
}
async function press(element: HTMLElement): Promise<void> {
  await act(async (): Promise<void> => {
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    element.focus();
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    element.click();
  });
  await settle();
}
async function selectByKeyboard(element: HTMLElement, key: "Enter" | " "): Promise<void> {
  await act(async (): Promise<void> => {
    element.focus();
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    element.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }));
  });
  await settle();
}
function dialog(title: string): HTMLElement {
  const found = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find(
    (item) => item.getAttribute("aria-label") === title,
  );
  assert(found, `Existing shared ${title} editor is open`);
  return found;
}
async function closeClean(title: string, invoker: HTMLElement): Promise<void> {
  const close = dialog(title).querySelector<HTMLButtonElement>('button[aria-label="Tutup"]');
  assert(close);
  await press(close);
  // Exit and FocusScope restoration finish on separate frames; suite load may
  // delay those frames beyond the animation's nominal duration.
  const deadline = performance.now() + 5_000;
  while (
    (document.querySelectorAll('[role="dialog"]').length !== 0 ||
      document.activeElement !== invoker) &&
    performance.now() < deadline
  ) {
    await act(async (): Promise<void> => {
      await new Promise<void>((resolve) => setTimeout(resolve, 25));
    });
  }
  assert.equal(
    document.querySelectorAll('[role="dialog"]').length,
    0,
    "An unchanged editor closes without a discard confirmation",
  );
  assert(
    Boolean(document.activeElement === invoker),
    "Clean close restores focus to the exact direct Edit invoker",
  );
}
function field(title: string, label: string): HTMLInputElement {
  const owner = dialog(title);
  const targetLabel = [...owner.querySelectorAll("label")].find(
    (item) => item.textContent?.trim() === label,
  );
  const id = targetLabel?.getAttribute("for");
  const input = id ? document.getElementById(id) : null;
  assert(input instanceof HTMLInputElement, `Actual ${label} field is associated`);
  return input;
}
async function type(input: HTMLInputElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  assert(setter);
  await act(async (): Promise<void> => {
    input.focus();
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function source(kind: "material" | "package"): RapRabFixtureData {
  const data = rapRabFixtureData(kind === "material" ? "draft-material" : "draft-tukang");
  assert(data.rap);
  return {
    ...data,
    rap: { ...data.rap, items: data.rap.items.slice(0, 3) },
    categoryPlanItems: data.categoryPlanItems.slice(0, 3),
  };
}
try {
  const materialData = source("material");
  const materialRap = materialData.rap;
  assert(materialRap);
  const materialItem = materialRap.items[1];
  assert(materialItem);
  await render(materialData, "material");
  assert.equal(findButton("Edit material"), undefined, "Initial table has no active row or editor");
  await selectByKeyboard(row(materialItem.name), "Enter");
  assert(
    Boolean(document.activeElement === button("Kembali ke daftar")),
    "Keyboard selection moves focus into the narrow detail owner",
  );
  const materialEdit = button("Edit material");
  await press(materialEdit);
  assert.equal(field("Edit Material RAP", "Nama Material").value, materialItem.name);
  await closeClean("Edit Material RAP", materialEdit);
  await press(materialEdit);
  const materialName = field("Edit Material RAP", "Nama Material");
  assert.equal(materialName.value, materialItem.name);
  assert.equal(field("Edit Material RAP", "Jumlah").value, materialItem.requiredQuantity);
  assert.equal(
    field("Edit Material RAP", "Biaya per Satuan").value,
    materialItem.estimatedUnitCost,
  );
  await type(materialName, "Material draft yang sedang diedit");
  await resize(390);
  await resize(1440);
  assert(
    Boolean(field("Edit Material RAP", "Nama Material") === materialName),
    "Resize retains the exact existing material input DOM",
  );
  assert(Boolean(document.activeElement === materialName), "Resize retains native field focus");
  const replacement: RapRabFixtureData = {
    ...materialData,
    rap: {
      ...materialRap,
      status: "LOCKED",
      items: materialRap.items.map((item) => ({
        ...item,
        name: "Incoming replacement source",
      })),
    },
  };
  await render(replacement, "material");
  assert.equal(
    materialName.value,
    "Material draft yang sedang diedit",
    "Incoming source does not replace an open manual edit draft",
  );
  assert(Boolean(field("Edit Material RAP", "Nama Material") === materialName));
  assert.equal(
    document.querySelectorAll('[role="dialog"]').length,
    1,
    "Direct edit opens the existing form without an intermediate detail modal",
  );

  const packageData = source("package");
  const packageItem = packageData.categoryPlanItems[1];
  assert(packageItem);
  await resize(1024);
  await render(packageData, "package");
  await selectByKeyboard(row(packageItem.name), " ");
  assert(Boolean(document.activeElement === button("Kembali ke daftar")));
  const packageEdit = button("Edit paket");
  await press(packageEdit);
  assert.equal(field("Edit Paket Kerja", "Nama Paket").value, packageItem.name);
  await closeClean("Edit Paket Kerja", packageEdit);
  await press(packageEdit);
  const packageName = field("Edit Paket Kerja", "Nama Paket");
  assert.equal(packageName.value, packageItem.name);
  assert.equal(field("Edit Paket Kerja", "Jumlah").value, packageItem.quantity);
  await type(packageName, "Paket draft yang sedang diedit");
  await resize(390);
  await resize(1440);
  assert(Boolean(field("Edit Paket Kerja", "Nama Paket") === packageName));
  assert(Boolean(document.activeElement === packageName));
  await render(
    {
      ...packageData,
      categoryPlanItems: packageData.categoryPlanItems.map((item) => ({
        ...item,
        name: "Incoming package source",
        status: "ACTIVE",
      })),
    },
    "package",
  );
  assert.equal(packageName.value, "Paket draft yang sedang diedit");
  assert(Boolean(field("Edit Paket Kerja", "Nama Paket") === packageName));

  await render(materialData, "read-only-material", rapRabFixturePermissions("read-only"));
  await selectByKeyboard(row(materialItem.name), "Enter");
  assert.equal(findButton("Edit material"), undefined, "Read-only RAP has no direct material edit");
  assert(findButton("Buka detail material"));
  await render(packageData, "read-only-package", rapRabFixturePermissions("read-only"));
  await selectByKeyboard(row(packageItem.name), "Enter");
  assert.equal(findButton("Edit paket"), undefined, "Read-only budget has no direct package edit");

  assert(materialData.rap);
  await render(
    { ...materialData, rap: { ...materialData.rap, status: "LOCKED", setupStage: "COMPLETE" } },
    "locked-material",
  );
  await selectByKeyboard(row(materialItem.name), "Enter");
  assert.equal(
    findButton("Edit material"),
    undefined,
    "Locked execution cannot enter the draft editor",
  );
  assert(
    table().textContent?.includes("Realisasi"),
    "Locked execution retains actual-cost context",
  );

  await render(
    {
      ...packageData,
      categoryPlanItems: packageData.categoryPlanItems.map((item) => ({
        ...item,
        status: "ACTIVE",
      })),
    },
    "active-package",
  );
  await selectByKeyboard(row(packageItem.name), "Enter");
  assert.equal(
    findButton("Edit paket"),
    undefined,
    "An active package cannot bypass its DRAFT gate",
  );
  assert(findButton("Buka detail paket"));

  await render(materialData, "pending-material");
  await selectByKeyboard(row(materialItem.name), "Enter");
  await press(button("Lanjut ke Tukang"));
  assert.equal(advanceCalls, 1, "The existing setup action is paused in its safe mocked seam");
  assert(button("Edit material").disabled, "Pending setup blocks opening a competing editor");
  await press(button("Edit material"));
  assert.equal(document.querySelectorAll('[role="dialog"]').length, 0);
  assert.equal(advanceCalls, 1);
  assert(finishAdvance);
  await act(async (): Promise<void> => {
    finishAdvance?.({
      success: false,
      error: { code: "CONFLICT", message: "Safe pending fixture completed" },
    });
  });
  await settle();
  assert(!button("Edit material").disabled, "Edit becomes available again after setup completes");
  assert.equal(unexpectedWrites, 0, "Direct editing and read-only checks never call a writer");
  assert.equal(window.location.hash, "#plan");
  assert.equal(new URLSearchParams(window.location.search).get("keep"), "1");
  console.log(
    "Actual RAP direct edit preserves selected source, draft, focus and permission/pending gates",
  );
} finally {
  if (finishAdvance)
    await act(async (): Promise<void> => {
      finishAdvance?.({ success: false, error: { code: "CONFLICT", message: "Fixture cleanup" } });
    });
  await act(async (): Promise<void> => {
    root.unmount();
  });
  await browser.happyDOM.close();
}
