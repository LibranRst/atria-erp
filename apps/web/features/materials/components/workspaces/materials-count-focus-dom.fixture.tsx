import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { ActionResponse } from "@atria/core/types/action-response";
import type {
  MaterialDesktopActivityData,
  MaterialDesktopActivityInput,
} from "@atria/core/material/material-desktop";
import {
  materialsFixtureCounts,
  materialsFixtureData,
  materialsFixturePermissions,
} from "../../../../.storybook/materials-data.fixture";

const browser = new Window({
  url: "https://atria.test/materials?tab=activity&activity-kind=counts",
  width: 1024,
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
const nextNavigation = await import("next/navigation");
mock.module("next/navigation", (): typeof nextNavigation => ({
  ...nextNavigation,
  usePathname: (): string => "/materials",
  useSearchParams: (): ReturnType<typeof nextNavigation.useSearchParams> =>
    new nextNavigation.ReadonlyURLSearchParams(window.location.search),
  useRouter: (): ReturnType<typeof nextNavigation.useRouter> => ({
    bfcacheId: "material-count-focus",
    back: (): void => {},
    forward: (): void => {},
    refresh: (): void => {},
    push: (href: string): void => window.history.pushState({}, "", href),
    replace: (href: string): void => window.history.replaceState({}, "", href),
    prefetch: (): void => {},
  }),
}));
let writerCalls = 0;
const unavailable = (): ActionResponse<never> => ({
  success: false,
  error: { code: "FORBIDDEN", message: "This focus fixture never calls a live backend." },
});
mock.module("@/lib/api/backend", () => ({
  callBackendAction: async (): Promise<ActionResponse<never>> => {
    writerCalls += 1;
    return unavailable();
  },
  callBackendQuery: async (): Promise<ActionResponse<never>> => unavailable(),
}));
const remoteDraft = materialsFixtureCounts().at(-1);
assert(remoteDraft?.canEdit && remoteDraft.status === "DRAFT");
const data = materialsFixtureData();
assert(
  !data.counts.some((count) => count.id === remoteDraft.id),
  "Draft is outside the initial preview",
);
let activityReads = 0;
mock.module("@/features/materials/hooks/material-desktop-read-client", () => ({
  readMaterialDesktopActivity: async (
    input: MaterialDesktopActivityInput,
  ): Promise<ActionResponse<MaterialDesktopActivityData>> => {
    activityReads += 1;
    return {
      success: true,
      data: {
        kind: "counts",
        rows: [remoteDraft],
        total: 1,
        page: input.page,
        pageSize: input.pageSize,
        updatedAt: new Date("2026-10-16T05:00:00Z"),
      },
    };
  },
}));
const css = document.createElement("style");
css.textContent =
  ".hidden{display:none}@media(min-width:1280px){.xl\\:block{display:block}.xl\\:hidden{display:none}}";
document.head.append(css);
const { createRoot } = await import("react-dom/client");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { PermissionsProvider } = await import("@/components/auth/permissions-provider");
const { DesktopUIProvider } = await import("@/components/ui");
const { MaterialsControlCenter } = await import("./materials-control-center");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
let generation = 0;
async function settle(duration = 30): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, duration));
  });
}
async function render(width: number, reset = false): Promise<void> {
  if (reset) generation += 1;
  await act(async (): Promise<void> => {
    browser.happyDOM.setWindowSize({ width, height: 976 });
    window.dispatchEvent(new Event("resize"));
    root.render(
      <WorkspacePresentationProvider presentation="desktop">
        <DesktopUIProvider responsive>
          <PermissionsProvider
            permissions={materialsFixturePermissions("complete")}
            user={{
              id: "count-author",
              sessionId: "count-session",
              roleId: "owner",
              dataScope: "GLOBAL",
              name: "Karin Putri",
              image: null,
            }}
          >
            <MaterialsControlCenter key={generation} data={data} />
          </PermissionsProvider>
        </DesktopUIProvider>
      </WorkspacePresentationProvider>,
    );
  });
  await settle();
}
function visible(element: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement)
    if (
      current.hasAttribute("hidden") ||
      current.hasAttribute("inert") ||
      current.getAttribute("aria-hidden") === "true" ||
      getComputedStyle(current).display === "none"
    )
      return false;
  return true;
}
function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) =>
      visible(candidate) &&
      (candidate.textContent?.trim() === label || candidate.getAttribute("aria-label") === label),
  );
  assert(found, `Visible ${label} button exists`);
  return found;
}
async function press(label: string): Promise<void> {
  await act(async (): Promise<void> => {
    const target = button(label);
    target.focus();
    target.click();
  });
  await settle();
}
try {
  for (const [fromWidth, toWidth] of [
    [1024, 1024],
    [1024, 1440],
    [1440, 1024],
  ] as const) {
    await render(fromWidth, true);
    const row = [...host.querySelectorAll<HTMLElement>("tbody tr")].find(
      (candidate) => visible(candidate) && candidate.textContent?.includes(remoteDraft.countNumber),
    );
    assert(row, "Full desktop read exposes the authorized out-of-preview draft");
    assert(activityReads > 0, "The actual activity reader supplies the remote draft");
    await act(async (): Promise<void> => {
      row.focus();
      row.click();
    });
    await settle();
    const invoker = button("Lanjutkan draft");
    await press("Lanjutkan draft");
    assert(
      !invoker.isConnected,
      "Local draft adoption invalidates and removes the original context invoker",
    );
    assert(
      window.location.search.includes("action=COUNT"),
      "The actual owner opens its count workflow",
    );
    await render(toWidth);
    await press("Tutup");
    await press("Lanjut Mengisi");
    assert(
      document.activeElement instanceof HTMLElement &&
        document.activeElement.closest('[role="dialog"]'),
      "Cancel keeps focus inside the existing sheet owner",
    );
    await press("Tutup");
    await press("Buang Perubahan");
    await settle(450);
    assert(
      !document.querySelector('[role="dialog"], [role="alertdialog"]'),
      "Discard closes the sheet and confirmation",
    );
    const focused = document.activeElement;
    assert.ok(
      focused instanceof HTMLElement &&
        focused !== document.body &&
        visible(focused) &&
        focused.closest('[aria-label="Aktivitas material desktop"]'),
      "Count dismissal restores visible logical activity focus after its original pane is gone",
    );
    assert.equal(writerCalls, 0, "Opening, canceling, resizing and discarding invoke no writer");
  }
  await act(async (): Promise<void> => {
    window.history.replaceState({}, "", "/materials?tab=inventory");
  });
  await render(1024, true);
  const warehouseTrigger = button("Gudang");
  await press("Gudang");
  const countMenuItem = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    (item) => visible(item) && item.textContent?.trim() === "Stock opname",
  );
  assert(countMenuItem, "The existing warehouse menu exposes the count command");
  await act(async (): Promise<void> => {
    countMenuItem.focus();
    countMenuItem.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
    countMenuItem.dispatchEvent(
      new KeyboardEvent("keyup", { key: "Enter", bubbles: true, cancelable: true }),
    );
  });
  await settle(650);
  assert(window.location.search.includes("action=COUNT"), "The toolbar opens a new count");
  await press("Tutup");
  await settle(750);
  assert(
    !window.location.search.includes("action=COUNT"),
    "Closing a new count removes its action URL",
  );
  assert(
    !document.querySelector('[role="dialog"], [role="alertdialog"]'),
    `The new count sheet is closed; dialog=${document.querySelector('[role="dialog"]')?.textContent?.slice(0, 100) ?? ""}`,
  );
  assert.ok(
    document.activeElement === warehouseTrigger,
    `A hidden Activity target falls back to the visible original toolbar opener; current=${document.activeElement?.tagName}:${document.activeElement?.getAttribute("aria-label") ?? ""}:${document.activeElement?.textContent?.trim().slice(0, 60) ?? ""}`,
  );
  assert.equal(writerCalls, 0, "Toolbar open and close invoke no writer");
  console.log("Actual material count dismissal restores stable activity focus without writes");
} finally {
  await act(async (): Promise<void> => root.unmount());
  await browser.happyDOM.close();
}
