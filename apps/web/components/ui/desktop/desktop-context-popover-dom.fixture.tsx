import assert from "node:assert/strict";
import { Window } from "happy-dom";
import React, { act, useState } from "react";

const browserWindow = new Window({ url: "https://atria.test/ledger", width: 1440 });
Reflect.set(browserWindow.Element.prototype, "animate", undefined);
for (const key of [
  "window",
  "document",
  "navigator",
  "performance",
  "CSS",
  "HTMLElement",
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
const { createRoot } = await import("react-dom/client");
const { Button, ContextPopover, DesktopSelect, IconButton } = await import("../index");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
let outsideActionCount = 0;

function Fixture({ controlled }: { readonly controlled: boolean }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("all");
  return (
    <WorkspacePresentationProvider presentation="desktop">
      <div id="outside">Area luar</div>
      <Button
        id="outside-action"
        onClick={(): void => {
          outsideActionCount += 1;
        }}
      >
        Aksi luar
      </Button>
      <ContextPopover
        label="Notifikasi pengujian"
        open={controlled ? open : undefined}
        onOpenChange={setOpen}
        trigger={
          <IconButton id="notification-toggle" label="Notifikasi" icon={<span>Bell</span>} />
        }
      >
        <button id="inside" type="button">
          Kategori notifikasi
        </button>
        <DesktopSelect
          id="nested-select"
          label="Filter kategori"
          value={category}
          onChange={(value: string | null): void => setCategory(value ?? "all")}
          options={[
            { value: "all", label: "Semua kategori" },
            { value: "finance", label: "Keuangan" },
          ]}
        />
      </ContextPopover>
    </WorkspacePresentationProvider>
  );
}
function CreateChoiceFixture(): React.JSX.Element {
  const [creating, setCreating] = useState(false);
  return (
    <WorkspacePresentationProvider presentation="desktop">
      <DesktopSelect
        id="create-choice"
        label="Klien"
        value="existing"
        onChange={(): void => {}}
        options={[{ value: "existing", label: "Klien tersedia" }]}
        searchable
        createActionLabel="Tambah klien baru"
        onCreateAction={(): void => setCreating(true)}
      />
      {creating ? <input id="client-name" aria-label="Nama klien baru" autoFocus /> : null}
    </WorkspacePresentationProvider>
  );
}
async function click(element: HTMLElement, focus = false): Promise<void> {
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
    if (focus) element.focus();
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
      new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0, buttons: 0 }),
    );
    element.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }),
    );
  });
}
async function settle(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 700));
  });
  // FocusScope schedules restoration on the frame after the exit unmount commits.
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  });
}
for (const controlled of [true, false]) {
  await act(async (): Promise<void> => {
    root.render(<Fixture key={String(controlled)} controlled={controlled} />);
  });
  const trigger = document.getElementById("notification-toggle");
  const outside = document.getElementById("outside");
  assert.ok(trigger instanceof HTMLElement && outside instanceof HTMLElement);
  await click(trigger, true);
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
  const inside = document.getElementById("inside");
  assert.ok(inside instanceof HTMLElement);
  await click(inside, true);
  assert.equal(trigger.getAttribute("aria-expanded"), "true", "inside interaction must stay open");
  await click(outside);
  await settle();
  assert.equal(
    trigger.getAttribute("aria-expanded"),
    "false",
    "outside non-focusable click closes the non-modal popover",
  );
  assert.equal(document.querySelectorAll('[role="dialog"]').length, 0);
  await click(trigger, true);
  const content = document.getElementById("inside");
  assert.ok(content instanceof HTMLElement);
  await act(async (): Promise<void> => {
    content.focus();
  });
  await click(trigger, true);
  await settle();
  assert.equal(
    trigger.getAttribute("aria-expanded"),
    "false",
    "trigger focus/press must close once without reopening",
  );
  assert.equal(document.querySelectorAll('[role="dialog"]').length, 0);
  await click(trigger, true);
  const nestedSelect = document.getElementById("nested-select");
  assert.ok(nestedSelect instanceof HTMLElement);
  await click(nestedSelect, true);
  const option = [...document.querySelectorAll('[role="option"]')].find(
    (element): boolean => element.textContent?.includes("Keuangan") ?? false,
  );
  assert.ok(option instanceof HTMLElement);
  await click(option);
  assert.equal(
    trigger.getAttribute("aria-expanded"),
    "true",
    "a nested select portal must not dismiss its parent popover",
  );
  const outsideAction = document.getElementById("outside-action");
  assert.ok(outsideAction instanceof HTMLElement);
  const beforeAction = outsideActionCount;
  await click(outsideAction, true);
  await settle();
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  assert.equal(
    outsideActionCount,
    beforeAction + 1,
    "outside controls still receive the same click",
  );
  await click(trigger, true);
  const dialog = document.querySelector('[role="dialog"]');
  assert.ok(dialog instanceof HTMLElement);
  await act(async (): Promise<void> => {
    dialog.focus();
    dialog.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
  });
  await settle();
  assert.equal(trigger.getAttribute("aria-expanded"), "false", "Escape closes the popover");
  assert.equal(document.querySelectorAll('[role="dialog"]').length, 0);
}
await act(async (): Promise<void> => {
  root.render(<CreateChoiceFixture />);
});
const clientTrigger = document.getElementById("create-choice");
assert.ok(clientTrigger instanceof HTMLElement);
assert.ok(clientTrigger.textContent?.includes("Klien tersedia"));
await click(clientTrigger, true);
const createClient = [...document.querySelectorAll("button")].find(
  (element): boolean => element.textContent?.includes("Tambah klien baru") ?? false,
);
assert.ok(createClient instanceof HTMLElement);
await click(createClient);
await settle();
assert.equal(document.querySelectorAll('[role="dialog"]').length, 0);
assert.equal(
  document.activeElement?.id,
  "client-name",
  "create actions run after the exiting select restores focus",
);
await act(async (): Promise<void> => {
  root.unmount();
});
await browserWindow.happyDOM.close();
console.log("desktop non-modal popover pointer dismissal regression passed");
