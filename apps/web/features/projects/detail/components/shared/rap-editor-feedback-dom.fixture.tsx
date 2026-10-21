import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  rapRabFixtureData,
  rapRabFixturePermissions,
  type RapRabFixtureKind,
} from "../../../../../.storybook/rap-rab-data.fixture";

const browser = new Window({
  url: "https://atria.test/projects/fixture?tab=rap",
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
let refreshes = 0;
mock.module("next/navigation", (): typeof nextNavigation => ({
  ...nextNavigation,
  usePathname: (): string => "/projects/fixture",
  useSearchParams: (): ReturnType<typeof nextNavigation.useSearchParams> =>
    new nextNavigation.ReadonlyURLSearchParams(window.location.search),
  useRouter: (): ReturnType<typeof nextNavigation.useRouter> => ({
    bfcacheId: "rap-editor-feedback",
    back: (): void => {},
    forward: (): void => {},
    refresh: (): void => {
      refreshes += 1;
    },
    push: (): void => {},
    replace: (): void => {},
    prefetch: (): void => {},
  }),
}));
const errorToasts: string[] = [];
const successToasts: string[] = [];
mock.module("sonner", () => ({
  toast: {
    error: (message: string): void => {
      errorToasts.push(message);
    },
    success: (message: string): void => {
      successToasts.push(message);
    },
  },
}));
const calls: { readonly operation: string; readonly args: readonly unknown[] }[] = [];
let release: ((result: ActionResponse<unknown>) => void) | null = null;
const failure: ActionResponse<never> = {
  success: false,
  error: { code: "CONFLICT", message: "Data berubah. Periksa kembali draft sebelum menyimpan." },
};
mock.module("@/lib/api/backend", () => ({
  callBackendAction: async (
    operation: string,
    args: readonly unknown[],
  ): Promise<ActionResponse<unknown>> => {
    calls.push({ operation, args });
    return new Promise<ActionResponse<unknown>>((resolve) => {
      release = resolve;
    });
  },
  callBackendQuery: async (): Promise<ActionResponse<never>> => failure,
}));
const { createRoot } = await import("react-dom/client");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { useWorkspaceViewportPresentation } = await import("@/lib/navigation/workspace-viewport");
const { PermissionsProvider } = await import("@/components/auth/permissions-provider");
const { DesktopUIProvider } = await import("@/components/ui");
const { RapRabManager } = await import("./rap-rab-manager");
let scenario: RapRabFixtureKind = "draft-material";
let generation = 0;
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
function Fixture(): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation();
  return (
    <WorkspacePresentationProvider presentation={presentation}>
      <DesktopUIProvider responsive>
        <PermissionsProvider permissions={rapRabFixturePermissions("owner")}>
          <RapRabManager
            key={generation}
            {...rapRabFixtureData(scenario)}
            userRole="OWNER"
            mode="rap"
          />
        </PermissionsProvider>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
async function settle(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
  });
}
async function render(width = 1440): Promise<void> {
  await act(async (): Promise<void> => {
    browser.happyDOM.setWindowSize({ width, height: 976 });
    window.dispatchEvent(new Event("resize"));
    root.render(<Fixture />);
  });
  await settle();
}
function visible(element: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement)
    if (
      current.hasAttribute("hidden") ||
      current.hasAttribute("inert") ||
      current.getAttribute("aria-hidden") === "true" ||
      getComputedStyle(current).display === "none"
    )
      return false;
  return true;
}
function button(container: ParentNode, label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find(
    (item) => visible(item) && item.textContent?.trim() === label,
  );
  assert(found instanceof HTMLButtonElement, `Visible ${label} button exists`);
  return found;
}
async function click(control: HTMLElement): Promise<void> {
  await act(async (): Promise<void> => control.click());
  await settle();
}
function dialog(title: string): HTMLElement {
  const found = [...document.querySelectorAll('[role="dialog"]')].find(
    (item) => item.getAttribute("aria-label") === title && visible(item),
  );
  assert(found instanceof HTMLElement, `Visible ${title} editor exists`);
  return found;
}
function selectTrigger(container: ParentNode, label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button[aria-haspopup="listbox"]')].find((item) =>
    (item.getAttribute("aria-labelledby") ?? "")
      .split(" ")
      .some((id) => document.getElementById(id)?.textContent?.trim().startsWith(label)),
  );
  assert(found instanceof HTMLButtonElement, `${label} is an actual shared select`);
  return found;
}
async function type(input: HTMLInputElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  assert(setter);
  await act(async (): Promise<void> => {
    input.focus();
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
}
async function resolve(result: ActionResponse<unknown>): Promise<void> {
  const finish = release;
  assert(finish, "A mocked save is pending");
  release = null;
  await act(async (): Promise<void> => finish(result));
  await settle();
}
function payloadName(index: number): unknown {
  const payload = calls[index]?.args[0];
  assert(payload && typeof payload === "object" && "name" in payload);
  return payload.name;
}

for (const testCase of [
  {
    kind: "draft-material" as const,
    section: "Material RAP",
    detail: "Buka detail material",
    edit: "Edit Material",
    title: "Edit Material RAP",
    placeholder: "Contoh: Multipleks 18mm",
    operation: ".updateProjectRapItem",
    selector: "Sumber Pemenuhan",
  },
  {
    kind: "draft-tukang" as const,
    section: "Paket Tukang",
    detail: "Buka detail paket",
    edit: "Edit",
    title: "Edit Paket Kerja",
    placeholder: "Nama paket kerja",
    operation: ".updateProjectCategoryPlanItem",
    selector: "Kategori Budget",
  },
]) {
  scenario = testCase.kind;
  generation += 1;
  await render();
  const collection = document.querySelector(`section[aria-label="${testCase.section}"]`);
  assert(collection instanceof HTMLElement);
  const firstRow = collection.querySelector("tbody tr");
  assert(firstRow instanceof HTMLElement);
  await click(firstRow);
  await click(button(document, testCase.detail));
  const detailTitle =
    testCase.kind === "draft-material" ? "Detail Material RAP" : "Detail Paket Kerja";
  await click(button(dialog(detailTitle), testCase.edit));
  const editor = dialog(testCase.title);
  const input = editor.querySelector<HTMLInputElement>(
    `input[placeholder="${testCase.placeholder}"]`,
  );
  assert(input);
  const original = input.value;
  const callStart = calls.length;
  const errorStart = errorToasts.length;
  const successStart = successToasts.length;
  const form = editor.querySelector("form");
  assert(form);
  const selector = selectTrigger(editor, testCase.selector);
  const originalSelection = selector.textContent;
  await click(selector);
  const pendingOption = [...document.querySelectorAll('[role="option"]')].find(
    (option) => visible(option) && option.getAttribute("aria-selected") !== "true",
  );
  assert(pendingOption instanceof HTMLElement, "The real select menu is open before save starts");
  await act(async (): Promise<void> => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await settle();
  assert.equal(calls.length, callStart + 1);
  assert(calls.at(-1)?.operation.endsWith(testCase.operation));
  assert.equal(payloadName(callStart), original);
  assert(input.disabled && selector.disabled, "Inputs and select triggers disable while saving");
  assert(
    [
      ...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input:not([type="hidden"]), textarea',
      ),
    ].every((control) => control.disabled),
    "Every editable native field is disabled while the request is pending",
  );
  await act(async (): Promise<void> => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await settle();
  assert.equal(
    calls.length,
    callStart + 1,
    "A second form submission cannot bypass the pending footer",
  );
  await type(input, `${original} — perubahan saat pending`);
  assert.equal(input.value, original, "Pending input events cannot change the draft intent");
  if (pendingOption.isConnected && visible(pendingOption)) await click(pendingOption);
  assert.equal(
    selector.textContent,
    originalSelection,
    "An already-portaled option cannot change pending selection",
  );
  assert.equal(editor.querySelectorAll('[role="alert"]').length, 0);
  await resolve(failure);
  assert(
    Boolean(dialog(testCase.title) === editor),
    "Failure keeps the actual editor owner mounted",
  );
  assert.equal(input.value, original, "Failed save retains the original draft values");
  const alert = editor.querySelector('[role="alert"]');
  assert(alert && visible(alert));
  assert(alert.textContent?.includes(failure.success ? "" : failure.error.message));
  assert.equal(errorToasts.length, errorStart + 1, "One failed save creates one toast");
  const corrected = `${original} — dikoreksi`;
  await type(input, corrected);
  await render(390);
  assert(Boolean(dialog(testCase.title) === editor), "Resize preserves the open editor owner");
  assert.equal(input.value, corrected);
  assert(Boolean(document.activeElement === input), "Correction focus survives resize");
  await render(1440);
  await click(button(editor, "Perbarui"));
  assert.equal(calls.length, callStart + 2, "Explicit retry makes only one additional save");
  assert.equal(payloadName(callStart + 1), corrected);
  assert.equal(
    editor.querySelectorAll('[role="alert"]').length,
    0,
    "Retry clears the old error through the existing action reset",
  );
  await resolve({ success: true, data: null });
  assert.equal(successToasts.length, successStart + 1, "One successful retry creates one toast");
  assert.equal(errorToasts.length, errorStart + 1);
  assert.equal(refreshes, generation, "Only successful saves refresh source data");
}

scenario = "draft-tukang";
generation += 1;
await render();
const materialTab = [...document.querySelectorAll('[role="tab"]')].find(
  (tab) => visible(tab) && tab.textContent?.includes("Material"),
);
assert(materialTab instanceof HTMLElement);
await click(materialTab);
const materialCollection = document.querySelector('section[aria-label="Material RAP"]');
const materialRow = materialCollection?.querySelector("tbody tr");
assert(materialRow instanceof HTMLElement);
await click(materialRow);
await click(button(document, "Buka detail material"));
await click(button(dialog("Detail Material RAP"), "Edit Material"));
const failedEditor = dialog("Edit Material RAP");
await click(button(failedEditor, "Perbarui"));
await resolve(failure);
assert(failedEditor.querySelector('[role="alert"]'));
const close = failedEditor.querySelector('button[aria-label="Tutup"]');
assert(close instanceof HTMLButtonElement);
await click(close);
const tukangTab = [...document.querySelectorAll('[role="tab"]')].find(
  (tab) => visible(tab) && tab.textContent?.includes("Tukang"),
);
assert(tukangTab instanceof HTMLElement);
await click(tukangTab);
const writesBeforeOpening = calls.length;
const errorsBeforeOpening = errorToasts.length;
await click(button(document, "Tambah paket"));
const newPackageEditor = dialog("Tambah Paket Tukang/Subcon");
assert.equal(
  newPackageEditor.querySelectorAll('[role="alert"]').length,
  0,
  "A previous material failure does not leak into a new package editor",
);
assert.equal(calls.length, writesBeforeOpening, "Switching editors never submits a draft");
assert.equal(
  errorToasts.length,
  errorsBeforeOpening,
  "Clearing old feedback does not emit another toast",
);
await act(async (): Promise<void> => root.unmount());
await browser.happyDOM.abort();
console.log("RAP editor feedback DOM regression passed");
