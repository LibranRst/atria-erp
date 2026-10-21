import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";

const browserWindow = new Window({
  url: "https://atria.test/focus-fixture",
  width: 1024,
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
  usePathname: (): string => "/focus-fixture",
  useRouter: (): ReturnType<typeof nextNavigation.useRouter> => ({
    bfcacheId: "list-detail-focus",
    back: (): void => {},
    forward: (): void => {},
    refresh: (): void => {},
    push: (): void => {},
    replace: (): void => {},
    prefetch: (): void => {},
  }),
}));
const { createRoot } = await import("react-dom/client");
const { DesktopTable, DesktopUIProvider, Button, FormSheet, SearchInput, useListDetailFocus } =
  await import("@/components/ui");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { useWorkspaceViewportAtLeast } = await import("@/lib/navigation/workspace-viewport");
type Row = { readonly id: string; readonly name: string };
const initialRows: readonly Row[] = [
  { id: "one", name: "First item" },
  { id: "two", name: "Second item" },
];
function Collection({
  name,
  rows,
  active = true,
  controls = true,
}: {
  readonly name: string;
  readonly rows: readonly Row[];
  readonly active?: boolean;
  readonly controls?: boolean;
}): React.JSX.Element {
  const wide = useWorkspaceViewportAtLeast(1280);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [modal, setModal] = React.useState(false);
  const filtered = rows.filter((row) =>
    row.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const context = filtered.find((row) => row.id === selected);
  const { listRef, detailRef } = useListDetailFocus({
    active,
    narrow: !wide,
    selectionKey: context?.id ?? null,
  });
  return (
    <section aria-label={`Collection ${name}`} hidden={!active}>
      <SearchInput ariaLabel={`Search ${name}`} value={search} onChange={setSearch} />
      <div ref={listRef} hidden={!wide && Boolean(context)} data-list={name}>
        <DesktopTable
          ariaLabel={`Rows ${name}`}
          columns={[{ key: "name", label: "Name", render: (row: Row): string => row.name }]}
          rows={filtered}
          rowKey={(row: Row): string => row.id}
          selectedRowKey={wide ? (context?.id ?? null) : null}
          onRowSelectionChange={(row: Row | null): void => setSelected(row?.id ?? null)}
        />
      </div>
      {context ? (
        <section ref={detailRef} aria-label={`Details ${name}`}>
          {!wide && controls ? (
            <Button onClick={(): void => setSelected(null)}>Back {name}</Button>
          ) : null}
          <h2>
            {context.name} details {name}
          </h2>
          {controls ? (
            <Button onClick={(): void => setModal(true)}>Open modal {name}</Button>
          ) : null}
        </section>
      ) : null}
      <FormSheet
        open={modal}
        title={`Modal ${name}`}
        dismissal={{ mode: "discard" }}
        onClose={(): void => setModal(false)}
      >
        <input aria-label={`Modal input ${name}`} />
        <Button onClick={(): void => setModal(false)}>Close modal {name}</Button>
      </FormSheet>
    </section>
  );
}
function Fixture({
  rows = initialRows,
  controls = true,
  active = true,
}: {
  readonly rows?: readonly Row[];
  readonly controls?: boolean;
  readonly active?: boolean;
}): React.JSX.Element {
  return (
    <WorkspacePresentationProvider presentation="desktop">
      <DesktopUIProvider>
        <input aria-label="Outside input" />
        <Collection name="A" rows={rows} controls={controls} active={active} />
        <Collection name="B" rows={initialRows} />
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
async function settle(delay = 30): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, delay));
  });
}
async function render(
  props: React.ComponentProps<typeof Fixture> = {},
  key = "normal",
): Promise<void> {
  await act(async (): Promise<void> => root.render(<Fixture key={key} {...props} />));
  await settle();
}
async function width(next: number): Promise<void> {
  await act(async (): Promise<void> => {
    browserWindow.happyDOM.setWindowSize({ width: next, height: 976 });
    window.dispatchEvent(new Event("resize"));
  });
  await settle();
}
async function click(element: HTMLElement): Promise<void> {
  await act(async (): Promise<void> => {
    element.focus();
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    element.click();
  });
  await settle();
}
async function key(element: HTMLElement, value: "Enter" | " "): Promise<void> {
  await act(async (): Promise<void> => {
    element.focus();
    element.dispatchEvent(
      new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true }),
    );
    element.dispatchEvent(
      new KeyboardEvent("keyup", { key: value, bubbles: true, cancelable: true }),
    );
  });
  await settle();
}
function collection(name = "A"): HTMLElement {
  const node = host.querySelector<HTMLElement>(`section[aria-label="Collection ${name}"]`);
  assert(node);
  return node;
}
function row(name = "A"): HTMLElement {
  const node = collection(name).querySelector<HTMLElement>("tbody tr");
  assert(node);
  return node;
}
function button(label: string): HTMLButtonElement {
  const node = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (node) => node.textContent?.trim() === label,
  );
  assert(node, `Button ${label} exists`);
  return node;
}
function visible(element: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement)
    if (
      current.hasAttribute("hidden") ||
      current.hasAttribute("inert") ||
      getComputedStyle(current).display === "none"
    )
      return false;
  return true;
}
function visibleOwnedFocus(name = "A"): boolean {
  const focused = document.activeElement;
  return focused instanceof HTMLElement && collection(name).contains(focused) && visible(focused);
}
try {
  await render();
  for (const method of ["click", "Enter", " "] as const) {
    const invoking = row();
    if (method === "click") await click(invoking);
    else await key(invoking, method);
    assert.ok(
      document.activeElement === button("Back A"),
      `${method}: narrow detail gets focus when its invoking row is hidden`,
    );
    assert.equal(visibleOwnedFocus(), true);
    await click(button("Back A"));
    assert.ok(
      document.activeElement === invoking,
      `${method}: Back restores the original native grid row`,
    );
    assert.equal(visibleOwnedFocus(), true);
  }
  await width(1440);
  const wideRow = row();
  await key(wideRow, "Enter");
  assert.ok(
    document.activeElement === wideRow,
    "Wide selection retains focus in the still-visible table",
  );
  await width(1024);
  assert.ok(
    document.activeElement === button("Back A"),
    "Narrowing moves focus out of the hidden list",
  );
  await width(1280);
  assert.ok(
    document.activeElement === button("Open modal A"),
    "Widening moves focus from a removed narrow Back into visible detail",
  );
  const search = collection().querySelector<HTMLInputElement>('input[aria-label="Search A"]');
  assert(search);
  await act(async (): Promise<void> => {
    search.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    assert(setter);
    setter.call(search, "Second");
    search.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
  assert.ok(
    document.activeElement === search,
    "Filtering away the selected row never steals search focus",
  );
  await render({}, "removal");
  await width(1024);
  await key(row(), "Enter");
  await render({ rows: initialRows.slice(1) }, "removal");
  assert.equal(
    visibleOwnedFocus(),
    true,
    "If the invoking row disappears, focus falls back within the visible list",
  );
  assert.equal(document.activeElement?.closest('[data-list="A"]') !== null, true);
  await render({}, "overlay");
  await width(1440);
  await key(row(), "Enter");
  await click(button("Open modal A"));
  await settle(60);
  const modalInput = document.querySelector<HTMLInputElement>('input[aria-label="Modal input A"]');
  assert(modalInput);
  await act(async (): Promise<void> => modalInput.focus());
  await width(1024);
  assert.ok(
    document.activeElement === modalInput,
    "Resize never steals focus from the existing modal owner",
  );
  await click(button("Close modal A"));
  await settle(700);
  assert.ok(
    document.activeElement === button("Open modal A"),
    "The existing sheet owner restores its opener after exit",
  );
  const outside = document.querySelector<HTMLInputElement>('input[aria-label="Outside input"]');
  assert(outside);
  await act(async (): Promise<void> => outside.focus());
  await width(1440);
  await width(1024);
  assert.ok(
    document.activeElement === outside,
    "Outside focus is not changed by selected layout reflow",
  );
  await click(row("B"));
  assert.ok(
    document.activeElement === button("Back B"),
    "A second independent list/detail owner receives its own focus",
  );
  await click(button("Back B"));
  assert.equal(collection("B").contains(document.activeElement), true);
  await render({}, "resume");
  const resumedRow = row();
  await act(async (): Promise<void> => resumedRow.focus());
  await render({ active: false }, "resume");
  await render({ active: true }, "resume");
  assert.ok(document.activeElement === resumedRow, "Resume retains the already focused row");
  await key(resumedRow, "Enter");
  assert.equal(
    document.activeElement === button("Back A"),
    true,
    "Resuming an owner captures current row focus without requiring a new focusin event",
  );
  await click(button("Back A"));
  assert.ok(document.activeElement === resumedRow, "Resumed Back restores its invoking row");
  await render({ controls: false }, "fallback");
  await key(row(), "Enter");
  const heading = collection().querySelector<HTMLElement>("h2");
  assert(heading);
  assert.ok(
    document.activeElement === heading,
    "Content without enabled controls receives semantic heading focus",
  );
  assert.equal(
    heading.hasAttribute("tabindex"),
    false,
    "Temporary programmatic tab stops are restored",
  );
  const inactiveOutside = document.querySelector<HTMLInputElement>(
    'input[aria-label="Outside input"]',
  );
  assert(inactiveOutside);
  await act(async (): Promise<void> => inactiveOutside.focus());
  await render({ active: false }, "fallback");
  assert.ok(document.activeElement === inactiveOutside, "Inactive owners never claim focus");
  console.log("List/detail focus handoff regressions passed");
} finally {
  await act(async (): Promise<void> => root.unmount());
  await browserWindow.happyDOM.close();
}
