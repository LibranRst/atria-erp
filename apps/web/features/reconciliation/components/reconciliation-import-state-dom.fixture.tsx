import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { ReconciliationWorkspace as WorkspaceData } from "@/app/actions/finance/reconciliation-workspace";
import type { OperationalFormSheet } from "@/components/ui";

const browser = new Window({ url: "https://atria.test/reconciliation", width: 1440 });
Reflect.set(browser.Element.prototype, "animate", undefined);
for (const key of [
  "window",
  "document",
  "navigator",
  "performance",
  "CSS",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLButtonElement",
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

const ui = await import("@/components/ui");
function Sheet(props: React.ComponentProps<typeof OperationalFormSheet>): React.JSX.Element | null {
  if (!props.open) return null;
  return (
    <section aria-label={props.title}>
      <aside data-summary>{props.desktopAsideSummary}</aside>
      {props.children}
      <button type="button" onClick={props.onClose}>
        Tutup import
      </button>
    </section>
  );
}
mock.module("@/components/ui", () => ({ ...ui, OperationalFormSheet: Sheet }));
mock.module("./reconciliation-queue", () => ({
  ReconciliationQueue: ({
    onOpenImport,
  }: {
    readonly onOpenImport: () => void;
  }): React.JSX.Element => (
    <button type="button" onClick={onOpenImport}>
      Buka import
    </button>
  ),
}));
const navigation = await import("@/lib/navigation/workspace-navigation");
mock.module("@/lib/navigation/workspace-navigation", () => ({
  ...navigation,
  useRouter: () => ({ refresh: (): void => undefined }),
}));
mock.module("@/lib/media/upload-to-imagekit", () => ({
  uploadToImageKit: async () => ({
    fileName: "invalid.csv",
    url: "https://atria.test/invalid.csv",
    mimeType: "text/csv",
  }),
}));
mock.module("@/app/actions/finance/analyze-bank-statement", () => ({
  analyzeBankStatement: async () => ({
    success: false,
    error: { code: "VALIDATION_ERROR", message: "File belum dapat dibaca." },
  }),
}));

const { createRoot } = await import("react-dom/client");
const { ReconciliationWorkspace } = await import("./reconciliation-workspace");
const initialData: WorkspaceData = {
  bankAccounts: [{ id: "account", name: "Bank perusahaan", bankName: "BCA" }],
  cashTransactions: [],
  statementRows: [],
  history: [],
  historyTotal: 0,
};
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
await act(async (): Promise<void> => {
  root.render(<ReconciliationWorkspace initialData={initialData} />);
});

function click(label: string): void {
  const button = [...host.querySelectorAll("button")].find(
    (element) => element.textContent === label,
  );
  assert(button, `missing ${label}`);
  button.click();
}
function summary(): string {
  return host.querySelector("[data-summary]")?.textContent ?? "";
}
async function choose(content: string): Promise<void> {
  const input = host.querySelector<HTMLInputElement>('input[type="file"]');
  assert(input);
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [new browser.File([content], "Oktober.csv", { type: "text/csv" })],
  });
  await act(async (): Promise<void> => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  });
}

await act(async (): Promise<void> => {
  click("Buka import");
});
assert.match(summary(), /Belum dibaca/);
assert.doesNotMatch(summary(), /0 mutasi/);
await choose("tanggal,deskripsi,dana_masuk,dana_keluar\n2026-10-13,Pembayaran vendor,,123000\n");
assert.match(summary(), /1 mutasi/);
assert.match(summary(), /Dana masuk/);
assert.match(summary(), /Rp 0/);
await act(async (): Promise<void> => {
  click("Ganti berkas");
});
assert.match(summary(), /Belum dibaca/, "Changing the file resets source readiness");
assert.doesNotMatch(summary(), /0 mutasi|Dana masuk|Dana keluar/);
assert.equal(host.querySelector('input[type="file"]')?.getAttribute("disabled"), null);
await choose("tanggal,deskripsi,dana_masuk,dana_keluar\n2026-10-13,Pembayaran vendor,,123000\n");
assert.match(summary(), /1 mutasi/, "A replacement file can be read through the same owner");
await act(async (): Promise<void> => {
  const remove = host.querySelector<HTMLButtonElement>('button[title="Hapus baris ini"]');
  assert(remove);
  remove.click();
});
assert.match(summary(), /0 mutasi/);
await act(async (): Promise<void> => {
  click("Tutup import");
  click("Buka import");
});
assert.match(summary(), /Belum dibaca/);
assert.doesNotMatch(summary(), /0 mutasi/);
await choose("unrecognized bank file");
assert.match(summary(), /Perlu diperiksa/);
assert.doesNotMatch(summary(), /0 mutasi|Dana masuk|Dana keluar/);
await act(async (): Promise<void> => {
  root.unmount();
});
await browser.happyDOM.close();
console.log("statement import caller distinguishes unread, ready zero and failed source");
