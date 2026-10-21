import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { Draft } from "../../types/library-types";
import type { WorkspacePresentation } from "@/lib/navigation/workspace-routes";

const browserWindow = new Window({ url: "https://atria.test/ledger", width: 1280, height: 960 });
Reflect.set(browserWindow.Element.prototype, "animate", undefined);
// React Aria focus restoration dispatches CustomEvent. Bind it to the same
// HappyDOM realm as Event; Bun's native constructor cannot model DOM dispatch.
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
  useRouter: (): ReturnType<typeof nextNavigation.useRouter> => ({
    bfcacheId: "dropdown-fixture",
    back: (): void => {},
    forward: (): void => {},
    refresh: (): void => {},
    push: (): void => {},
    replace: (): void => {},
    prefetch: (): void => {},
  }),
}));

const { createRoot } = await import("react-dom/client");
const { DesktopUIProvider } = await import("@/components/ui");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { LibraryTemplateEditorSheet } = await import("./library-template-editor-sheet");
const initialDraft: Draft = {
  id: "template-fixture",
  expenseCategoryId: "material",
  materialId: null,
  defaultVendorId: null,
  code: "",
  itemType: "CLIENT_LINE",
  itemCategory: "Finishing",
  name: "Template contoh",
  description: "",
  unit: "m2",
  pricingMode: "MARGIN_BASED",
  targetGrossPercentage: 0.4,
  fixedClientPrice: 0,
  priceSourceType: "COST_BREAKDOWN",
  sourceNote: "Rincian biaya fixture",
  effectiveFrom: "2026-10-14",
  isActive: true,
  components: [
    {
      key: "component",
      vendorId: null,
      componentType: "MATERIAL",
      label: "Material contoh",
      quantity: 2,
      unit: "m2",
      unitCost: 100_000,
      note: "",
    },
  ],
};
let observedName = initialDraft.name;
function Fixture({
  presentation,
}: {
  readonly presentation: WorkspacePresentation;
}): React.JSX.Element {
  const [draft, setDraft] = React.useState(initialDraft);
  function updateDraft(next: Draft): void {
    observedName = next.name;
    setDraft(next);
  }
  return (
    <WorkspacePresentationProvider presentation={presentation}>
      <DesktopUIProvider responsive>
        <LibraryTemplateEditorSheet
          draft={draft}
          categories={[
            {
              id: "material",
              code: "MATERIAL",
              name: "Material",
              description: "",
              defaultRatio: 0.4,
              sortOrder: 0,
              isActive: true,
              isCore: true,
            },
          ]}
          materials={[]}
          vendors={[]}
          canManage
          pending={false}
          canSave
          disabledReason={undefined}
          internalCost={200_000}
          clientPrice={200_000 / 0.6}
          grossMargin={40}
          dirty={draft.name !== initialDraft.name}
          nameTouched={false}
          sourceTouched={false}
          sourceOpen={false}
          onClose={(): void => {}}
          onSubmit={(): void => {
            throw new Error("The resize fixture must never submit");
          }}
          onDraftChange={updateDraft}
          onItemTypeChange={(): void => {}}
          onAddComponent={(): void => {}}
          onOpenComponent={(): void => {}}
          onNameTouched={(): void => {}}
          onSourceTouched={(): void => {}}
          onSourceOpenChange={(): void => {}}
          onRequestToggle={(): void => {
            throw new Error("The resize fixture must never archive");
          }}
        />
      </DesktopUIProvider>
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
async function render(
  presentation: WorkspacePresentation,
  width = 1280,
  height = 960,
): Promise<void> {
  await act(async (): Promise<void> => {
    browserWindow.happyDOM.setWindowSize({ width, height });
    root.render(<Fixture presentation={presentation} />);
  });
  await settle();
}
function nameInput(): HTMLInputElement {
  const label = [...document.querySelectorAll("label")].find((candidate) =>
    candidate.textContent?.includes("Nama template"),
  );
  assert.ok(label?.htmlFor, "the name label remains associated with its shared input");
  const input = document.getElementById(label.htmlFor);
  assert.ok(input instanceof HTMLInputElement);
  return input;
}
async function type(input: HTMLInputElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  assert.ok(setter);
  await act(async (): Promise<void> => {
    input.focus();
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
}
try {
  await render("desktop");
  assert.ok(
    document.querySelector('[role="dialog"]'),
    "desktop editing uses the canonical shared form overlay",
  );
  const input = nameInput();
  const id = input.id;
  await type(input, "Draft desktop belum disimpan");
  assert.equal(observedName, "Draft desktop belum disimpan");
  assert.ok(document.activeElement === input, "typing retains input focus");
  await render("mobile", 390, 844);
  assert.ok(nameInput() === input, "mobile resize retains the exact editor input DOM node");
  assert.ok(document.activeElement === input, "mobile resize preserves active focus");
  assert.equal(nameInput().id, id);
  assert.equal(nameInput().value, "Draft desktop belum disimpan");
  await type(input, "Draft mobile belum disimpan");
  await render("desktop", 1440, 960);
  assert.ok(nameInput() === input, "returning to desktop does not remount the draft control");
  assert.ok(document.activeElement === input, "returning to desktop preserves active focus");
  assert.equal(observedName, "Draft mobile belum disimpan");
  assert.equal(nameInput().value, observedName);
  assert.equal(
    document.querySelectorAll('[role="dialog"]').length,
    1,
    "one overlay owner remains active",
  );
  console.log("Library editor resize DOM regression passed");
} finally {
  await act(async (): Promise<void> => {
    root.unmount();
  });
  await browserWindow.happyDOM.close();
}
