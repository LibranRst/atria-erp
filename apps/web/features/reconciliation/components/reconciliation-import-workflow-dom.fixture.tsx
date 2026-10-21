import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { analyzeBankStatement } from "@/app/actions/finance/analyze-bank-statement";
import type { importParsedBankStatementRows } from "@/app/actions/finance/reconciliation-workspace";
import type { ImageKitUploadResult, UploadToImageKitOptions } from "@/lib/media/upload-to-imagekit";

const browser = new Window({
  url: "https://atria.test/reconciliation?keep=1#bank",
  width: 1440,
  height: 976,
});
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
mock.module("next/navigation", (): typeof navigation => ({
  ...navigation,
  usePathname: (): string => "/reconciliation",
  useSearchParams: (): ReturnType<typeof navigation.useSearchParams> =>
    new navigation.ReadonlyURLSearchParams(window.location.search),
  useRouter: (): ReturnType<typeof navigation.useRouter> => ({
    bfcacheId: "statement-import",
    back: (): void => {},
    forward: (): void => {},
    refresh: (): void => {},
    push: (): void => {},
    replace: (): void => {},
    prefetch: (): void => {},
  }),
}));
const fixture = await import("../../../.storybook/reconciliation-actions.fixture");
const { reconciliationFixtureData, RECONCILIATION_FIXTURE_PERMISSIONS, reconciliationFixtureId } =
  await import("../../../.storybook/reconciliation-data.fixture");
mock.module("../hooks/reconciliation-read-client", () => ({
  readReconciliationDesktop: fixture.readReconciliationDesktop,
  readReconciliationMatchContext: fixture.readReconciliationMatchContext,
}));
type AnalyzeResult = Awaited<ReturnType<typeof analyzeBankStatement>>;
const analyses: Array<{
  readonly input: Parameters<typeof analyzeBankStatement>[0];
  readonly finish: (result: AnalyzeResult) => void;
}> = [];
mock.module("@/app/actions/finance/analyze-bank-statement", () => ({
  analyzeBankStatement: (
    input: Parameters<typeof analyzeBankStatement>[0],
  ): Promise<AnalyzeResult> =>
    new Promise((finish) => {
      analyses.push({ input, finish });
    }),
}));
const uploads: UploadToImageKitOptions[] = [];
mock.module("@/lib/media/upload-to-imagekit", () => ({
  uploadToImageKit: async (input: UploadToImageKitOptions): Promise<ImageKitUploadResult> => {
    uploads.push(input);
    return {
      fileId: `file-${uploads.length}`,
      fileName: input.file.name,
      mimeType: input.file.type,
      size: input.file.size,
      url: `https://atria.test/api/media/file-${uploads.length}`,
    };
  },
}));
type WriteInput = Parameters<typeof importParsedBankStatementRows>[0];
type WriteResult = Awaited<ReturnType<typeof importParsedBankStatementRows>>;
const writes: Array<{
  readonly input: WriteInput;
  readonly finish: (result: WriteResult) => void;
}> = [];
let otherWrites = 0;
async function forbiddenWrite(): Promise<never> {
  otherWrites += 1;
  throw new Error("Import regression never performs another workflow mutation");
}
mock.module("@/app/actions/finance/reconciliation-workspace", () => ({
  importParsedBankStatementRows: (input: WriteInput): Promise<WriteResult> =>
    new Promise((finish) => {
      writes.push({ input, finish });
    }),
  recordBankStatementRow: forbiddenWrite,
}));
mock.module("@/app/actions/finance/reconcile-cash-transaction", () => ({
  reconcileCashTransaction: forbiddenWrite,
  markReconciliationException: forbiddenWrite,
  clearReconciliationException: forbiddenWrite,
}));
const { createRoot } = await import("react-dom/client");
const { DesktopUIProvider } = await import("@/components/ui");
const { PermissionsProvider } = await import("@/components/auth/permissions-provider");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { useWorkspaceViewportPresentation } = await import("@/lib/navigation/workspace-viewport");
const { ReconciliationWorkspace } = await import("./reconciliation-workspace");
const initial = {
  ...reconciliationFixtureData("empty"),
  bankAccounts: [
    { id: reconciliationFixtureId(9001), name: "BCA sumber pertama", bankName: "BCA" },
    { id: reconciliationFixtureId(9002), name: "BCA pilihan pengguna", bankName: "BCA" },
  ],
};
const preferredAccount = initial.bankAccounts[1];
assert(preferredAccount);
function Owner(): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation();
  return (
    <WorkspacePresentationProvider presentation={presentation}>
      <DesktopUIProvider responsive>
        <PermissionsProvider
          permissions={RECONCILIATION_FIXTURE_PERMISSIONS}
          user={{ id: "owner", name: "Owner", image: null, dataScope: "GLOBAL" }}
        >
          <ReconciliationWorkspace initialData={initial} />
        </PermissionsProvider>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
async function settle(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 40));
  });
}
async function render(key: string): Promise<void> {
  await act(async (): Promise<void> => {
    root.render(<Owner key={key} />);
  });
  await settle();
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
function sheet(): HTMLElement {
  const found = document.querySelector<HTMLElement>(
    '[role="dialog"][aria-label="Impor rekening koran"]',
  );
  assert(found, "Actual shared import sheet is open");
  return found;
}
function button(label: string, parent: ParentNode = document): HTMLButtonElement {
  const found = [...parent.querySelectorAll<HTMLButtonElement>("button")].find(
    (element) => visible(element) && element.textContent?.trim() === label,
  );
  assert(found, `Visible ${label} action exists`);
  return found;
}
async function click(element: HTMLElement): Promise<void> {
  await act(async (): Promise<void> => {
    element.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        buttons: 1,
      }),
    );
    element.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, buttons: 1 }),
    );
    element.focus();
  });
  await act(async (): Promise<void> => {
    element.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        buttons: 0,
      }),
    );
    element.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }),
    );
    element.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }),
    );
  });
  await settle();
}
async function waitFor(condition: () => boolean): Promise<void> {
  const deadline = performance.now() + 5_000;
  while (!condition() && performance.now() < deadline) await settle();
}
function account(): HTMLButtonElement {
  const found = [
    ...sheet().querySelectorAll<HTMLButtonElement>('button[aria-haspopup="listbox"]'),
  ].find((element) =>
    (element.getAttribute("aria-labelledby") ?? "")
      .split(" ")
      .some((id) => document.getElementById(id)?.textContent?.trim() === "Rekening"),
  );
  assert(found);
  return found;
}
async function chooseAccount(): Promise<void> {
  await click(account());
  const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((element) =>
    element.textContent?.includes(preferredAccount.name),
  );
  assert(option);
  await click(option);
  await waitFor(() => account().getAttribute("aria-expanded") !== "true");
}
function fileInput(): HTMLInputElement {
  const found = sheet().querySelector<HTMLInputElement>('input[type="file"]');
  assert(found);
  return found;
}
function dispatchFile(input: HTMLInputElement, file: File): void {
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  input.dispatchEvent(new Event("change", { bubbles: true }));
  assert.equal(input.value, "", "The native file value is reset for choosing the same file again");
}
async function chooseFile(file: File): Promise<void> {
  const input = fileInput();
  await act(async (): Promise<void> => {
    dispatchFile(input, file);
  });
  await settle();
}
const csv = (description: string): string =>
  `tanggal,deskripsi,dana_masuk,dana_keluar\n2026-10-17,${description},,1000\n`;
function preview(): HTMLTableElement {
  const found = sheet().querySelector<HTMLTableElement>(
    'table[aria-label="Pratinjau mutasi rekening koran"]',
  );
  assert(found);
  return found;
}
function previewNavigation(): HTMLElement {
  const found = sheet().querySelector<HTMLElement>('nav[aria-label="Halaman pratinjau mutasi"]');
  assert(found);
  return found;
}
async function resize(width: number): Promise<void> {
  await act(async (): Promise<void> => {
    browser.happyDOM.setWindowSize({ width, height: 976 });
    window.dispatchEvent(new Event("resize"));
  });
  await settle();
}
function analysisSuccess(count: number): AnalyzeResult {
  return {
    success: true,
    data: {
      detectedBankName: "BCA",
      detectedAccountNumber: "1234567890",
      rows: Array.from({ length: count }, (_, index) => ({
        rowNumber: index + 1,
        transactionDate: "2026-10-17",
        description: `Mutasi ${index + 1}`,
        amount: index + 1.25,
        type: index % 2 ? "OUTFLOW" : "INFLOW",
      })),
      summary: { rowCount: count, totalInflow: 0, totalOutflow: 0 },
    },
  };
}
async function finishWrite(index: number, success: boolean, count: number): Promise<void> {
  const write = writes[index];
  assert(write);
  await act(async (): Promise<void> => {
    write.finish(
      success
        ? {
            success: true,
            data: { importId: "synthetic-import", importedCount: count, duplicateCount: 0 },
          }
        : { success: false, error: { code: "CONFLICT", message: "Safe import fixture failure" } },
    );
  });
  await settle();
}
try {
  await render("main");
  await click(button("Impor mutasi"));
  await chooseAccount();
  const originalFileInput = fileInput();
  let finishA: ((text: string) => void) | undefined;
  let finishB: ((text: string) => void) | undefined;
  const a = new File(["a"], "A.csv", { type: "text/csv" });
  const b = new File(["b"], "B.csv", { type: "text/csv" });
  Object.defineProperty(a, "text", {
    value: (): Promise<string> =>
      new Promise((resolve) => {
        finishA = resolve;
      }),
  });
  Object.defineProperty(b, "text", {
    value: (): Promise<string> =>
      new Promise((resolve) => {
        finishB = resolve;
      }),
  });
  await act(async (): Promise<void> => {
    dispatchFile(originalFileInput, a);
  });
  assert(
    account().disabled,
    "CSV reading freezes the selected destination before awaiting file.text",
  );
  assert(button("Catat manual").disabled);
  assert(sheet().textContent?.includes("Membaca berkas"));
  assert(finishA);
  await render("csv-replacement-owner");
  await click(button("Impor mutasi"));
  await chooseAccount();
  await chooseFile(b);
  assert(finishB);
  await act(async (): Promise<void> => {
    finishB?.(csv("B terbaru"));
  });
  await settle();
  assert(preview().textContent?.includes("B terbaru"));
  assert(sheet().textContent?.includes("B.csv"));
  await act(async (): Promise<void> => {
    finishA?.(csv("A kadaluwarsa"));
  });
  await settle();
  assert(!sheet().textContent?.includes("A kadaluwarsa"));
  assert(preview().textContent?.includes("B terbaru"));
  assert(account().textContent?.includes(preferredAccount.name));
  await click(button("Ganti berkas"));
  assert(account().textContent?.includes(preferredAccount.name));
  const malformed = new File(
    ["tanggal,deskripsi,dana_masuk,dana_keluar\n2026-10-17,Transfer, rusak,1000,\n"],
    "invalid.csv",
    { type: "text/csv" },
  );
  await chooseFile(malformed);
  assert(sheet().textContent?.includes("jumlah kolom"));
  assert.equal(uploads.length, 0, "Recognized CSV validation failures stay local");
  let reads = 0;
  const retry = new File(["retry"], "retry.csv", { type: "text/csv" });
  Object.defineProperty(retry, "text", {
    value: async (): Promise<string> => {
      reads += 1;
      if (reads === 1) throw new Error("Safe file read failure");
      return csv("Berkas yang dicoba lagi");
    },
  });
  await chooseFile(retry);
  assert(sheet().textContent?.includes("Safe file read failure"));
  await chooseFile(retry);
  assert.equal(reads, 2);
  assert(preview().textContent?.includes("Berkas yang dicoba lagi"));
  await click(button("Simpan 1 Mutasi"));
  assert.equal(writes.length, 1);
  const localWrite = writes[0];
  assert(localWrite);
  assert.equal(localWrite.input.bankAccountId, preferredAccount.id);
  assert.equal(localWrite.input.fileName, "retry.csv");
  assert(
    !Object.hasOwn(localWrite.input, "fileUrl"),
    "Local CSV does not invent an uploaded source URL",
  );
  await finishWrite(0, true, 1);
  await waitFor(
    () => !document.querySelector('[role="dialog"][aria-label="Impor rekening koran"]'),
  );

  await click(button("Impor mutasi"));
  await chooseAccount();
  await chooseFile(new File(["pdf"], "BCA-source.pdf", { type: "application/pdf" }));
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0]?.purpose, "bank_statement");
  assert.equal(analyses.length, 1);
  assert(account().disabled);
  const analysis = analyses[0];
  assert(analysis);
  await act(async (): Promise<void> => {
    analysis.finish(analysisSuccess(25));
  });
  await settle();
  assert(
    account().textContent?.includes(preferredAccount.name),
    "Detected bank/account never replaces an explicit destination",
  );
  assert(sheet().textContent?.includes("1234567890"));
  assert(sheet().textContent?.includes("Rekening tujuan tetap mengikuti pilihan Anda"));
  assert.equal(preview().querySelectorAll("tbody tr").length, 10);
  assert(previewNavigation().textContent?.includes("25 hasil"));
  assert(preview().textContent?.includes("1,25"));
  await click(button("Berikutnya", previewNavigation()));
  await click(button("Berikutnya", previewNavigation()));
  assert.equal(preview().querySelectorAll("tbody tr").length, 5);
  const toggle = [...preview().querySelectorAll<HTMLButtonElement>("button")].find((element) =>
    element.getAttribute("aria-label")?.startsWith("Ubah arah Mutasi 21,"),
  );
  assert(toggle);
  await click(toggle);
  const remove = preview().querySelector<HTMLButtonElement>(
    'button[aria-label="Hapus mutasi Mutasi 22"]',
  );
  assert(remove);
  await click(remove);
  assert(previewNavigation().textContent?.includes("24 hasil"));
  assert(!preview().textContent?.includes("Mutasi 22"));
  await resize(390);
  assert(sheet().textContent?.includes("Mutasi 25"));
  await resize(1440);
  assert(
    previewNavigation().textContent?.includes("Halaman 3"),
    "Preview pagination belongs to the stable workflow owner across resize",
  );
  const manual = button("Catat manual");
  await click(manual);
  const confirmation = [...document.querySelectorAll<HTMLElement>('[role="alertdialog"]')].find(
    (element) => element.textContent?.includes("Beralih ke catatan manual?"),
  );
  assert(confirmation);
  await click(button("Batal", confirmation));
  await waitFor(() => !document.querySelector('[role="alertdialog"]'));
  assert(sheet().textContent?.includes("24 mutasi"));
  const save = button("Simpan 24 Mutasi");
  await click(save);
  assert.equal(writes.length, 2);
  const second = writes[1];
  assert(second);
  assert.equal(second.input.bankAccountId, preferredAccount.id);
  assert.equal(second.input.fileName, "BCA-source.pdf");
  assert.equal(second.input.fileUrl, "https://atria.test/api/media/file-1");
  assert.equal(second.input.rows.length, 24);
  assert.equal(second.input.rows.find((row) => row.description === "Mutasi 21")?.type, "OUTFLOW");
  assert(!second.input.rows.some((row) => row.description === "Mutasi 22"));
  assert.equal(second.input.rows[0]?.amount, 1.25);
  assert(account().disabled);
  assert(button("Catat manual").disabled);
  assert(button("Ganti berkas").disabled);
  const close = sheet().querySelector<HTMLButtonElement>('button[aria-label="Tutup"]');
  assert(close);
  await click(close);
  assert(sheet());
  await click(save);
  assert.equal(writes.length, 2, "Pending import cannot submit a second batch");
  await finishWrite(1, false, 24);
  assert(sheet().textContent?.includes("Safe import fixture failure"));
  assert(
    sheet().textContent?.includes("24 mutasi"),
    "A failed commit does not turn the successfully read preview into a failed source",
  );
  await click(button("Simpan 24 Mutasi"));
  assert.equal(writes.length, 3);
  await finishWrite(2, true, 24);
  await waitFor(
    () => !document.querySelector('[role="dialog"][aria-label="Impor rekening koran"]'),
  );

  await click(button("Impor mutasi"));
  await chooseFile(new File(["late"], "late.pdf", { type: "application/pdf" }));
  const late = analyses[1];
  assert(late);
  await render("replacement-owner");
  await click(button("Impor mutasi"));
  await act(async (): Promise<void> => {
    late.finish(analysisSuccess(1));
  });
  await settle();
  assert(!sheet().textContent?.includes("Mutasi 1"));
  assert(!sheet().textContent?.includes("late.pdf"));
  assert(sheet().textContent?.includes("Belum dibaca"));
  assert.equal(otherWrites, 0);
  assert.equal(window.location.hash, "#bank");
  assert.equal(new URLSearchParams(window.location.search).get("keep"), "1");
  console.log(
    "Actual statement import preserves latest source, explicit account, complete preview and protected commit",
  );
} finally {
  await act(async (): Promise<void> => {
    root.unmount();
  });
  await browser.happyDOM.close();
}
