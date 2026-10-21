import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { ActionResponse } from "@atria/core/types/action-response";
import type {
  MaterialImportInput,
  MaterialImportPreview,
} from "@/app/actions/settings/material-import";
import type { InitialStockImportPreview } from "@/app/actions/material/opening-inventory";
import type { OpeningInventoryCsvInput } from "@atria/core/import/material-csv";

const browser = new Window({ url: "https://paduna.test/settings", width: 1440, height: 976 });
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
  "HTMLFormElement",
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
let refreshes = 0;
const navigation = await import("next/navigation");
mock.module("next/navigation", (): typeof navigation => ({
  ...navigation,
  usePathname: (): string => "/settings",
  useSearchParams: (): ReturnType<typeof navigation.useSearchParams> =>
    new navigation.ReadonlyURLSearchParams(window.location.search),
  useRouter: (): ReturnType<typeof navigation.useRouter> => ({
    bfcacheId: "material-import-workflow",
    back: (): void => {},
    forward: (): void => {},
    refresh: (): void => {
      refreshes += 1;
    },
    push: (): void => {},
    replace: (): void => {},
    prefetch: (): void => {},
  }),
}));
type Deferred<T> = {
  readonly promise: Promise<T>;
  readonly finish: (value: T) => void;
  readonly fail: (error: Error) => void;
};
function deferred<T>(): Deferred<T> {
  let finish: (value: T) => void = (): void => {
    throw new Error("Deferred not initialized");
  };
  let fail: (error: Error) => void = (): void => {
    throw new Error("Deferred not initialized");
  };
  const promise = new Promise<T>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  return { promise, finish, fail };
}
const previews: Array<{
  readonly input: MaterialImportInput;
  readonly response: Deferred<ActionResponse<MaterialImportPreview>>;
}> = [];
const commits: Array<{
  readonly input: MaterialImportInput;
  readonly response: Deferred<ActionResponse<{ readonly created: number }>>;
}> = [];
mock.module("@/app/actions/settings/material-import", () => ({
  previewMaterialImport: (
    input: MaterialImportInput,
  ): Promise<ActionResponse<MaterialImportPreview>> => {
    const response = deferred<ActionResponse<MaterialImportPreview>>();
    previews.push({ input, response });
    return response.promise;
  },
  commitMaterialImport: (
    input: MaterialImportInput,
  ): Promise<ActionResponse<{ readonly created: number }>> => {
    const response = deferred<ActionResponse<{ readonly created: number }>>();
    commits.push({ input, response });
    return response.promise;
  },
}));
const openingPreviews: Array<{
  readonly input: OpeningInventoryCsvInput;
  readonly response: Deferred<ActionResponse<InitialStockImportPreview>>;
}> = [];
const openingWrites: Array<{
  readonly input: unknown;
  readonly response: Deferred<ActionResponse<never>>;
}> = [];
mock.module("@/app/actions/material/opening-inventory", () => ({
  previewInitialStockImport: (
    input: OpeningInventoryCsvInput,
  ): Promise<ActionResponse<InitialStockImportPreview>> => {
    const response = deferred<ActionResponse<InitialStockImportPreview>>();
    openingPreviews.push({ input, response });
    return response.promise;
  },
  createInventoryOpening: (input: unknown): Promise<ActionResponse<never>> => {
    const response = deferred<ActionResponse<never>>();
    openingWrites.push({ input, response });
    return response.promise;
  },
}));
mock.module("sonner", () => ({
  toast: { success: (): void => {}, error: (): void => {}, warning: (): void => {} },
}));
const { createRoot } = await import("react-dom/client");
const { DesktopUIProvider, Button } = await import("@/components/ui");
const { PermissionsProvider } = await import("@/components/auth/permissions-provider");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { useWorkspaceViewportPresentation } = await import("@/lib/navigation/workspace-viewport");
const { MaterialImportSheet } = await import("./material-import-sheet");
const { MaterialSettingsManager } = await import("./material-settings-manager");
const { OpeningInventoryEntryForm } =
  await import("@/features/materials/components/workspaces/opening-inventory-entry-form");
type Mode = "material" | "opening" | "manager";
function Owner({ mode }: { readonly mode: Mode }): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation();
  const [open, setOpen] = React.useState(true);
  return (
    <WorkspacePresentationProvider presentation={presentation}>
      <DesktopUIProvider responsive>
        <PermissionsProvider permissions={["manage:material_settings"]}>
          {mode === "manager" ? (
            <MaterialSettingsManager
              initialMaterials={[]}
              initialCategories={[]}
              vendors={[]}
              locations={[]}
              canManage
            />
          ) : (
            <>
              <Button onClick={() => setOpen(true)}>Buka impor</Button>
              {mode === "material" ? (
                <MaterialImportSheet open={open} onClose={() => setOpen(false)} />
              ) : (
                <OpeningInventoryEntryForm
                  eligibleInventory={[]}
                  presentation="sheet"
                  desktopLayout
                  open={open}
                  onClose={() => setOpen(false)}
                />
              )}
            </>
          )}
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
async function render(mode: Mode, key: string): Promise<void> {
  await act(async (): Promise<void> => {
    root.render(<Owner mode={mode} key={key} />);
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
function buttons(label: string, container: ParentNode = document): HTMLButtonElement[] {
  return [...container.querySelectorAll("button")].filter((element) => {
    const content = element.cloneNode(true);
    assert(content instanceof HTMLElement);
    content.querySelectorAll('[aria-hidden="true"]').forEach((icon) => icon.remove());
    return (
      visible(element) &&
      (content.textContent?.trim() === label || element.getAttribute("aria-label") === label)
    );
  });
}
function button(label: string, container: ParentNode = document): HTMLButtonElement {
  const value = buttons(label, container)[0];
  assert(value, `Visible button ${label}`);
  return value;
}
async function click(label: string, container: ParentNode = document): Promise<void> {
  await act(async (): Promise<void> => button(label, container).click());
  await settle();
}
function fileInput(): HTMLInputElement {
  const input = [...document.querySelectorAll("input[type=file]")].find(visible);
  assert(input instanceof HTMLInputElement);
  return input;
}
async function choose(file: File): Promise<void> {
  const input = fileInput();
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async (): Promise<void> => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await settle();
}
async function finish<T>(response: Deferred<T>, value: T): Promise<void> {
  await act(async (): Promise<void> => response.finish(value));
  await settle();
}
function csv(name: string, count = 1): File {
  return new File(
    [
      "name,category,unit,location,minimum_stock,last_purchase_price,vendor,specification,brand,code,color\n" +
        Array.from(
          { length: count },
          (_, index) =>
            `${name} ${index + 1},Panel,lembar,Gudang,1.25,1234.56,Vendor,Tebal 18 mm,Merek,${name}-${index + 1},Natural`,
        ).join("\n") +
        "\n",
    ],
    `${name}.csv`,
    { type: "text/csv" },
  );
}
function materialSuccess(input: MaterialImportInput): ActionResponse<MaterialImportPreview> {
  return {
    success: true,
    data: {
      items: input.rows.map((row) => ({
        ...row,
        categoryId: "category",
        locationId: "location",
        vendorId: "vendor",
      })),
      errors: [],
    },
  };
}
function table(label: string): HTMLElement {
  const value = document.querySelector(`[aria-label="${label}"]`);
  assert(value instanceof HTMLElement);
  return value;
}
function tableRows(label: string): Element[] {
  return [...table(label).querySelectorAll("tbody tr")];
}
function text(): string {
  return document.body.textContent ?? "";
}
async function resize(width: number): Promise<void> {
  await act(async (): Promise<void> => {
    browser.happyDOM.setWindowSize({ width, height: 976 });
    window.dispatchEvent(new Event("resize"));
  });
  await settle();
}
async function closeDiscard(): Promise<void> {
  await click("Tutup");
  await click("Buang perubahan");
  for (let index = 0; index < 18 && document.querySelector('[role="dialog"]'); index += 1)
    await settle();
}

await render("material", "race-read");
const oldText = deferred<string>();
const oldFile = csv("Lama");
Object.defineProperty(oldFile, "text", { value: (): Promise<string> => oldText.promise });
await choose(oldFile);
assert(fileInput().disabled, "Busy begins during file.text, before a preview request");
await choose(csv("Baru", 26));
assert.equal(previews.length, 1);
assert.equal(previews[0]?.input.rows[0]?.name, "Baru 1");
const current = previews[0];
assert(current);
await finish(current.response, materialSuccess(current.input));
await finish(oldText, await csv("Lama").text());
assert.equal(previews.length, 1, "A late read cannot replace newer file intent");
assert.equal(tableRows("Material valid dari CSV").length, 10);
assert(text().includes("26 hasil · Halaman 1 dari 3"));
const first = tableRows("Material valid dari CSV")[0]?.textContent ?? "";
for (const value of [
  "Baru 1",
  "Merek",
  "Natural",
  "Tebal 18 mm",
  "Vendor",
  "1,25 lembar",
  "1.234,56",
])
  assert(first.includes(value), `Complete preview includes ${value}`);
await click("Berikutnya");
assert(text().includes("26 hasil · Halaman 2 dari 3"));
assert(tableRows("Material valid dari CSV")[0]?.textContent?.includes("Baru 11"));
await click("10 baris");
const option25 = [...document.querySelectorAll('[role="option"]')].find((value) =>
  value.textContent?.includes("25 baris"),
);
assert(option25 instanceof HTMLElement);
await act(async (): Promise<void> => option25.click());
await settle();
assert.equal(tableRows("Material valid dari CSV").length, 25);
assert(text().includes("Halaman 1 dari 2"));
await resize(390);
assert(text().includes("26 hasil · Halaman 1 dari 2"));
await resize(1440);
await click("Impor");
await act(async (): Promise<void> => button("Mengimpor…").click());
assert.equal(commits.length, 1);
assert(fileInput().disabled);
const write = commits[0];
assert(write);
assert.equal(write.input.rows[0]?.name, "Baru 1");
assert.equal(write.input.rows.length, 26);
await finish(write.response, {
  success: false,
  error: { code: "VALIDATION_ERROR", message: "Kode material berubah; periksa kembali." },
});
assert(document.querySelector('[role="alert"]')?.textContent?.includes("Kode material berubah"));
assert.equal(tableRows("Material valid dari CSV").length, 25);
await click("Coba impor lagi");
assert.equal(commits.length, 2);
const retry = commits[1];
assert(retry);
await finish(retry.response, { success: true, data: { created: 26 } });
assert.equal(refreshes, 1);

await render("material", "race-preview");
await choose(csv("Pertama"));
await choose(csv("Kedua"));
const earlier = previews[1];
const later = previews[2];
assert(earlier && later);
await finish(later.response, materialSuccess(later.input));
await finish(earlier.response, materialSuccess(earlier.input));
assert(table("Material valid dari CSV").textContent?.includes("Kedua 1"));
assert(!table("Material valid dari CSV").textContent?.includes("Pertama 1"));
await closeDiscard();
await click("Buka impor");
assert(!document.querySelector('[aria-label="Pratinjau Material Master"]'));
await choose(csv("Retry"));
const failed = previews[3];
assert(failed);
await act(async (): Promise<void> =>
  failed.response.fail(new Error("An unexpected response was received from the server.")),
);
await settle();
assert(
  document.querySelector('[role="alert"]')?.textContent?.includes("Validasi belum dapat dimuat"),
);
assert(!document.querySelector('[role="alert"]')?.textContent?.includes("unexpected"));
await click("Coba validasi lagi");
const validationRetry = previews[4];
assert(validationRetry);
assert.equal(validationRetry.input.rows[0]?.name, "Retry 1");
await finish(validationRetry.response, materialSuccess(validationRetry.input));
await closeDiscard();

await render("material", "mixed-preview");
await choose(csv("Campuran", 27));
const mixed = previews[5];
assert(mixed);
await finish(mixed.response, {
  success: true,
  data: {
    items: mixed.input.rows.slice(0, 14).map((row) => ({
      ...row,
      categoryId: "category",
      locationId: "location",
      vendorId: "vendor",
    })),
    errors: mixed.input.rows
      .slice(14)
      .map((row) => ({ rowNumber: row.rowNumber, message: "Nama material sudah digunakan." })),
  },
});
assert.equal(tableRows("Kesalahan CSV material").length, 10);
assert(text().includes("27 baris dibaca") && text().includes("13 hasil · Halaman 1 dari 2"));
assert(button("Impor").disabled || button("Impor").getAttribute("aria-disabled") === "true");
await click("Impor");
assert.equal(commits.length, 2, "Errors never become a committable healthy preview");
await click("Berikutnya");
assert.equal(tableRows("Kesalahan CSV material").length, 3);
assert(table("Kesalahan CSV material").textContent?.includes("Campuran 27"));
const validTab = [...document.querySelectorAll('[role="tab"]')].find((value) =>
  value.textContent?.startsWith("Valid"),
);
assert(validTab instanceof HTMLElement);
await act(async (): Promise<void> => validTab.click());
assert(
  text().includes("14 hasil · Halaman 1 dari 2"),
  "Changing validation peer resets only its page",
);
await closeDiscard();
await click("Buka impor");
await choose(csv("Late"));
const late = previews[6];
assert(late);
await render("material", "new-owner");
await finish(late.response, materialSuccess(late.input));
assert(
  !document.querySelector('[aria-label="Pratinjau Material Master"]'),
  "An unmounted owner cannot install an obsolete preview into the next intent",
);

await render("opening", "opening");
const csvTab = [...document.querySelectorAll('[role="tab"]')].find((value) =>
  value.textContent?.includes("Import CSV"),
);
assert(csvTab instanceof HTMLElement);
await act(async (): Promise<void> => csvTab.click());
await settle();
const dateTrigger = [...document.querySelectorAll("button")].find((value) =>
  value.getAttribute("aria-label")?.startsWith("Tanggal saldo awal:"),
);
assert(dateTrigger);
await act(async (): Promise<void> => dateTrigger.click());
await settle();
const day = document.querySelector('button[role="gridcell"][tabindex="0"]');
assert(day instanceof HTMLButtonElement);
await act(async (): Promise<void> => day.click());
await settle();
const note = document.querySelector("textarea");
assert(note instanceof HTMLTextAreaElement);
const noteSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
assert(noteSetter);
await act(async (): Promise<void> => {
  noteSetter.call(note, "Hasil hitung fisik sumber CSV pengujian");
  note.dispatchEvent(new Event("input", { bubbles: true }));
});
const openingCsv = new File(
  ["material_name,location_name,quantity,unit_cost\nMultipleks,Gudang,2,21.61\n"],
  "saldo.csv",
  { type: "text/csv" },
);
const openingText = deferred<string>();
Object.defineProperty(openingCsv, "text", { value: (): Promise<string> => openingText.promise });
await choose(openingCsv);
const manualTab = [...document.querySelectorAll('[role="tab"]')].find((value) =>
  value.textContent?.includes("Isi manual"),
);
assert(manualTab instanceof HTMLElement);
assert.equal(manualTab.getAttribute("aria-disabled"), "true");
await act(async (): Promise<void> => manualTab.click());
assert(!text().includes("Tambah item"), "Pending prevents a mode change before parsing finishes");
await finish(
  openingText,
  "material_name,location_name,quantity,unit_cost\nMultipleks,Gudang,2,21.61\n",
);
const openingPreview = openingPreviews[0];
assert(openingPreview);
await finish(openingPreview.response, {
  success: true,
  data: {
    items: [
      {
        rowNumber: 2,
        materialInventoryId: "inventory",
        materialName: "Multipleks",
        locationName: "Gudang",
        unit: "lembar",
        quantity: 2,
        unitCost: 21.61,
      },
    ],
    errors: [],
  },
});
const openingRow = tableRows("Saldo awal valid dari CSV")[0]?.textContent ?? "";
for (const value of ["2 lembar", "21,61", "43,22"])
  assert(openingRow.includes(value), `Exact opening preview includes ${value}`);
const form = document.getElementById("onboarding-opening-inventory-form");
assert(form instanceof HTMLFormElement);
await act(async (): Promise<void> => {
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
});
await settle();
assert.equal(
  openingWrites.length,
  1,
  "Two submissions before React settles invoke only one writer",
);
assert(note.disabled && fileInput().disabled);
const openingWrite = openingWrites[0];
assert(openingWrite);
await finish(openingWrite.response, {
  success: false,
  error: { code: "CONFLICT", message: "Saldo awal sudah ada untuk lokasi ini." },
});
assert(document.querySelector('[role="alert"]')?.textContent?.includes("Saldo awal sudah ada"));
assert.equal(note.value, "Hasil hitung fisik sumber CSV pengujian");
assert(table("Saldo awal valid dari CSV").textContent?.includes("43,22"));
await click("Coba ajukan lagi");
assert.equal(openingWrites.length, 2);
const openingRetry = openingWrites[1];
assert(openingRetry);
await finish(openingRetry.response, {
  success: false,
  error: { code: "CONFLICT", message: "Masih perlu koreksi sumber." },
});

await render("manager", "actual-focus-owner");
const desktopInvoker = button("Import CSV");
await act(async (): Promise<void> => {
  desktopInvoker.focus();
  desktopInvoker.click();
});
await settle();
await resize(390);
assert(
  !desktopInvoker?.isConnected,
  "Desktop import invoker is replaced by mobile manager composition",
);
await click("Tutup");
for (let index = 0; index < 22 && document.querySelector('[role="dialog"]'); index += 1)
  await settle();
assert.equal(
  document.activeElement?.getAttribute("aria-label"),
  "Material Master",
  "The persistent actual owner receives fallback focus after resize",
);
assert.equal(commits.length, 2);
assert.equal(openingWrites.length, 2);
assert.equal(refreshes, 1, "Only explicit mocked successful import refreshes data");
await act(async (): Promise<void> => root.unmount());
await browser.happyDOM.cancelAsync();
console.log("Material import workflow DOM regression passed");
