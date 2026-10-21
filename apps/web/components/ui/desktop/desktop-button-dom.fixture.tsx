import assert from "node:assert/strict";
import { Window } from "happy-dom";
import React, { act, useState } from "react";

const browserWindow = new Window({ url: "https://atria.test/projects", width: 1440 });
Reflect.set(browserWindow.Element.prototype, "animate", undefined);
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLButtonElement",
  "HTMLInputElement",
  "Element",
  "Node",
  "NodeFilter",
  "Event",
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
const { Button, IconButton, ChoiceRow, DesktopTable } = await import("../index");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
let openCount = 0;
let outerClickCount = 0;
let selectedCount = 0;
const overlayKeys: string[] = [];

function Fixture({ showActions = true }: { readonly showActions?: boolean }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState(true);
  function edit(event: React.MouseEvent<HTMLButtonElement>): void {
    assert.ok(event.currentTarget instanceof HTMLButtonElement);
    event.stopPropagation();
    openCount += 1;
    setOpen(true);
  }
  return (
    <WorkspacePresentationProvider presentation="desktop">
      <div
        onKeyDown={(event): void => {
          overlayKeys.push(event.key);
        }}
        onClick={(): void => {
          outerClickCount += 1;
        }}
      >
        <Button id="edit-direct" type="button" onClick={edit}>
          Edit langsung
        </Button>
        <IconButton id="close-tooltip" label="Tutup" icon={<span>×</span>} />
        <DesktopTable
          ariaLabel="Proyek pengujian"
          rows={[{ id: "one", name: "Proyek Pengujian" }]}
          rowKey={(row): string => row.id}
          selectedRowKey={null}
          onRowAction={(): void => {
            selectedCount += 1;
          }}
          columns={[
            { key: "name", label: "Proyek", render: (row): string => row.name },
            ...(showActions
              ? [
                  {
                    key: "actions",
                    label: "Tindakan",
                    render: (): React.JSX.Element => (
                      <Button id="edit-table" type="button" size="compact" onClick={edit}>
                        Edit proyek
                      </Button>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </div>
      <ChoiceRow
        presentation="review"
        title="Pilih item review desktop"
        checked={chosen}
        onChange={setChosen}
      />
      <ChoiceRow
        presentation="review"
        title="Item tidak tersedia"
        checked={false}
        disabled
        onChange={() => {
          throw new Error("Disabled choice cannot change");
        }}
      />
      {open ? (
        <div role="dialog" aria-label="Edit proyek pengujian">
          <input aria-label="Nama proyek" defaultValue="Proyek Pengujian" />
        </div>
      ) : null}
    </WorkspacePresentationProvider>
  );
}

await act(async (): Promise<void> => {
  root.render(<Fixture />);
});
for (const id of ["edit-direct", "edit-table"]) {
  const button = document.getElementById(id);
  assert.ok(button instanceof HTMLButtonElement);
  await act(async (): Promise<void> => {
    button.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        buttons: 1,
      }),
    );
    button.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, buttons: 1 }),
    );
    button.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        buttons: 0,
      }),
    );
    button.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0, buttons: 0 }),
    );
    button.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1, button: 0 }),
    );
  });
}
assert.equal(openCount, 2, "direct and nested pointer clicks must each open the edit UI once");
assert.equal(outerClickCount, 0, "the native click event supports stopPropagation");
assert.equal(selectedCount, 0, "a nested edit action must not also select the row");
const directButton = document.getElementById("edit-direct");
assert.ok(directButton instanceof HTMLButtonElement);
for (const key of ["Escape", "Tab"]) {
  await act(async (): Promise<void> => {
    directButton.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
    );
  });
}
assert.deepEqual(
  overlayKeys,
  ["Escape", "Tab"],
  "overlay dismissal and focus keys must reach the owning dialog",
);
const tooltipButton = document.getElementById("close-tooltip");
assert.ok(tooltipButton instanceof HTMLButtonElement);
await act(async (): Promise<void> => tooltipButton.focus());
await act(async (): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, 80));
});
assert.ok(document.querySelector('[role="tooltip"]'), "focused icon exposes its tooltip");
await act(async (): Promise<void> => {
  tooltipButton.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
  );
  tooltipButton.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }),
  );
});
assert.deepEqual(
  overlayKeys,
  ["Escape", "Tab", "Escape", "Tab"],
  "a tooltip must not consume the owning dialog's dismissal/focus keys",
);
const inclusion = host.querySelector<HTMLButtonElement>(
  '[role="checkbox"][aria-label="Pilih item review desktop"]',
);
assert.ok(inclusion);
assert.ok(inclusion.classList.contains("atria-desktop-button"));
assert.equal(inclusion.getAttribute("aria-checked"), "true");
await act(async () => inclusion.click());
assert.equal(inclusion.getAttribute("aria-checked"), "false");
assert.equal(inclusion.textContent?.trim(), "Pilih");
const unavailable = host.querySelector<HTMLButtonElement>(
  '[role="checkbox"][aria-label="Item tidak tersedia"]',
);
assert.ok(unavailable?.disabled);
await act(async () => unavailable.click());
assert.equal(
  document.querySelector('[role="dialog"]')?.getAttribute("aria-label"),
  "Edit proyek pengujian",
);
await act(async (): Promise<void> => {
  root.render(<Fixture showActions={false} />);
});
assert.equal(document.querySelectorAll('[role="columnheader"]').length, 1);
assert.equal(
  document.querySelectorAll("tbody td").length,
  1,
  "row cells follow changed columns rather than a stale collection",
);
await act(async (): Promise<void> => {
  root.render(<Fixture showActions />);
});
assert.equal(document.querySelectorAll('[role="columnheader"]').length, 2);
assert.equal(document.querySelectorAll("tbody td").length, 2);
await act(async (): Promise<void> => {
  root.unmount();
});
await browserWindow.happyDOM.close();
console.log("public desktop Button pointer regression passed");
