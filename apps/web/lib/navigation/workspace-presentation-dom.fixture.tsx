import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act, useState } from "react";

const browserWindow = new Window({
  url: "https://atria.test/projects/p-1?tab=budget#allocation",
  width: 1440,
});
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "Element",
  "Node",
  "Event",
  "MouseEvent",
  "PointerEvent",
  "KeyboardEvent",
  "SVGElement",
  "MutationObserver",
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
const navigations: string[] = [];
mock.module("next/navigation", () => ({
  useRouter: (): { push: (href: string) => void } => ({
    push: (href): void => {
      navigations.push(href);
    },
  }),
  usePathname: (): string => "/projects/p-1",
  useSearchParams: (): URLSearchParams => new URLSearchParams("tab=budget"),
  useParams: (): Record<string, string> => ({ projectId: "p-1" }),
  useSelectedLayoutSegment: (): null => null,
  useSelectedLayoutSegments: (): readonly string[] => [],
}));
const { createRoot } = await import("react-dom/client");
const { createPortal } = await import("react-dom");
const { WorkspacePresentationProvider, useWorkspacePresentation, useWorkspaceControlPresentation } =
  await import("./workspace-presentation");
const { DesktopUIProvider } = await import("../../components/ui/desktop/desktop-ui-provider");
const { usePortalContainer } = await import("../../components/ui/overlay/portal-container-context");
const { hasWorkspaceInteraction } = await import("./workspace-interaction");
const { useWorkspaceViewportPresentation } = await import("./workspace-viewport");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
let mounts = 0;

function Draft(): React.JSX.Element {
  const presentation = useWorkspacePresentation();
  const controls = useWorkspaceControlPresentation();
  const [amount, setAmount] = useState("125000000");
  const [opened, setOpened] = useState(false);
  const [identity] = useState(() => ++mounts);
  const portal = usePortalContainer();
  return (
    <main data-layout={presentation} data-controls={controls} data-identity={identity}>
      <input
        aria-label="Budget"
        value={amount}
        onChange={(event): void => setAmount(event.target.value)}
      />
      <button type="button" onClick={(): void => setAmount("130000000")}>
        Ubah draft
      </button>
      <button type="button" onClick={(): void => setOpened(true)}>
        Buka dialog
      </button>
      {opened && portal
        ? createPortal(
            <div role="dialog" aria-label="Review budget">
              <button type="button" onClick={(): void => setOpened(false)}>
                Tutup dialog
              </button>
            </div>,
            portal,
          )
        : null}
    </main>
  );
}
function Fixture({ nativeBridge = false }: { readonly nativeBridge?: boolean }): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation(nativeBridge);
  return (
    <WorkspacePresentationProvider presentation={presentation}>
      <DesktopUIProvider responsive>
        <Draft />
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
async function resize(width: number): Promise<void> {
  await act(async (): Promise<void> => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    window.dispatchEvent(new Event("resize"));
    await Promise.resolve();
  });
}
async function click(label: string): Promise<void> {
  const button = [...document.querySelectorAll("button")].find(
    (item) => item.textContent === label,
  );
  assert.ok(button);
  await act(async (): Promise<void> => {
    button.click();
    await Promise.resolve();
  });
}
await act(async (): Promise<void> => {
  root.render(<Fixture />);
  await Promise.resolve();
});
const main = document.querySelector("main");
const portal = document.querySelector("[data-atria-admin-portal]");
const input = document.querySelector("input");
assert.ok(main && portal && input);
await click("Ubah draft");
await act(async (): Promise<void> => {
  input.focus();
  await Promise.resolve();
});
assert.equal(hasWorkspaceInteraction(document), true);
await resize(390);
assert.equal(document.querySelector("main"), main);
assert.equal(document.querySelector("input"), input);
assert.equal(document.activeElement, input);
assert.equal(input.value, "130000000");
assert.equal(main.getAttribute("data-layout"), "mobile");
assert.equal(main.getAttribute("data-controls"), "desktop");
assert.equal(portal.hasAttribute("data-atria-admin"), true);
await act(async (): Promise<void> => {
  input.blur();
  await Promise.resolve();
});
assert.equal(main.getAttribute("data-controls"), "mobile");
assert.equal(portal.hasAttribute("data-atria-admin"), false);
const focusedButton = host.querySelector("button");
assert.ok(focusedButton);
await act(async (): Promise<void> => {
  focusedButton.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
  await Promise.resolve();
});
assert.equal(hasWorkspaceInteraction(document), true);
await act(async (): Promise<void> => {
  focusedButton.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: 1 }));
  await Promise.resolve();
});
assert.equal(hasWorkspaceInteraction(document), false);
await act(async (): Promise<void> => {
  focusedButton.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 2 }));
  focusedButton.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 2 }));
  assert.equal(hasWorkspaceInteraction(document), true);
  await new Promise<void>((resolve): void => {
    requestAnimationFrame(() => resolve());
  });
});
assert.equal(hasWorkspaceInteraction(document), false);
await act(async (): Promise<void> => {
  focusedButton.focus();
  await Promise.resolve();
});
assert.equal(hasWorkspaceInteraction(document), true);
await resize(1440);
assert.equal(main.getAttribute("data-controls"), "mobile");
await act(async (): Promise<void> => {
  focusedButton.blur();
  await Promise.resolve();
});
assert.equal(main.getAttribute("data-controls"), "desktop");
await click("Buka dialog");
const dialog = document.querySelector('[role="dialog"]');
assert.ok(dialog);
await resize(1023);
assert.equal(document.querySelector('[role="dialog"]'), dialog);
assert.equal(document.querySelector("[data-atria-admin-portal]"), portal);
assert.equal(portal.hasAttribute("data-atria-admin"), true);
await click("Tutup dialog");
assert.equal(main.getAttribute("data-controls"), "mobile");
assert.equal(portal.hasAttribute("data-atria-admin"), false);
assert.equal(input.value, "130000000");
await act(async (): Promise<void> => {
  root.render(<Fixture nativeBridge />);
  await Promise.resolve();
});
await resize(1440);
assert.equal(main.getAttribute("data-layout"), "mobile");
assert.equal(mounts, 1);
assert.equal(window.location.href, "https://atria.test/projects/p-1?tab=budget#allocation");
assert.deepEqual(navigations, []);
const hiddenOverlay = document.createElement("div");
hiddenOverlay.setAttribute("role", "dialog");
hiddenOverlay.hidden = true;
document.body.append(hiddenOverlay);
assert.equal(hasWorkspaceInteraction(document), false);
await act(async (): Promise<void> => {
  hiddenOverlay.remove();
  root.unmount();
  await Promise.resolve();
});
console.log("responsive workspace DOM passed");
