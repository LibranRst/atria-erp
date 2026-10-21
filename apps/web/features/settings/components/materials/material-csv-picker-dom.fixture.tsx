import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { MaterialImportInput } from "@/app/actions/settings/material-import";
import type { WorkspacePresentation } from "@/lib/navigation/workspace-routes";

const browser = new Window({ url: "https://atria.test/settings", width: 1440, height: 976 });
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
  useRouter: (): ReturnType<typeof nextNavigation.useRouter> => ({
    bfcacheId: "material-csv-picker",
    back: (): void => {},
    forward: (): void => {},
    refresh: (): void => {},
    push: (): void => {},
    replace: (): void => {},
    prefetch: (): void => {},
  }),
}));

let previewCalls = 0;
let commitCalls = 0;
let resolvePreview: ((result: ActionResponse<never>) => void) | undefined;
mock.module("@/app/actions/settings/material-import", () => ({
  previewMaterialImport: async (input: MaterialImportInput): Promise<ActionResponse<never>> => {
    previewCalls += 1;
    assert.equal(input.rows.length, 1);
    assert.equal(input.rows[0]?.name, "Multipleks");
    return new Promise<ActionResponse<never>>((resolve) => {
      resolvePreview = resolve;
    });
  },
  commitMaterialImport: async (): Promise<ActionResponse<never>> => {
    commitCalls += 1;
    throw new Error("The picker fixture never commits an import");
  },
}));
mock.module("sonner", () => ({
  toast: { success: (): void => {}, error: (): void => {}, warning: (): void => {} },
}));

const { createRoot } = await import("react-dom/client");
const { DesktopUIProvider } = await import("@/components/ui");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { OpeningInventoryCsvEntry } =
  await import("@/features/materials/components/workspaces/opening-inventory-csv-entry");
const { MaterialImportSheet } = await import("./material-import-sheet");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
const longName = `${"material_".repeat(24)}.csv`;
let selectedOpeningFile: File | null = null;
let openingPending = false;
let openingFileName = "";
let materialOpen = false;
function Fixture({
  presentation,
}: {
  readonly presentation: WorkspacePresentation;
}): React.JSX.Element {
  return (
    <WorkspacePresentationProvider presentation={presentation}>
      <DesktopUIProvider responsive>
        <OpeningInventoryCsvEntry
          preview={null}
          pending={openingPending}
          fileName={openingFileName}
          onFileSelected={async (file): Promise<void> => {
            selectedOpeningFile = file;
          }}
        />
        <MaterialImportSheet
          open={materialOpen}
          onClose={(): void => {
            materialOpen = false;
          }}
        />
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
async function render(width: number): Promise<void> {
  await act(async (): Promise<void> => {
    browser.happyDOM.setWindowSize({ width, height: 976 });
    window.dispatchEvent(new Event("resize"));
    root.render(<Fixture presentation={width >= 1024 ? "desktop" : "mobile"} />);
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
  });
}
function fileInput(container: ParentNode): HTMLInputElement {
  const input = container.querySelector("input[type=file]");
  assert(input instanceof HTMLInputElement);
  assert.equal(input.accept, ".csv,text/csv");
  assert.equal(input.tabIndex, -1);
  return input;
}
function picker(container: ParentNode): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find((element) =>
    /^(Pilih|Ganti) file CSV/.test(element.getAttribute("aria-label") ?? ""),
  );
  assert(button instanceof HTMLButtonElement, "A keyboard-operable file chooser is visible");
  return button;
}
async function activateFocusedButton(button: HTMLButtonElement): Promise<void> {
  await act(async (): Promise<void> => {
    button.focus();
    assert(
      Boolean(document.activeElement === button),
      "The visible chooser receives keyboard focus",
    );
    button.click();
  });
}
async function choose(input: HTMLInputElement, file: File): Promise<void> {
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async (): Promise<void> => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  });
}
function safeFilename(button: HTMLButtonElement): void {
  const filename = [...button.querySelectorAll("span")].find(
    (span) => span.textContent === longName && span.classList.contains("truncate"),
  );
  assert(filename?.classList.contains("min-w-0"));
  assert.equal(
    filename?.title,
    longName,
    "The exact filename remains available beyond visual truncation",
  );
  assert(button.getAttribute("aria-label")?.includes(longName));
}

await render(1440);
const openingInput = fileInput(host);
let openingClicks = 0;
openingInput.click = (): void => {
  openingClicks += 1;
};
await activateFocusedButton(picker(host));
assert.equal(openingClicks, 1, "The focused chooser opens the actual native input once");
await act(async (): Promise<void> => picker(host).click());
assert.equal(openingClicks, 2, "Pointer activation reaches the same input");
const openingFile = new File(
  ["material_name,location_name,quantity,unit_cost\nMultipleks,Gudang,2,100\n"],
  longName,
  { type: "text/csv" },
);
await choose(openingInput, openingFile);
assert(
  Boolean(selectedOpeningFile === openingFile),
  "The existing opening import handler receives the selected file",
);
openingFileName = longName;
openingPending = true;
await render(1440);
safeFilename(picker(host));
assert(
  fileInput(host).disabled && picker(host).disabled,
  "Pending disables chooser and native input together",
);
await act(async (): Promise<void> => picker(host).click());
assert.equal(openingClicks, 2);
openingPending = false;
await render(390);
assert(
  Boolean(fileInput(host) === openingInput),
  "Native file input survives a presentation change",
);
safeFilename(picker(host));
await render(1280);
await activateFocusedButton(picker(host));
assert.equal(openingClicks, 3);

materialOpen = true;
await render(1440);
const dialog = document.querySelector('[role="dialog"][aria-label="Impor Material Master"]');
assert(dialog instanceof HTMLElement);
const materialInput = fileInput(dialog);
let materialClicks = 0;
materialInput.click = (): void => {
  materialClicks += 1;
};
await activateFocusedButton(picker(dialog));
assert.equal(materialClicks, 1);
const materialFile = new File(
  ["name,category,unit,location\nMultipleks,Panel,lembar,Gudang\n"],
  longName,
  { type: "text/csv" },
);
await choose(materialInput, materialFile);
assert.equal(previewCalls, 1, "The unchanged parser and preview action receive the CSV");
safeFilename(picker(dialog));
assert(materialInput.disabled && picker(dialog).disabled);
await act(async (): Promise<void> => picker(dialog).click());
assert.equal(materialClicks, 1, "Pending preview cannot open another chooser");
assert(resolvePreview);
await act(async (): Promise<void> =>
  resolvePreview?.({
    success: false,
    error: { code: "VALIDATION_ERROR", message: "Fixture preview only" },
  }),
);
await render(390);
assert(Boolean(fileInput(dialog) === materialInput));
safeFilename(picker(dialog));
await render(1280);
await activateFocusedButton(picker(dialog));
assert.equal(materialClicks, 2);
assert.equal(commitCalls, 0, "Choosing and validating files never commits an import");
await act(async (): Promise<void> => root.unmount());
await browser.happyDOM.abort();
console.log("Material CSV picker DOM regression passed");
