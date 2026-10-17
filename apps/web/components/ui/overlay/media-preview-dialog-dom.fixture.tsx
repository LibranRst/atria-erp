import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
const browserWindow = new Window({
  url: "https://paduna.test/document-preview",
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
const { MediaPreviewDialog, DesktopUIProvider, Button } = await import("@/components/ui");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
function Fixture({
  presentation,
  purpose = "document",
  imageUrl = "/receipt-a.png",
}: {
  readonly presentation: "desktop" | "mobile";
  readonly purpose?: "document" | "image";
  readonly imageUrl?: string;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  return (
    <WorkspacePresentationProvider presentation={presentation}>
      <DesktopUIProvider responsive>
        <Button onClick={() => setOpen(true)}>Lihat bukti</Button>
        <MediaPreviewDialog
          open={open}
          title="Dokumen audit"
          alt="Nota audit"
          imageUrl={imageUrl}
          purpose={purpose}
          onClose={() => setOpen(false)}
        />
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
async function settle(ms = 45): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  });
}
function button(label: string): HTMLButtonElement {
  const result = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (element) => element.textContent?.trim() === label,
  );
  assert(result, `Missing ${label}`);
  return result;
}
async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.focus();
    element.click();
  });
  await settle();
}
function image(): HTMLImageElement {
  const result = document.querySelector<HTMLImageElement>('img[alt="Nota audit"]');
  assert(result);
  return result;
}
async function dispatchImage(event: "load" | "error"): Promise<void> {
  await act(async () => {
    image().dispatchEvent(new Event(event));
  });
  await settle();
}
try {
  await act(async () => root.render(<Fixture presentation="desktop" />));
  await settle();
  const trigger = button("Lihat bukti");
  await click(trigger);
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
  assert(dialog);
  assert(dialog.className.includes("max-w-4xl"), "Desktop document gets readable width");
  assert(button("Perbesar").disabled, "Loading document cannot zoom");
  await dispatchImage("load");
  await click(button("Perbesar"));
  assert.equal(button("Sesuaikan").getAttribute("aria-pressed"), "true");
  assert(image().className.includes("max-w-none"), "Enlarged document can overflow viewport");
  const region = document.querySelector<HTMLElement>(
    '[role="region"][aria-label="Area dokumen Nota audit"]',
  );
  assert(region);
  await act(async () => region.focus());
  assert.equal(document.activeElement, region, "Document region is keyboard reachable");
  await click(button("Sesuaikan"));
  assert.equal(button("Perbesar").getAttribute("aria-pressed"), "false");
  await dispatchImage("error");
  const failedImage = image();
  await click(button("Coba lagi"));
  assert.notEqual(image(), failedImage, "Retry reloads image without dismissing dialog");
  assert(button("Perbesar").disabled);
  await dispatchImage("load");
  await act(async () => root.render(<Fixture presentation="desktop" imageUrl="/receipt-b.png" />));
  await settle();
  assert.equal(image().getAttribute("src"), "/receipt-b.png");
  assert(button("Perbesar").disabled, "Replacement source starts fresh");
  await act(async () =>
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
  );
  await settle(650);
  assert.equal(document.activeElement, trigger, "Escape restores invoker focus");
  for (const scenario of [
    { presentation: "mobile", purpose: "document" },
    { presentation: "desktop", purpose: "image" },
  ] as const) {
    await act(async () => root.render(<Fixture key={scenario.presentation} {...scenario} />));
    await settle();
    await click(button("Lihat bukti"));
    const compactDialog = document.querySelector<HTMLElement>('[role="dialog"]');
    assert(compactDialog);
    assert(compactDialog.className.includes("max-w-90"));
    assert.equal(
      document.querySelector('[role="region"]'),
      null,
      "Avatar/mobile composition stays compact",
    );
    await act(async () =>
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
    );
    await settle(650);
  }
  console.log("Document media preview regressions passed");
} finally {
  await act(async () => root.unmount());
  await browserWindow.happyDOM.close();
}
