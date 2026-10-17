import assert from "node:assert/strict";
import { Window } from "happy-dom";
import React, { act } from "react";

const browser = new Window({ url: "https://atria.test/expenses", width: 1440 });
Reflect.set(browser.Element.prototype, "animate", undefined);
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
  "FocusEvent",
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
const { createRoot } = await import("react-dom/client");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { ExpenseReceiptUpload } = await import("./expense-receipt-upload");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
const uploads: File[] = [];
const errors: string[] = [];
let pickers = 0;
let clears = 0;
type Props = React.ComponentProps<typeof ExpenseReceiptUpload>;
const initial: Props = {
  attachment: null,
  selectedProjectId: "project",
  disabled: false,
  isUploading: false,
  isProcessingOCR: false,
  onSelectFile: (file): void => {
    uploads.push(file);
  },
  onClearReceipt: (): void => {
    clears += 1;
  },
  onValidationError: (message): void => {
    errors.push(message);
  },
};
async function render(
  props: Partial<Props> = {},
  presentation: "mobile" | "desktop" = "desktop",
): Promise<void> {
  await act(async (): Promise<void> => {
    root.render(
      <WorkspacePresentationProvider presentation={presentation}>
        <ExpenseReceiptUpload {...initial} {...props} />
      </WorkspacePresentationProvider>,
    );
  });
}
function button(label: string): HTMLButtonElement {
  const found = [...host.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === label,
  );
  assert(found, `Native button ${label} exists`);
  return found;
}
function input(label: string): HTMLInputElement {
  const found = [...host.querySelectorAll<HTMLInputElement>('input[type="file"]')].find(
    (item) => item.getAttribute("aria-label") === label,
  );
  assert(found, `Associated file input ${label} exists`);
  return found;
}
async function click(control: HTMLButtonElement): Promise<void> {
  await act(async (): Promise<void> => {
    control.click();
  });
}
async function choose(file: File | null): Promise<void> {
  const control = input("Pilih Gambar");
  Object.defineProperty(control, "files", { configurable: true, value: file ? [file] : [] });
  await act(async (): Promise<void> => {
    control.dispatchEvent(new Event("change", { bubbles: true }));
  });
  assert.equal(
    control.value,
    "",
    "Choosing a file resets the input so the same file can be retried",
  );
}
try {
  await render({ selectedProjectId: "" });
  assert(button("Foto Nota").disabled);
  assert(button("Pilih Gambar").disabled);
  assert(input("Pilih Gambar").disabled);
  await render();
  const file = input("Pilih Gambar");
  file.addEventListener("click", (): void => {
    pickers += 1;
  });
  assert.equal(file.tabIndex, -1, "Visible native button is the sole file-picker tab stop");
  assert.equal(input("Foto Nota").getAttribute("capture"), "environment");
  const picker = button("Pilih Gambar");
  await act(async (): Promise<void> => {
    picker.focus();
  });
  assert(Boolean(document.activeElement === picker), "File picker action receives keyboard focus");
  await click(picker);
  assert.equal(pickers, 1, "Visible button activates its associated file picker exactly once");

  await choose(new File(["invalid"], "nota.pdf", { type: "application/pdf" }));
  assert.equal(uploads.length, 0);
  assert.match(errors.at(-1) ?? "", /Pilih file gambar nota/);
  const oversized = new File(["large"], "large.jpg", { type: "image/jpeg" });
  Object.defineProperty(oversized, "size", { value: 13 * 1024 * 1024 });
  await choose(oversized);
  assert.equal(uploads.length, 0);
  assert.match(errors.at(-1) ?? "", /melebihi 12 MB/);
  await choose(null);
  assert.equal(errors.length, 2, "Canceling the file picker adds no validation error");

  const valid = new File(["image"], "nota.jpg", { type: "image/jpeg" });
  await choose(valid);
  await choose(valid);
  assert.equal(uploads.length, 2, "The same valid image may be selected again");
  assert.equal(uploads[0], valid);
  await render({ isUploading: true, uploadError: "Unggah belum berhasil" });
  assert(button("Pilih Gambar").disabled, "Intrinsic upload busy state blocks a second file");
  assert(button("Coba Lagi").disabled, "Busy upload cannot be retried concurrently");
  await click(button("Pilih Gambar"));
  assert.equal(pickers, 1);
  await render({ isProcessingOCR: true });
  assert(button("Foto Nota").disabled, "OCR busy state also blocks choosing another file");
  await render({ uploadError: "Unggah belum berhasil" });
  await click(button("Coba Lagi"));
  assert.equal(uploads.length, 3);
  assert.equal(uploads.at(-1), valid, "Retry sends the last accepted image");
  await render({
    attachment: {
      fileId: "receipt-fixture",
      url: "https://atria.test/nota.jpg",
      fileName: "nota.jpg",
      size: 5,
      mimeType: "image/jpeg",
    },
  });
  await click(button("Hapus"));
  assert.equal(clears, 1);
  assert(!button("Ganti Gambar").disabled);
  await render({ disabled: true }, "mobile");
  assert(button("Pilih Gambar").disabled, "Mobile keeps the same disabled action semantics");
  console.log(
    "Receipt upload native controls preserve file selection, validation, retry and busy guards",
  );
} finally {
  await act(async (): Promise<void> => {
    root.unmount();
  });
  await browser.happyDOM.close();
}
