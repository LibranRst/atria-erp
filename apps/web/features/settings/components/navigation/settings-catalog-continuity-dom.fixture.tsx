import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { PermissionKey } from "@atria/core/auth/permissions";

const browserWindow = new Window({
  url: "https://atria.test/settings?tab=catalog&unrelated=keep#catalog",
  width: 1280,
  height: 960,
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
  usePathname: (): string => "/settings",
  useRouter: (): ReturnType<typeof nextNavigation.useRouter> => ({
    bfcacheId: "settings-skeleton-fixture",
    back: (): void => {},
    forward: (): void => {},
    refresh: (): void => {},
    push: (): void => {},
    replace: (): void => {},
    prefetch: (): void => {},
  }),
}));

let writes = 0;
const vendorActions = await import("@/app/actions/administration-vendors");
mock.module("@/app/actions/administration-vendors", () => ({
  ...vendorActions,
  saveVendor: async (): Promise<never> => {
    writes += 1;
    throw new Error("Catalog consistency QA never saves a vendor");
  },
}));
const { createRoot } = await import("react-dom/client");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { DesktopUIProvider } = await import("@/components/ui");
const { PermissionsProvider } = await import("@/components/auth/permissions-provider");
const { SettingsDashboard } = await import("./settings-dashboard");
const { updateBrowserUrl } = await import("@/lib/utils/use-url-search-param");
const { SETTINGS_FIXTURE_OVERVIEW, SETTINGS_FIXTURE_PRICING, SETTINGS_FIXTURE_PERMISSIONS } =
  await import("../../../../.storybook/settings-data.fixture");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
async function settle(duration = 35): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, duration));
  });
}
async function render(
  permissions: readonly PermissionKey[] = SETTINGS_FIXTURE_PERMISSIONS,
): Promise<void> {
  await act(async (): Promise<void> => {
    root.render(
      <WorkspacePresentationProvider presentation="desktop">
        <DesktopUIProvider>
          <PermissionsProvider
            permissions={permissions}
            user={{ id: "catalog-owner", name: "Owner", image: null, dataScope: "GLOBAL" }}
          >
            <SettingsDashboard
              overview={SETTINGS_FIXTURE_OVERVIEW}
              pricingTemplates={SETTINGS_FIXTURE_PRICING}
              administration={null}
              setup={null}
              initialStock={[]}
              openingBatches={[]}
              approvalThresholds={null}
            />
          </PermissionsProvider>
        </DesktopUIProvider>
      </WorkspacePresentationProvider>,
    );
  });
  await settle();
}
async function press(element: HTMLElement): Promise<void> {
  await act(async (): Promise<void> => {
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    element.click();
  });
  await settle();
}
function tab(label: string): HTMLElement {
  const found = [...host.querySelectorAll<HTMLElement>('[role="tab"]')].find((item) =>
    item.textContent?.trim().startsWith(label),
  );
  assert(found, `Tab ${label} exists`);
  return found;
}
function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent?.trim() === label,
  );
  assert(found, `Button ${label} exists`);
  return found;
}
function input(label: string): HTMLInputElement {
  const found = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  assert(found, `Search ${label} exists`);
  return found;
}
async function type(field: HTMLInputElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  assert(setter);
  await act(async (): Promise<void> => {
    field.focus();
    setter.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
}
function query(key: string): string | null {
  return new URL(window.location.href).searchParams.get(key);
}
function table(label: string): HTMLTableElement {
  const found = host.querySelector<HTMLTableElement>(`table[aria-label="${label}"]`);
  assert(found, `Table ${label} exists`);
  return found;
}
function select(label: string): HTMLElement {
  const owner =
    [...document.querySelectorAll<HTMLElement>('[role="dialog"]')]
      .filter((item) => !item.closest('[data-atria-overlay-closing="true"], [hidden], [inert]'))
      .at(-1) ?? document;
  const trigger = [...owner.querySelectorAll<HTMLElement>('button[aria-haspopup="listbox"]')].find(
    (item) =>
      item.getAttribute("aria-label") === label ||
      (item.getAttribute("aria-labelledby") ?? "")
        .split(" ")
        .some((id) => document.getElementById(id)?.textContent?.trim() === label),
  );
  assert(trigger, `Select ${label} has an accessible labeled trigger`);
  return trigger;
}
async function waitForExit(role: "dialog" | "listbox"): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (!document.querySelector(`[role="${role}"]`)) return;
    await settle(25);
  }
  assert(!document.querySelector(`[role="${role}"]`), `The previous ${role} completes its exit`);
}
async function option(text: string): Promise<void> {
  const found = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((item) =>
    item.textContent?.includes(text),
  );
  assert(found, `Option ${text} is available`);
  await press(found);
  await waitForExit("listbox");
}
async function navigateQuery(patch: Readonly<Record<string, string>>): Promise<void> {
  await act(async (): Promise<void> => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(patch)) url.searchParams.set(key, value);
    updateBrowserUrl(`${url.pathname}${url.search}${url.hash}`, "replace");
  });
  await settle();
}
try {
  await render();
  assert(
    !host.textContent?.includes("memerlukan perhatian"),
    "Catalog entity totals never claim operational risk",
  );
  assert(
    host.querySelector('[aria-label="24 material aktif"]'),
    "Material count has a factual accessible label",
  );
  await type(input("Cari material master"), "Multipleks");
  assert.equal(query("settings-material-search"), "Multipleks");
  await press(tab("Library"));
  assert.equal(input("Cari template harga").value, "", "Collections have independent searches");
  await type(input("Cari template harga"), "Pengiriman");
  await press(tab("Material"));
  assert.equal(
    input("Cari material master").value,
    "Multipleks",
    "Nested peer revisit retains the Material query",
  );
  await press(tab("Finansial & Budget"));
  await press(tab("Katalog Master Data"));
  assert.equal(
    input("Cari material master").value,
    "Multipleks",
    "Main Settings revisit retains the query without mounting hidden editors",
  );
  await press(tab("Library"));
  assert.equal(input("Cari template harga").value, "Pengiriman");
  await type(input("Cari template harga"), "");
  const costHeader = [...table("Library item dan harga").querySelectorAll<HTMLElement>("th")].find(
    (item) => item.textContent?.includes("Biaya internal"),
  );
  assert(costHeader);
  await press(costHeader);
  await press(costHeader);
  assert.equal(query("settings-library-sort"), "internal");
  assert.equal(query("settings-library-direction"), "descending");
  const firstSorted = table("Library item dan harga").querySelector("tbody tr")?.textContent;
  await press(button("Berikutnya"));
  assert.equal(query("settings-library-page"), "2");
  const secondPage = table("Library item dan harga").querySelector("tbody tr")?.textContent;
  assert.notEqual(firstSorted, secondPage, "Pagination uses the completely sorted collection");
  await press(tab("Lokasi"));
  await type(input("Cari lokasi gudang"), "workshop");
  await press(tab("Library"));
  assert.equal(query("settings-library-page"), "2");
  assert.equal(table("Library item dan harga").querySelector("tbody tr")?.textContent, secondPage);
  await press(select("Jumlah baris"));
  await option("25 baris");
  assert.equal(query("settings-library-pageSize"), "25");
  assert.equal(query("settings-library-page"), "1");
  await press(button("Tambah template"));
  await settle(650);
  await press(select("Kategori pengeluaran"));
  await settle(450);
  const categoryChoices = [...document.querySelectorAll<HTMLElement>('[role="option"]')];
  assert(categoryChoices.length > 0, "The nested Library category menu opens");
  for (const category of SETTINGS_FIXTURE_OVERVIEW.expenseCategories) {
    assert(
      !categoryChoices.some((item) => item.textContent?.includes(category.code)),
      "Category choices expose readable labels and descriptions, never internal codes",
    );
  }
  const firstCategory = SETTINGS_FIXTURE_OVERVIEW.expenseCategories[0];
  assert(firstCategory);
  await option(firstCategory.name);
  const closeTemplate = document.querySelector<HTMLButtonElement>('button[aria-label="Tutup"]');
  assert(closeTemplate, "Library editor has the shared close action");
  await press(closeTemplate);
  await waitForExit("dialog");
  await press(tab("Lokasi"));
  assert.equal(input("Cari lokasi gudang").value, "workshop");
  await press(tab("Material"));
  await type(input("Cari material master"), "");
  await press(select("Status material"));
  await option("Semua");
  assert.equal(query("settings-material-status"), "ALL");
  await press(select("Kategori material"));
  await option("Panel dan kayu");
  const category = SETTINGS_FIXTURE_OVERVIEW.materialCategories.find(
    (item) => item.name === "Panel dan kayu",
  );
  assert(category);
  assert.equal(query("settings-material-category"), category.id);
  await press(tab("Library"));
  await press(tab("Material"));
  assert.equal(query("settings-material-status"), "ALL");
  assert(table("Material master").textContent?.includes("Panel dan kayu"));
  assert.equal(query("unrelated"), "keep");
  assert.equal(window.location.hash, "#catalog");
  await navigateQuery({
    "settings-material-page": "-8",
    "settings-material-pageSize": "999",
    "settings-material-direction": "broken",
  });
  assert(
    host.textContent?.includes("Halaman 1"),
    "Malformed table geometry safely returns to the first page",
  );
  assert.equal(button("Sebelumnya").disabled, true);
  await render(SETTINGS_FIXTURE_PERMISSIONS.filter((key) => key !== "manage:vendors"));
  await press(button("Tambah material"));
  await settle(650);
  const details = [...document.querySelectorAll<HTMLButtonElement>("button")].find((item) =>
    item.textContent?.trim().startsWith("Detail material"),
  );
  assert(details, "The shared material context disclosure exists");
  await press(details);
  await press(select("Vendor default"));
  await settle(450);
  assert(
    !document.body.textContent?.includes("Buat vendor baru"),
    "Material-only management cannot offer a forbidden vendor creation",
  );
  const vendor = SETTINGS_FIXTURE_OVERVIEW.vendors[0];
  assert(vendor);
  await option(vendor.name);
  assert(
    document.body.textContent?.includes(vendor.name),
    "Existing vendor selection remains available",
  );
  await render();
  assert(SETTINGS_FIXTURE_PERMISSIONS.includes("manage:vendors"));
  await press(select("Vendor default"));
  await settle(450);
  assert(
    document.body.textContent?.includes("Buat vendor baru"),
    "Independent vendor management permission enables the existing create handoff",
  );
  assert.equal(writes, 0);
  console.log("Settings catalog query, count and permission regression passed");
} finally {
  await act(async (): Promise<void> => root.unmount());
  await browserWindow.happyDOM.close();
}
