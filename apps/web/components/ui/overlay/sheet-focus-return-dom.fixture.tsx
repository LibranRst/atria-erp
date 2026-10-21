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
const { Button, DesktopUIProvider, FormSheet, ConfirmationDialog } =
  await import("@/components/ui");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
function Sheets({ mobile = false }: { readonly mobile?: boolean }): React.JSX.Element {
  const [parent, setParent] = React.useState(false);
  const [child, setChild] = React.useState(false);
  const [parentMounted, setParentMounted] = React.useState(true);
  const [childMounted, setChildMounted] = React.useState(true);
  const fallback = React.useRef<HTMLElement | null>(null);
  return (
    <WorkspacePresentationProvider presentation={mobile ? "mobile" : "desktop"}>
      <DesktopUIProvider responsive>
        <section ref={fallback} tabIndex={-1} aria-label="Sheet fallback context" />
        <input aria-label="Outside focus" />
        <Button
          onClick={(): void => {
            setParentMounted(true);
            setParent(true);
          }}
        >
          Open parent
        </Button>
        {parentMounted ? (
          <FormSheet
            open={parent}
            title="Parent sheet"
            dismissal={{ mode: "confirm", dirty: true, onDiscard: (): void => {} }}
            onClose={(): void => setParent(false)}
            fallbackFocusRef={fallback}
          >
            <Button
              onClick={(): void => {
                setChildMounted(true);
                setChild(true);
              }}
            >
              Open child
            </Button>
            <Button onClick={(): void => setParentMounted(false)}>Unmount parent</Button>
            {childMounted ? (
              <FormSheet
                open={child}
                title="Child sheet"
                dismissal={{ mode: "discard" }}
                onClose={(): void => setChild(false)}
                fallbackFocusRef={fallback}
              >
                <input aria-label="Child input" />
                <Button onClick={(): void => setChild(false)}>Close child</Button>
                <Button onClick={(): void => setChildMounted(false)}>Unmount child</Button>
              </FormSheet>
            ) : null}
          </FormSheet>
        ) : null}
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}

function ConfirmationDestination({
  conditional,
}: {
  readonly conditional: boolean;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(true);
  const destination = React.useRef<HTMLInputElement | null>(null);
  return (
    <WorkspacePresentationProvider presentation="desktop">
      <DesktopUIProvider responsive>
        <input ref={destination} aria-label="Explicit dialog destination" />
        <Button onClick={(): void => setOpen(true)}>Open confirmation</Button>
        {mounted ? (
          <ConfirmationDialog
            open={open}
            title="Choose a focus destination"
            description="Read-only focus fixture."
            confirmLabel="Continue"
            onConfirm={(): void => {}}
            onClose={(): void => {
              setOpen(false);
              if (conditional) setMounted(false);
              destination.current?.focus({ preventScroll: true });
            }}
          />
        ) : null}
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}

function FallbackDestination({
  kind,
  invoker,
  pending = false,
  explicit = false,
}: {
  readonly kind: "sheet" | "confirmation";
  readonly invoker: "visible" | "hidden" | "removed";
  readonly pending?: boolean;
  readonly explicit?: boolean;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const fallback = React.useRef<HTMLElement | null>(null);
  const destination = React.useRef<HTMLInputElement | null>(null);
  return (
    <WorkspacePresentationProvider presentation="desktop">
      <DesktopUIProvider responsive>
        <section ref={fallback} tabIndex={-1} aria-label="Fallback context" />
        <input ref={destination} aria-label="Explicit sheet destination" />
        {invoker !== "removed" ? (
          <div hidden={invoker === "hidden"}>
            <Button onClick={(): void => setOpen(true)}>Open fallback fixture</Button>
          </div>
        ) : null}
        {kind === "sheet" ? (
          <FormSheet
            open={open}
            title="Fallback sheet"
            dismissal={{ mode: "preserve" }}
            pending={pending}
            returnFocusRef={explicit ? destination : undefined}
            fallbackFocusRef={fallback}
            onClose={(): void => setOpen(false)}
          >
            <input aria-label="Fallback sheet input" />
          </FormSheet>
        ) : (
          <ConfirmationDialog
            open={open}
            title="Fallback confirmation"
            confirmLabel="Continue"
            pending={pending}
            returnFocusRef={explicit ? destination : undefined}
            fallbackFocusRef={fallback}
            onClose={(): void => setOpen(false)}
            onConfirm={(): void => {}}
          />
        )}
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
async function settle(ms = 40): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  });
}
async function click(node: HTMLElement): Promise<void> {
  await act(async (): Promise<void> => {
    node.focus();
    node.click();
  });
  await settle();
}
function button(label: string): HTMLButtonElement {
  const node = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (node) => node.textContent?.trim() === label,
  );
  assert(node, `Button ${label} exists`);
  return node;
}
function closeParent(): HTMLButtonElement {
  const node = document.querySelector<HTMLButtonElement>(
    '[aria-label="Parent sheet"] button[aria-label="Tutup"]',
  );
  assert(node);
  return node;
}
try {
  for (const mobile of [false, true]) {
    await act(async (): Promise<void> =>
      root.render(<Sheets key={String(mobile)} mobile={mobile} />),
    );
    await settle();
    const parentTrigger = button("Open parent");
    await click(parentTrigger);
    await settle(60);
    const childTrigger = button("Open child");
    await click(childTrigger);
    await settle(60);
    await click(button("Close child"));
    await settle(650);
    assert.ok(
      document.activeElement === childTrigger,
      "Closing an inner sheet restores inside the still-active parent layer",
    );
    await click(childTrigger);
    await settle(60);
    await click(button("Unmount child"));
    await settle();
    assert.ok(
      document.activeElement === childTrigger,
      "Conditionally unmounting an open sheet restores its live parent trigger",
    );
    const parentClose = closeParent();
    await click(parentClose);
    await settle(60);
    await click(button("Batal"));
    await settle(650);
    assert.ok(
      document.activeElement === parentClose,
      "Cancelling discard returns to the still-open sheet",
    );
    await click(parentClose);
    await settle(60);
    await click(button("Buang perubahan"));
    await settle(650);
    assert.equal(document.querySelectorAll('[role="dialog"], [role="alertdialog"]').length, 0);
    assert.ok(
      document.activeElement === parentTrigger,
      "Discarding a stacked confirmation never restores into the exiting parent",
    );
    await click(parentTrigger);
    await settle(60);
    await click(closeParent());
    await settle(60);
    const outside = document.querySelector<HTMLInputElement>('input[aria-label="Outside focus"]');
    assert(outside);
    await act(async (): Promise<void> => {
      button("Buang perubahan").click();
    });
    await act(async (): Promise<void> => outside.focus());
    await settle(650);
    assert.ok(
      document.activeElement === outside,
      "Exit completion does not steal focus moved to another visible control",
    );
    await click(parentTrigger);
    await settle(60);
    await click(button("Unmount parent"));
    await settle();
    assert.ok(
      document.activeElement === parentTrigger,
      "An open conditional owner can restore without an exit callback",
    );
  }
  for (const conditional of [false, true]) {
    await act(async (): Promise<void> =>
      root.render(<ConfirmationDestination key={String(conditional)} conditional={conditional} />),
    );
    await settle();
    await click(button("Open confirmation"));
    await settle(60);
    await click(button("Batal"));
    await settle(650);
    const destination = document.querySelector<HTMLInputElement>(
      'input[aria-label="Explicit dialog destination"]',
    );
    assert.ok(destination);
    assert.ok(
      document.activeElement === destination,
      "Dialog close and conditional unmount respect an intentional visible outside destination",
    );
  }
  for (const kind of ["sheet", "confirmation"] as const) {
    for (const invoker of ["visible", "hidden", "removed"] as const) {
      for (const explicit of [false, true]) {
        const key = `${kind}-${invoker}-${explicit}`;
        await act(async (): Promise<void> =>
          root.render(
            <FallbackDestination key={key} kind={kind} invoker="visible" explicit={explicit} />,
          ),
        );
        await settle();
        const trigger = button("Open fallback fixture");
        await click(trigger);
        await settle(60);
        await act(async (): Promise<void> =>
          root.render(
            <FallbackDestination key={key} kind={kind} invoker={invoker} explicit={explicit} />,
          ),
        );
        await settle();
        const close =
          kind === "confirmation"
            ? button("Batal")
            : document.querySelector<HTMLButtonElement>(
                '[aria-label="Fallback sheet"] button[aria-label="Tutup"]',
              );
        assert(close);
        await click(close);
        await settle(650);
        const expected = explicit
          ? document.querySelector('[aria-label="Explicit sheet destination"]')
          : invoker === "visible"
            ? trigger
            : document.querySelector('[aria-label="Fallback context"]');
        assert.ok(
          document.activeElement === expected,
          `${kind} prioritizes explicit, exact visible invoker, then fallback (${invoker})`,
        );
      }
    }
    const key = `pending-${kind}`;
    await act(async (): Promise<void> =>
      root.render(<FallbackDestination key={key} kind={kind} invoker="visible" />),
    );
    await settle();
    await click(button("Open fallback fixture"));
    await settle(60);
    await act(async (): Promise<void> =>
      root.render(<FallbackDestination key={key} kind={kind} invoker="hidden" pending />),
    );
    await settle();
    if (kind === "confirmation") {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    } else {
      const close = document.querySelector<HTMLButtonElement>(
        '[aria-label="Fallback sheet"] button[aria-label="Tutup"]',
      );
      assert(close);
      await click(close);
    }
    await settle(60);
    assert.equal(document.querySelectorAll('[role="dialog"], [role="alertdialog"]').length, 1);
    assert.ok(
      document.activeElement !== document.querySelector('[aria-label="Fallback context"]'),
      "Pending owner retains focus ownership",
    );
  }
  console.log("Sheet exit focus return regressions passed");
} finally {
  await act(async (): Promise<void> => root.unmount());
  await browserWindow.happyDOM.close();
}
