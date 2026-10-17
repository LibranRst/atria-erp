import assert from "node:assert/strict";
import { mock } from "bun:test";
import React, { act } from "react";
import { Window } from "happy-dom";

const browser = new Window({ url: "https://atria.test/table-keyboard", width: 1024 });
Object.defineProperty(browser.navigator, "platform", { configurable: true, value: "MacIntel" });
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
const navigation = await import("next/navigation");
const router: ReturnType<typeof navigation.useRouter> = {
  bfcacheId: "desktop-table-keyboard",
  back: (): void => {},
  forward: (): void => {},
  refresh: (): void => {},
  push: (): void => {},
  replace: (): void => {},
  prefetch: (): void => {},
};
mock.module("next/navigation", (): typeof navigation => ({
  ...navigation,
  usePathname: (): string => "/table-keyboard",
  useRouter: () => router,
}));
const { createRoot } = await import("react-dom/client");
const { DesktopTable, DesktopUIProvider, Button, useListDetailFocus } =
  await import("@/components/ui");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
type Row = { readonly id: string; readonly name: string };
const rows: readonly Row[] = [
  { id: "one", name: "First row" },
  { id: "two", name: "Second row" },
];
const changes: (string | null)[] = [];
const nestedDefaults: boolean[] = [];
let nestedClicks = 0,
  commandActions = 0;
function Fixture({
  narrow = true,
  command = false,
}: {
  readonly narrow?: boolean;
  readonly command?: boolean;
}): React.JSX.Element {
  const [selected, setSelected] = React.useState<string | null>(null);
  const { listRef, detailRef } = useListDetailFocus({ narrow, selectionKey: selected });
  return (
    <WorkspacePresentationProvider presentation="desktop">
      <DesktopUIProvider>
        <div ref={listRef} hidden={narrow && selected !== null}>
          <DesktopTable
            ariaLabel="Keyboard table"
            rows={rows}
            rowKey={(row) => row.id}
            selectedRowKey={command ? undefined : selected}
            onRowSelectionChange={
              command
                ? undefined
                : (row) => {
                    changes.push(row?.id ?? null);
                    setSelected(row?.id ?? null);
                  }
            }
            onRowAction={
              command
                ? () => {
                    commandActions++;
                  }
                : undefined
            }
            columns={[
              { key: "name", label: "Name", render: (row) => row.name },
              {
                key: "controls",
                label: "Controls",
                render: (row) => (
                  <div>
                    <button
                      type="button"
                      aria-label={`Nested ${row.id}`}
                      onKeyDown={(event) => nestedDefaults.push(event.defaultPrevented)}
                      onClick={(event) => {
                        event.stopPropagation();
                        nestedClicks++;
                      }}
                    >
                      Nested action
                    </button>
                    <a
                      href="#nested"
                      aria-label={`Link ${row.id}`}
                      onKeyDown={(event) => nestedDefaults.push(event.defaultPrevented)}
                      onClick={(event) => event.preventDefault()}
                    >
                      Nested link
                    </a>
                    <input
                      aria-label={`Input ${row.id}`}
                      onKeyDown={(event) => nestedDefaults.push(event.defaultPrevented)}
                    />
                    <span
                      contentEditable
                      suppressContentEditableWarning
                      aria-label={`Editor ${row.id}`}
                      onKeyDown={(event) => nestedDefaults.push(event.defaultPrevented)}
                    >
                      Editable text
                    </span>
                  </div>
                ),
              },
            ]}
          />
        </div>
        {selected ? (
          <section ref={detailRef} aria-label="Keyboard detail">
            <Button
              onClick={() => {
                changes.push(null);
                setSelected(null);
              }}
            >
              Back
            </Button>
            <h2>Selected {selected}</h2>
          </section>
        ) : null}
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
async function settle(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  });
}
async function render(narrow = true, command = false): Promise<void> {
  await act(async (): Promise<void> =>
    root.render(<Fixture key={`${narrow}:${command}`} narrow={narrow} command={command} />),
  );
  await settle();
}
function row(index = 0): HTMLElement {
  const value = host.querySelectorAll<HTMLElement>("tbody tr")[index];
  assert.ok(value);
  return value;
}
function named(label: string): HTMLElement {
  const value = host.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  assert.ok(value);
  return value;
}
async function key(target: HTMLElement, value: "Enter" | " "): Promise<KeyboardEvent> {
  const event = new KeyboardEvent("keydown", {
    key: value,
    code: value === "Enter" ? "Enter" : "Space",
    bubbles: true,
    cancelable: true,
  });
  await act(async (): Promise<void> => {
    target.focus();
    target.dispatchEvent(event);
  });
  const release = document.activeElement instanceof HTMLElement ? document.activeElement : target;
  await act(async (): Promise<void> => {
    release.dispatchEvent(
      new KeyboardEvent("keyup", {
        key: value,
        code: value === "Enter" ? "Enter" : "Space",
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await settle();
  return event;
}
await render();
const invoker = row();
const enter = await key(invoker, "Enter");
assert.equal(
  enter.defaultPrevented,
  true,
  "optional row Enter cancels macOS native activation before focus moves",
);
assert.deepEqual(changes, ["one"], "Aria still selects exactly once");
const back = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
  (button) => button.textContent === "Back",
);
assert.ok(back);
assert.ok(document.activeElement === back, "narrow detail retains its shared focus behavior");
await act(async (): Promise<void> => back.click());
await settle();
assert.ok(document.activeElement === invoker);
await key(invoker, "Enter");
assert.deepEqual(changes, ["one", null, "one"]);
const nextBack = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
  (button) => button.textContent === "Back",
);
assert.ok(nextBack);
await act(async (): Promise<void> => nextBack.click());
await settle();
await render(false);
changes.length = 0;
await key(row(1), "Enter");
await key(row(1), "Enter");
assert.deepEqual(changes, ["two", null], "Enter toggles a visible selected row once");
await key(row(), " ");
await key(row(), " ");
assert.deepEqual(changes.slice(2), ["one", null], "Space keeps native selection toggling");
await act(async (): Promise<void> => row().click());
await settle();
await act(async (): Promise<void> => row().click());
await settle();
assert.deepEqual(changes.slice(4), ["one", null], "pointer activation remains single-owner");
changes.length = 0;
for (const label of ["Nested one", "Link one", "Input one", "Editor one"])
  await key(named(label), "Enter");
assert.deepEqual(
  nestedDefaults,
  [false, false, false, false],
  "the row guard leaves nested native controls' Enter defaults untouched",
);
assert.equal(changes.length, 0);
await act(async (): Promise<void> => named("Nested one").click());
await settle();
assert.equal(nestedClicks, 1);
assert.equal(changes.length, 0);
await render(false, true);
const command = await key(row(), "Enter");
assert.equal(
  command.defaultPrevented,
  false,
  "command rows retain React Aria's native action contract",
);
assert.equal(commandActions, 1);
await act(async (): Promise<void> => root.unmount());
await browser.happyDOM.close();
console.log("Desktop Table Mac Enter and nested controls passed");
