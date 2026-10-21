import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import {
  PROJECTS_FIXTURE_PROJECTS,
  projectsFixtureData,
  projectsFixturePermissions,
  type ProjectsFixtureScenario,
} from "../../../../../.storybook/projects-data.fixture";
import * as fixtureActions from "../../../../../.storybook/projects-actions.fixture";

const browserWindow = new Window({ url: "https://atria.test/projects", width: 1440, height: 976 });
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
  usePathname: (): string => "/projects",
  useSearchParams: (): ReturnType<typeof nextNavigation.useSearchParams> =>
    new nextNavigation.ReadonlyURLSearchParams(window.location.search),
  useRouter: (): ReturnType<typeof nextNavigation.useRouter> => ({
    bfcacheId: "project-workspace-fixture",
    back: (): void => {},
    forward: (): void => {},
    refresh: (): void => {},
    push: (href: string): void => {
      window.history.pushState({}, "", href);
    },
    replace: (href: string): void => {
      window.history.replaceState({}, "", href);
    },
    prefetch: (): void => {},
  }),
}));
mock.module("@/app/actions/project/crud", () => fixtureActions);
mock.module("@/lib/media/upload-to-imagekit", () => ({
  uploadToImageKit: async (): Promise<never> => {
    throw new Error("Uploads disabled in this test.");
  },
}));
const visibility = document.createElement("style");
const visibilityRules =
  ".hidden{display:none}@media (min-width: 1280px){.xl\\:block{display:block}.xl\\:hidden{display:none}}";
visibility.textContent = visibilityRules;
document.head.append(visibility);
const { createRoot } = await import("react-dom/client");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { useWorkspaceViewportPresentation } = await import("@/lib/navigation/workspace-viewport");
const { DesktopUIProvider } = await import("@/components/ui");
const { PermissionsProvider } = await import("@/components/auth/permissions-provider");
const { ProjectListClient } = await import("./project-list-client");
const { GlobalProjectDrawer } = await import("../drawers/global-project-drawer");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
let incoming = PROJECTS_FIXTURE_PROJECTS;
function Fixture({ scenario }: { readonly scenario: ProjectsFixtureScenario }): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation();
  return (
    <WorkspacePresentationProvider presentation={presentation}>
      <DesktopUIProvider responsive>
        <PermissionsProvider
          permissions={projectsFixturePermissions(scenario)}
          user={{ name: "Karin Putri", image: null, dataScope: "GLOBAL" }}
        >
          <ProjectListClient {...projectsFixtureData(scenario)} projects={incoming} />
          <GlobalProjectDrawer />
        </PermissionsProvider>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
async function settle(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 40));
  });
}
async function render(scenario: ProjectsFixtureScenario, key: string = scenario): Promise<void> {
  await act(async (): Promise<void> => {
    root.render(<Fixture key={key} scenario={scenario} />);
  });
  await settle();
}
async function width(next: number): Promise<void> {
  await act(async (): Promise<void> => {
    browserWindow.happyDOM.setWindowSize({ width: next, height: 976 });
    visibility.textContent = visibilityRules;
    window.dispatchEvent(new Event("resize"));
  });
  await settle();
}
function visible(element: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement)
    if (current.hasAttribute("hidden") || getComputedStyle(current).display === "none")
      return false;
  return true;
}
function button(label: string, within: ParentNode = document): HTMLButtonElement {
  const result = [...within.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => visible(item) && item.textContent?.trim() === label,
  );
  assert.ok(result, `Button ${label} exists`);
  return result;
}
async function press(element: HTMLElement): Promise<void> {
  await act(async (): Promise<void> => {
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    element.click();
  });
  await settle();
}
async function key(element: HTMLElement, value: "Enter" | " "): Promise<void> {
  await act(async (): Promise<void> => {
    element.focus();
    element.dispatchEvent(
      new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true }),
    );
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keyup", { key: value, bubbles: true, cancelable: true }),
    );
  });
  await settle();
}
function focusedElement(): Element | null {
  return document.activeElement;
}
function table(): HTMLTableElement {
  const result = [
    ...host.querySelectorAll<HTMLTableElement>('table[aria-label="Perbandingan budget proyek"]'),
  ].find(visible);
  assert.ok(result, "Visible portfolio table exists");
  return result;
}
function context(): HTMLElement {
  const result = host.querySelector<HTMLElement>('section[aria-label="Konteks proyek"]');
  assert.ok(result);
  return result;
}
function nameInput(): HTMLInputElement {
  const result = document.querySelector<HTMLInputElement>(
    'input[placeholder="Misal: Menteng Villa Penthouse Fit-Out"]',
  );
  assert.ok(result);
  return result;
}
async function type(input: HTMLInputElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  assert.ok(setter);
  await act(async (): Promise<void> => {
    input.focus();
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
}
async function query(params: Readonly<Record<string, string>> = {}): Promise<void> {
  await act(async (): Promise<void> => {
    window.history.replaceState({}, "", `/projects?${new URLSearchParams(params).toString()}`);
  });
  await settle();
}
function hasButton(label: string, within: ParentNode = document): boolean {
  return [...within.querySelectorAll<HTMLButtonElement>("button")].some(
    (item) => visible(item) && item.textContent?.trim() === label,
  );
}

try {
  await render("complete");
  assert.equal(table().querySelectorAll("tbody tr").length, 10);
  assert.equal(table().querySelectorAll('tbody tr[aria-selected="true"]').length, 0);
  assert.equal(host.querySelector('[aria-label="Konteks proyek"]'), null);
  await press(table().querySelector<HTMLElement>("tbody tr")!);
  assert.equal(table().querySelectorAll('tbody tr[aria-selected="true"]').length, 1);
  assert.equal(visible(context()), true);
  await press(table().querySelector<HTMLElement>("tbody tr")!);
  assert.equal(table().querySelectorAll('tbody tr[aria-selected="true"]').length, 0);
  assert.equal(host.querySelector('[aria-label="Konteks proyek"]'), null);
  const firstPage = table().textContent;
  await press(button("Berikutnya"));
  assert.notEqual(table().textContent, firstPage, "Pagination visits the full collection");
  assert.match(host.textContent ?? "", /36 hasil/);
  const sort = table().querySelector<HTMLElement>('th[data-key="value"]');
  assert.ok(sort);
  await press(sort);
  if (sort.getAttribute("aria-sort") !== "descending") await press(sort);
  const largest = [...incoming].sort((a, b) => b.totalContractValue - a.totalContractValue)[0];
  assert.ok(largest);
  assert.match(
    table().querySelector("tbody tr")?.textContent ?? "",
    new RegExp(largest.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
  assert.match(host.textContent ?? "", /Halaman 1 dari 4/);
  await press(button("Berikutnya"));
  const search = document.querySelector<HTMLInputElement>(
    'input[aria-label="Cari portfolio proyek"]',
  );
  assert.ok(search);
  await type(search, "Karin");
  assert.equal(
    new URLSearchParams(window.location.search).get("portfolio-page"),
    "1",
    "A real search change resets pagination in the URL",
  );
  assert.equal(new URLSearchParams(window.location.search).get("portfolio-search"), "Karin");
  assert.match(host.textContent ?? "", /12 hasil/);
  assert.equal(
    [...table().querySelectorAll("tbody tr")].every((row) =>
      row.textContent?.includes("Karin Putri"),
    ),
    true,
  );
  await type(search, "");
  await width(1093);
  assert.equal(table().querySelectorAll('tbody tr[aria-selected="true"]').length, 0);
  const narrowRow = table().querySelector<HTMLElement>("tbody tr");
  assert.ok(narrowRow);
  await key(narrowRow, "Enter");
  assert.equal(visible(context()), true, "The first row opens on the first press");
  assert.ok(
    focusedElement() === button("Kembali ke daftar", context()),
    "Narrow keyboard selection focuses visible detail",
  );
  await press(button("Kembali ke daftar", context()));
  assert.ok(focusedElement() === narrowRow, "Back restores the invoking portfolio row");
  assert.equal(table().querySelectorAll('tbody tr[aria-selected="true"]').length, 0);
  await key(narrowRow, " ");
  assert.ok(
    focusedElement() === button("Kembali ke daftar", context()),
    "Space follows the same list/detail focus contract",
  );
  await press(button("Kembali ke daftar", context()));
  await width(1440);
  await key(narrowRow, "Enter");
  await act(async (): Promise<void> => narrowRow.focus());
  await width(1024);
  assert.ok(
    focusedElement() === button("Kembali ke daftar", context()),
    "Shrinking a focused selected row repairs hidden focus",
  );
  await press(button("Kembali ke daftar", context()));
  assert.ok(focusedElement() === narrowRow);
  await width(1440);
  await render("read-only");
  assert.equal(hasButton("Tambah proyek"), false);
  await press(table().querySelector<HTMLElement>("tbody tr")!);
  assert.equal(hasButton("Ubah proyek", context()), false);
  await query({ "portfolio-status": "CANCELLED" });
  await render("complete", "operator-closed");
  assert.match(host.textContent ?? "", /4 hasil/);
  await press(table().querySelector<HTMLElement>("tbody tr")!);
  assert.equal(
    hasButton("Ubah proyek", context()),
    false,
    "Cancelled projects never expose an edit action",
  );
  await query({ "portfolio-search": "Bintaro" });
  assert.match(table().textContent ?? "", /Belum budget/);
  assert.equal(
    table().querySelectorAll('span[aria-label="Budget belum disiapkan"]').length,
    12,
    "Missing budgets are unavailable, not healthy zero values",
  );
  await query({
    "portfolio-search": "Puri Apartment",
    "portfolio-sort": "value",
    "portfolio-direction": "ascending",
  });
  const zeroRow = table().querySelector("tbody tr");
  assert.ok(zeroRow);
  assert.equal(
    zeroRow.querySelectorAll('span[aria-label="Budget belum disiapkan"]').length,
    0,
    "Approved zero budget retains valid amounts",
  );
  await query();
  await render("complete", "create-draft");
  await press(button("Tambah proyek"));
  const create = nameInput();
  await type(create, "Draft proyek baru tetap utuh");
  await width(390);
  assert.equal(nameInput(), create, "Global create owner survives desktop to mobile");
  assert.equal(create.value, "Draft proyek baru tetap utuh");
  incoming = [];
  await render("complete", "create-draft");
  assert.equal(nameInput(), create, "A create draft survives incoming source changes");
  await width(1440);
  await query();
  await act(async (): Promise<void> => {
    root.render(null);
  });
  await settle();
  window.localStorage.removeItem("atria:project-form:new");
  incoming = PROJECTS_FIXTURE_PROJECTS;
  await render("complete", "edit-draft");
  await press(table().querySelector<HTMLElement>("tbody tr")!);
  await press(button("Ubah proyek", context()));
  const edit = nameInput();
  await type(edit, "Draft perubahan proyek tetap utuh");
  incoming = [];
  await render("complete", "edit-draft");
  assert.equal(nameInput(), edit, "Source refresh does not replace the existing editor");
  await width(390);
  assert.equal(nameInput(), edit, "Responsive switch preserves the exact focused editor");
  assert.equal(edit.value, "Draft perubahan proyek tetap utuh");
  assert.equal(document.activeElement, edit, "Responsive changes preserve keyboard focus");
  await width(1440);
  assert.equal(nameInput(), edit);
  await act(async (): Promise<void> => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  await settle();
  await press(button("Buang Perubahan"));
  await settle();
  assert.match(
    table().textContent ?? "",
    /Belum ada proyek/,
    "Deferred incoming collection applies after the protected editor closes",
  );
  console.log("Project workspace integration regression passed");
} finally {
  await act(async (): Promise<void> => root.unmount());
  await browserWindow.happyDOM.abort();
  browserWindow.close();
}
