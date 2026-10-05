import assert from "node:assert/strict";
import { Window } from "happy-dom";
import React, { act } from "react";

const browserWindow = new Window({ url: "https://atria.test/ledger", width: 390, height: 844 });
Reflect.set(browserWindow.Element.prototype, "animate", undefined);
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "Element",
  "Node",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "SVGElement",
  "MutationObserver",
  "DOMRect",
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
const visualViewport = new browserWindow.EventTarget();
let visualHeight = 844;
let visualTop = 0;
let visualScale = 1;
Object.defineProperties(visualViewport, {
  height: { get: (): number => visualHeight },
  width: { get: (): number => 390 / visualScale },
  offsetTop: { get: (): number => visualTop },
  offsetLeft: { value: 0 },
  scale: { get: (): number => visualScale },
});
Object.defineProperty(browserWindow, "visualViewport", { value: visualViewport });

const { createRoot } = await import("react-dom/client");
const { BottomSheet } = await import("./bottom-sheet");
const { DialogFrame } = await import("./dialog-frame");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);

async function settle(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 80));
  });
}

function rect(top: number, height: number): DOMRect {
  return new DOMRect(0, top, 390, height);
}

function setDimension(element: HTMLElement, name: string, value: number): void {
  Object.defineProperty(element, name, { configurable: true, value });
}

function sheetFixture(showDialog = false): React.JSX.Element {
  return (
    <>
      <BottomSheet
        open
        title="Keyboard fixture"
        onClose={(): void => undefined}
        footer={<button type="button">Simpan</button>}
      >
        <input aria-label="Nama" />
        <textarea aria-label="Catatan" />
      </BottomSheet>
      <DialogFrame open={showDialog} title="Pilihan" onClose={(): void => undefined}>
        Pilihan
      </DialogFrame>
    </>
  );
}

async function resize(height: number, top = 0, scale = 1): Promise<void> {
  visualHeight = height;
  visualTop = top;
  visualScale = scale;
  await act(async (): Promise<void> => {
    visualViewport.dispatchEvent(new browserWindow.Event("resize"));
  });
  await settle();
}

try {
  await act(async (): Promise<void> => {
    root.render(sheetFixture());
  });
  await settle();
  const sheet = document.querySelector<HTMLElement>('[aria-label="Keyboard fixture"]');
  const body = sheet?.querySelector<HTMLElement>('[data-sheet-body="true"]');
  const input = body?.querySelector<HTMLInputElement>("input");
  const textarea = body?.querySelector<HTMLTextAreaElement>("textarea");
  assert.ok(sheet && body && input && textarea);
  const initialHost = sheet.parentElement;
  assert.ok(initialHost);
  initialHost.getBoundingClientRect = (): DOMRect => rect(visualTop - window.scrollY, visualHeight);
  const header = sheet.querySelector<HTMLElement>("header");
  const footer = sheet.querySelector<HTMLElement>(".bottom-0.z-20");
  const handle = sheet.querySelector<HTMLElement>('[aria-label="Perbesar drawer"]');
  assert.ok(header && footer && handle);
  setDimension(header, "offsetHeight", 56);
  setDimension(handle, "offsetHeight", 20);
  setDimension(footer, "offsetHeight", 88);
  const content = body.firstElementChild?.nextElementSibling;
  assert.ok(content instanceof HTMLElement);
  setDimension(content, "scrollHeight", 900);
  setDimension(body, "scrollHeight", 1200);
  setDimension(body, "clientHeight", 462);
  body.getBoundingClientRect = (): DOMRect => rect(88, 462);
  input.getBoundingClientRect = (): DOMRect => rect(460 - body.scrollTop, 48);
  textarea.getBoundingClientRect = (): DOMRect => rect(130 - body.scrollTop, 70);
  await act(async (): Promise<void> => {
    input.focus();
  });
  await resize(470, 80);
  assert.equal(initialHost.style.top, "80px", "Sheet host follows visual top including offsetTop");
  assert.equal(initialHost.style.height, "470px", "Sheet host follows visual height");
  assert.ok(
    sheet.classList.contains("absolute"),
    "Sheet bottom is anchored within the measured host",
  );
  assert.equal(sheet.style.maxHeight, "462px", "Keyboard height cap uses the visual viewport");
  assert.equal(
    body.scrollTop,
    62,
    "Resize reveals the active field above the 88px footer plus clearance",
  );

  body.scrollTop = 160;
  textarea.getBoundingClientRect = (): DOMRect => rect(300 - body.scrollTop, 70);
  await act(async (): Promise<void> => {
    textarea.focus();
  });
  await settle();
  assert.equal(
    body.scrollTop,
    120,
    "Focus reveals the field below the floating header by the minimum delta",
  );

  input.getBoundingClientRect = (): DOMRect => rect(1500 - body.scrollTop, 48);
  await act(async (): Promise<void> => {
    input.focus();
  });
  await settle();
  assert.equal(body.scrollTop, 738, "Reveal clamps to the owning body's actual scroll extent");

  await resize(170);
  assert.equal(
    sheet.style.maxHeight,
    "162px",
    "Landscape keyboard can cap below the normal sheet minimum",
  );
  await resize(470, 80);

  body.scrollTop = 0;
  input.getBoundingClientRect = (): DOMRect => rect(270, 48);
  await act(async (): Promise<void> => {
    textarea.focus();
  });
  body.scrollTop = 0;
  await act(async (): Promise<void> => {
    input.focus();
  });
  await settle();
  assert.equal(body.scrollTop, 0, "Focus preserves reading position when field is already visible");

  // Observed on Safari 26.5: innerHeight518, root714, scrollY196, visual377/top196.
  // Client rects are already panned; a bottom inset derived from innerHeight is zero.
  browserWindow.innerHeight = 518;
  setDimension(document.documentElement, "clientHeight", 714);
  Object.defineProperty(browserWindow, "scrollY", { configurable: true, value: 196 });
  const sheetHost = sheet.parentElement;
  assert.ok(sheetHost);
  sheetHost.getBoundingClientRect = (): DOMRect => rect(visualTop - window.scrollY, visualHeight);
  body.getBoundingClientRect = (): DOMRect => rect(87, 290);
  body.scrollTop = 40;
  input.getBoundingClientRect = (): DOMRect => rect(230 - body.scrollTop, 48);
  await resize(377, 196);
  assert.equal(
    sheetHost.style.top,
    "196px",
    "Safari sheet host follows the document-space visual origin",
  );
  assert.equal(
    sheetHost.style.height,
    "377px",
    "Safari host uses visible height despite inner/root mismatch",
  );
  assert.equal(
    body.scrollTop,
    40,
    "Already visible client-space field is not scrolled against document-space offsetTop",
  );
  footer.getBoundingClientRect = (): DOMRect =>
    rect(
      Number.parseFloat(sheetHost.style.top) +
        Number.parseFloat(sheetHost.style.height) -
        window.scrollY -
        88,
      88,
    );
  assert.equal(
    footer.getBoundingClientRect().bottom,
    377,
    "Footer ends at the visible client-space bottom",
  );
  browserWindow.innerHeight = 844;
  setDimension(document.documentElement, "clientHeight", 844);
  Object.defineProperty(browserWindow, "scrollY", { configurable: true, value: 0 });
  body.getBoundingClientRect = (): DOMRect => rect(88, 462);
  body.scrollTop = 0;
  await resize(470, 80);

  await act(async (): Promise<void> => {
    root.render(sheetFixture(true));
  });
  await settle();
  body.scrollTop = 0;
  input.getBoundingClientRect = (): DOMRect => rect(460, 48);
  await act(async (): Promise<void> => {
    input.focus();
  });
  assert.equal(
    document.activeElement,
    input,
    "Lower sheet field is actually focused for the ownership regression",
  );
  await resize(450, 80);
  assert.equal(body.scrollTop, 0, "A lower sheet does not reveal fields behind the top overlay");

  await act(async (): Promise<void> => {
    root.render(<DialogFrame open title="Compact fixture" onClose={(): void => undefined} />);
  });
  await settle();
  // A streamed/loading dialog may mount its editable body after the owner subscribes.
  await act(async (): Promise<void> => {
    root.render(
      <DialogFrame
        open
        title="Compact fixture"
        onClose={(): void => undefined}
        footer={<button type="button">Simpan</button>}
      >
        <input aria-label="Judul" />
      </DialogFrame>,
    );
  });
  await settle();
  const dialog = document.querySelector<HTMLElement>("[aria-labelledby]");
  const dialogInput = dialog?.querySelector<HTMLInputElement>("input");
  const dialogBody = dialogInput?.parentElement;
  assert.ok(dialog && dialogInput && dialogBody);
  const dialogHost = dialog.parentElement;
  assert.ok(dialogHost);
  dialogHost.getBoundingClientRect = (): DOMRect => rect(visualTop - window.scrollY, visualHeight);
  setDimension(dialogBody, "clientHeight", 100);
  setDimension(dialogBody, "scrollHeight", 300);
  dialogBody.getBoundingClientRect = (): DOMRect => rect(180, 100);
  dialogInput.getBoundingClientRect = (): DOMRect => rect(270 - dialogBody.scrollTop, 48);
  await act(async (): Promise<void> => {
    dialogInput.focus();
  });
  await resize(400, 60);
  assert.equal(dialog.parentElement?.style.top, "60px");
  assert.equal(dialog.parentElement?.style.height, "400px");
  assert.equal(dialog.style.maxHeight, "312px", "Dialog cap shrinks with keyboard viewport");
  assert.equal(
    dialogBody.scrollTop,
    54,
    "Dialog focus is minimally revealed inside its own scroll body",
  );

  dialogBody.scrollTop = 0;
  await resize(422, 40, 2);
  assert.equal(
    dialogBody.scrollTop,
    0,
    "Manual pinch zoom does not trigger automatic field scrolling",
  );
  assert.equal(
    dialog.parentElement?.style.top,
    "60px",
    "Manual zoom preserves the last unzoomed frame",
  );
  assert.equal(dialog.parentElement?.style.height, "400px");

  browserWindow.innerHeight = 518;
  setDimension(document.documentElement, "clientHeight", 714);
  Object.defineProperty(browserWindow, "scrollY", { configurable: true, value: 196 });
  dialogBody.getBoundingClientRect = (): DOMRect => rect(80, 150);
  dialogBody.scrollTop = 40;
  dialogInput.getBoundingClientRect = (): DOMRect => rect(160 - dialogBody.scrollTop, 48);
  await resize(377, 196);
  assert.equal(dialogHost.style.top, "196px");
  assert.equal(dialogHost.getBoundingClientRect().top, 0);
  assert.equal(
    dialogBody.scrollTop,
    40,
    "Compact dialog also measures visible client bounds after Safari pans the document",
  );

  browserWindow.innerHeight = 470;
  setDimension(document.documentElement, "clientHeight", 470);
  Object.defineProperty(browserWindow, "scrollY", { configurable: true, value: 0 });
  visualHeight = 470;
  visualTop = 0;
  visualScale = 1;
  await act(async (): Promise<void> => {
    window.dispatchEvent(new Event("resize"));
  });
  await settle();
  assert.equal(
    dialog.parentElement?.style.height,
    "470px",
    "Android content resize is not subtracted twice",
  );
  console.log("Overlay keyboard DOM regressions passed");
} finally {
  await act(async (): Promise<void> => root.unmount());
  await browserWindow.happyDOM.close();
}
