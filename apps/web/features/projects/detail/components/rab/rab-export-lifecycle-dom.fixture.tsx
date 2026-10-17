import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { RabPrintableEstimate } from "@atria/core/ai/rab-export";

const browser = new Window({
  url: "https://paduna.test/projects/fixture?tab=rab",
  width: 1440,
  height: 976,
});
Reflect.set(browser.Element.prototype, "animate", undefined);
for (const key of [
  "window",
  "document",
  "navigator",
  "localStorage",
  "performance",
  "CSS",
  "HTMLElement",
  "HTMLAnchorElement",
  "HTMLButtonElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "HTMLSelectElement",
  "HTMLCanvasElement",
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
  "WheelEvent",
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
  usePathname: (): string => "/projects/fixture",
  useSearchParams: (): ReturnType<typeof nextNavigation.useSearchParams> =>
    new nextNavigation.ReadonlyURLSearchParams(window.location.search),
  useRouter: (): ReturnType<typeof nextNavigation.useRouter> => ({
    bfcacheId: "export-lifecycle",
    back: (): void => {},
    forward: (): void => {},
    refresh: (): void => {},
    push: (): void => {},
    replace: (): void => {},
    prefetch: (): void => {},
  }),
}));

const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
const images: ControlledImage[] = [];
class ControlledImage {
  width = 64;
  height = 32;
  crossOrigin = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";
  constructor() {
    images.push(this);
  }
}
Reflect.set(globalThis, "Image", ControlledImage);
let draws = 0;
Reflect.set(browser.HTMLCanvasElement.prototype, "getContext", (): { drawImage: () => void } => ({
  drawImage: (): void => {
    draws++;
  },
}));
Reflect.set(browser.HTMLCanvasElement.prototype, "toDataURL", (): string => png);
const actual = await import("../../utils/rab-export-utils");
const estimate: RabPrintableEstimate = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "DRAFT",
  revision: 1,
  title: "RAB untuk klien",
  clientNotes: "Catatan klien",
  approvedValue: "100.25",
  bundles: [],
  items: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      clientLabel: "Jasa klien",
      description: "Lingkup klien",
      quantity: "1",
      unit: "ls",
      unitPrice: "100.25",
      lineTotal: "100.25",
      isHidden: false,
      displayOrder: 1,
      itemNature: "SERVICE_FEE",
      bundleId: null,
    },
  ],
};
const meta = {
  projectName: "Proyek Uji",
  companyName: "Perusahaan Klien",
  clientName: "Penerima A",
  date: "17 Oktober 2026",
};
for (const mime of ["svg+xml", "webp"]) {
  const pending = actual.optimizeLogoDataUrl(`data:image/${mime};base64,fixture`);
  images.at(-1)?.onload?.();
  assert.equal(await pending, png);
}
assert.equal(draws, 2, "Small SVG/WebP are rasterized too, without requiring downscale");
const normalizedConfig = actual.resolveRabDocumentConfig(
  {
    ...actual.DEFAULT_RAB_CONFIG,
    companyName: "Identitas Perusahaan",
    docTitle: "Judul kustom",
    logoType: "image",
    logoDataUrl: png,
  },
  "Penerima A",
);
assert.equal(normalizedConfig.companyName, "Identitas Perusahaan");
assert.equal(normalizedConfig.docTitle, "Judul kustom");
assert.equal(normalizedConfig.logoDataUrl, png);
const book = await actual.buildRabStyledWorkbook(estimate, meta, normalizedConfig);
const embeddedMedia: unknown = Reflect.get(book.model, "media");
assert.ok(Array.isArray(embeddedMedia));
assert.equal(embeddedMedia.length, 1, "Normalized logo is included in the in-memory XLSX");
const legacyWorkbook = actual.buildRabStyledWorkbook(estimate, meta, {
  ...normalizedConfig,
  logoDataUrl: "data:image/webp;base64,legacy",
});
await new Promise<void>((resolve) => setTimeout(resolve, 0));
images.at(-1)?.onload?.();
const legacyMedia: unknown = Reflect.get((await legacyWorkbook).model, "media");
assert.ok(
  Array.isArray(legacyMedia) && legacyMedia.length === 1,
  "Existing stored WebP also renders in XLSX without changing its saved identity",
);
const invalid = actual.optimizeLogoDataUrl("data:image/webp;base64,broken");
images.at(-1)?.onerror?.();
await assert.rejects(invalid, /tidak dapat dibaca/);
const aborted = new AbortController();
const canceled = actual.optimizeLogoDataUrl(
  "data:image/svg+xml;base64,canceled",
  400,
  160,
  aborted.signal,
);
aborted.abort();
await assert.rejects(canceled, { name: "AbortError" });
assert.equal(images.at(-1)?.src, "");

const readers: ControlledReader[] = [];
class ControlledReader {
  result: string | null = null;
  readyState = 0;
  onload: (() => void | Promise<void>) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  constructor() {
    readers.push(this);
  }
  readAsDataURL(): void {
    this.readyState = 1;
  }
  abort(): void {
    this.readyState = 2;
    this.onabort?.();
  }
  complete(value: string): void {
    this.result = value;
    this.readyState = 2;
    void this.onload?.();
  }
}
Reflect.set(globalThis, "FileReader", ControlledReader);
const logoDecodes: { signal?: AbortSignal; finish: (value: string) => void }[] = [];
const captures: { element: HTMLElement; finish: (value: Blob) => void }[] = [];
const downloads: { type: string; name: string }[] = [];
mock.module("../../utils/rab-export-utils", () => ({
  ...actual,
  optimizeLogoDataUrl: (
    _value: string,
    _width?: number,
    _height?: number,
    signal?: AbortSignal,
  ): Promise<string> => new Promise((finish) => logoDecodes.push({ signal, finish })),
  buildRabPdfBlob: (element: HTMLElement): Promise<Blob> =>
    new Promise((finish) => captures.push({ element, finish })),
  downloadRabBlob: (blob: Blob, name: string): void => {
    downloads.push({ type: blob.type, name });
  },
  shareImageViaWhatsAppOrDevice: async (): Promise<{ shared: boolean }> => {
    throw new Error("Fixture must never share");
  },
}));
const { createRoot } = await import("react-dom/client");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { DesktopUIProvider } = await import("@/components/ui");
const { RabExportDrawer } = await import("./rab-export-drawer");
const { RabExportCanvas } = await import("./rab-export-canvas");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
let closed = 0;
let verifyDeferred = false;
let verifies = 0;
const verifications: (() => void)[] = [];
function verify(): Promise<void> {
  verifies++;
  return verifyDeferred ? new Promise((resolve) => verifications.push(resolve)) : Promise.resolve();
}
async function settle(ms = 40): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  });
}
async function render(
  open = true,
  value: RabPrintableEstimate = estimate,
  sourceError?: string,
): Promise<void> {
  await act(async (): Promise<void> =>
    root.render(
      <WorkspacePresentationProvider presentation="desktop">
        <DesktopUIProvider responsive>
          <RabExportDrawer
            open={open}
            rabEstimate={value}
            meta={{ ...meta, clientName: value.id === estimate.id ? "Penerima A" : "Penerima B" }}
            verifySource={verify}
            sourceError={sourceError}
            onClose={() => {
              closed++;
            }}
          />
        </DesktopUIProvider>
      </WorkspacePresentationProvider>,
    ),
  );
  await settle();
}
function button(text: string): HTMLButtonElement {
  const value = [...document.querySelectorAll("button")].find(
    (node) => node.textContent?.trim() === text,
  );
  assert.ok(value instanceof HTMLButtonElement, `Button ${text} exists`);
  return value;
}
async function click(element: HTMLElement): Promise<void> {
  await act(async (): Promise<void> => {
    element.focus();
    element.click();
  });
  await settle();
}
function field(label: string): HTMLInputElement {
  const associated = [...document.querySelectorAll("label")].find(
    (node) => node.textContent?.trim() === label,
  );
  const value = associated ? document.getElementById(associated.htmlFor) : null;
  assert.ok(value instanceof HTMLInputElement, `Field ${label} is associated`);
  return value;
}
async function type(element: HTMLInputElement, value: string): Promise<void> {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  assert.ok(set);
  await act(async (): Promise<void> => {
    set.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
}
async function customize(): Promise<void> {
  const trigger = [...document.querySelectorAll("button")].find(
    (node) => node.textContent?.trim() === "Tampilan dokumen",
  );
  if (trigger) await click(trigger);
  else assert.ok(button("Reset tampilan"));
}
async function imageMode(): Promise<void> {
  const tab = [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find((node) =>
    node.textContent?.includes("Logo Gambar"),
  );
  assert.ok(tab);
  await click(tab);
}
async function chooseFile(name: string): Promise<ControlledReader> {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  assert.ok(input);
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [new File(["<svg/>"], name, { type: "image/svg+xml" })],
  });
  await act(async (): Promise<void> => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await settle();
  assert.equal(input.value, "", "Same file can be selected again after every result");
  const reader = readers.at(-1);
  assert.ok(reader);
  return reader;
}
function saved(): ReturnType<typeof actual.resolveRabDocumentConfig> {
  const raw = browser.localStorage.getItem(actual.RAB_CONFIG_STORAGE_KEY);
  return actual.resolveRabDocumentConfig(raw ? JSON.parse(raw) : {}, "Penerima A");
}
try {
  browser.localStorage.clear();
  await render();
  await customize();
  await type(field("Nama perusahaan"), "Perusahaan kustom");
  await imageMode();
  const first = await chooseFile("same.svg");
  await act(async (): Promise<void> => first.complete("data:image/svg+xml;base64,A"));
  await settle();
  assert.equal(field("Nama perusahaan").disabled, true);
  const oldDecode = logoDecodes.at(-1);
  assert.ok(oldDecode);
  const second = await chooseFile("same.svg");
  await act(async (): Promise<void> => second.complete("data:image/svg+xml;base64,B"));
  await settle();
  const newDecode = logoDecodes.at(-1);
  assert.ok(newDecode && newDecode !== oldDecode);
  assert.equal(oldDecode.signal?.aborted, true);
  await act(async (): Promise<void> => newDecode.finish(png));
  await settle();
  await act(async (): Promise<void> => oldDecode.finish("data:image/png;base64,OLD"));
  await settle();
  assert.equal(saved().logoDataUrl, png);
  assert.equal(saved().companyName, "Perusahaan kustom");

  const remove = await chooseFile("late.svg");
  await act(async (): Promise<void> => remove.complete("data:image/svg+xml;base64,late"));
  await settle();
  const removedDecode = logoDecodes.at(-1);
  assert.ok(removedDecode);
  await click(button("Hapus"));
  await act(async (): Promise<void> => removedDecode.finish(png));
  await settle();
  assert.equal(saved().logoType, "text");
  assert.equal(saved().logoDataUrl, "");

  await imageMode();
  const reset = await chooseFile("reset.svg");
  await act(async (): Promise<void> => reset.complete("data:image/svg+xml;base64,reset"));
  await settle();
  const resetDecode = logoDecodes.at(-1);
  assert.ok(resetDecode);
  await click(button("Reset tampilan"));
  await act(async (): Promise<void> => resetDecode.finish(png));
  await settle();
  assert.equal(saved().logoDataUrl, "");
  assert.equal(field("Nama perusahaan").value, meta.companyName);

  await imageMode();
  const failed = await chooseFile("retry.svg");
  await act(async (): Promise<void> => failed.onerror?.());
  await settle();
  assert.ok(document.body.textContent?.includes("Pilih ulang berkas yang sama"));
  await chooseFile("retry.svg");
  assert.equal(readers.length, 6, "Failure releases the same-file input for a real retry");
  const close = document.querySelector<HTMLButtonElement>(
    '[aria-label="Dokumen RAB"] button[aria-label="Tutup"]',
  );
  assert.ok(close);
  await click(close);
  assert.equal(closed, 1, "Closing is allowed to cancel a logo read");
  assert.equal(readers.at(-1)?.readyState, 2);

  await render(false);
  await render();
  await customize();
  await imageMode();
  const changed = await chooseFile("entity.svg");
  await act(async (): Promise<void> => changed.complete("data:image/svg+xml;base64,entity"));
  await settle();
  const entityDecode = logoDecodes.at(-1);
  assert.ok(entityDecode);
  await render(true, { ...estimate, id: "33333333-3333-4333-8333-333333333333" });
  await act(async (): Promise<void> => entityDecode.finish(png));
  await settle();
  assert.equal(saved().logoDataUrl, "");
  assert.ok(document.querySelector("#rab-printable-document")?.textContent?.includes("Penerima B"));

  await render(false);
  await render();
  verifyDeferred = true;
  const downloadButton = button("Unduh PDF");
  const formatButton = button("PDF (.pdf)");
  await click(downloadButton);
  assert.equal(downloadButton.disabled, true);
  assert.equal(formatButton.disabled, true);
  assert.equal(button("Tampilan dokumen").disabled, true);
  await act(async (): Promise<void> => downloadButton.click());
  const pendingClose = document.querySelector<HTMLButtonElement>(
    '[aria-label="Dokumen RAB"] button[aria-label="Tutup"]',
  );
  assert.ok(pendingClose);
  await click(pendingClose);
  assert.equal(closed, 1, "Capture blocks dismissal and repeat export without another owner");
  assert.equal(verifications.length, 1);
  await act(async (): Promise<void> => verifications.shift()?.());
  await settle();
  assert.equal(captures.length, 1);
  await act(async (): Promise<void> =>
    captures[0].finish(new Blob(["pdf"], { type: "application/pdf" })),
  );
  await settle();
  assert.equal(downloads.length, 0, "Second source verification precedes release");
  await act(async (): Promise<void> => verifications.shift()?.());
  await settle();
  assert.deepEqual(downloads, [{ type: "application/pdf", name: "RAB_Proyek_Uji_R1.pdf" }]);
  assert.equal(verifies, 2);
  verifyDeferred = false;
  await click(button("Unduh PDF"));
  assert.equal(captures.length, 2);
  await render(true, estimate, "Akses dokumen ditolak.");
  await act(async (): Promise<void> =>
    captures[1].finish(new Blob(["old"], { type: "application/pdf" })),
  );
  await settle();
  assert.equal(downloads.length, 1, "A denied source suppresses an already-captured file");

  await act(async (): Promise<void> =>
    root.render(
      <WorkspacePresentationProvider presentation="desktop">
        <RabExportCanvas documentWidth={794}>
          <div>Last document line</div>
        </RabExportCanvas>
      </WorkspacePresentationProvider>,
    ),
  );
  await settle();
  const canvas = document.querySelector<HTMLElement>("[data-export-canvas-container]");
  const stage = document.querySelector<HTMLElement>("[data-export-canvas-stage]");
  const paper = document.querySelector<HTMLElement>("[data-export-canvas-wrapper] > div");
  assert.ok(canvas && stage && paper);
  Object.defineProperty(canvas, "clientHeight", { configurable: true, value: 600 });
  Object.defineProperty(stage, "clientHeight", { configurable: true, value: 520 });
  Object.defineProperty(paper, "offsetHeight", { configurable: true, value: 1600 });
  const wheel = new WheelEvent("wheel", { deltaY: 50, bubbles: true, cancelable: true });
  await act(async (): Promise<void> => {
    canvas.dispatchEvent(wheel);
  });
  assert.equal(
    wheel.defaultPrevented,
    true,
    "Canvas wheel pan consumes the containing sheet's scroll gesture",
  );
  await act(async (): Promise<void> => {
    canvas.focus();
    canvas.dispatchEvent(
      new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }),
    );
  });
  await settle(700);
  const wrapper = document.querySelector<HTMLElement>("[data-export-canvas-wrapper]");
  assert.ok(wrapper);
  const y = /translateY\((-?[\d.]+)px\)/.exec(wrapper.style.transform)?.[1];
  assert.ok(
    y && Math.abs(Number(y) + 64) < 1,
    `End reaches the visible stage bottom, transform=${wrapper.style.transform}`,
  );
  const neutral = new WheelEvent("wheel", { bubbles: true, cancelable: true });
  canvas.dispatchEvent(neutral);
  assert.equal(neutral.defaultPrevented, false);
  console.log("RAB export lifecycle, normalized logos and source release regressions passed");
} finally {
  await act(async (): Promise<void> => root.unmount());
  await browser.happyDOM.close();
}
