import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";

const browserWindow = new Window({ url: "https://atria.test/settings", width: 1280, height: 960 });
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
const { createRoot } = await import("react-dom/client");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { DesktopUIProvider } = await import("@/components/ui");
const { SettingsDesktopSkeleton } = await import("./settings-desktop-skeleton");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
const cases: readonly { readonly query: string; readonly columns: number }[] = [
  { query: "tab=financial", columns: 4 },
  { query: "tab=catalog", columns: 5 },
  { query: "tab=catalog&section=library", columns: 5 },
  { query: "tab=catalog&section=locations", columns: 2 },
  { query: "tab=organization", columns: 4 },
  { query: "tab=readiness", columns: 0 },
  { query: "tab=readiness&flow=initial-stock", columns: 4 },
];
for (const scenario of cases) {
  await act(async (): Promise<void> => {
    window.history.replaceState({}, "", `/settings?${scenario.query}`);
    root.render(
      <WorkspacePresentationProvider presentation="desktop">
        <DesktopUIProvider responsive>
          <SettingsDesktopSkeleton key={scenario.query} />
        </DesktopUIProvider>
      </WorkspacePresentationProvider>,
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  });
  assert.equal(
    host.querySelectorAll("th").length,
    scenario.columns,
    `Header collection for ${scenario.query}`,
  );
  assert.equal(
    host.querySelectorAll("tbody td").length,
    scenario.columns * 5,
    `Body collection for ${scenario.query}`,
  );
  for (const table of host.querySelectorAll("table"))
    assert.ok(table.closest("[inert]"), "Decorative table is excluded from keyboard focus");
  assert.ok(
    host.querySelector(
      `[role="status"][aria-label="${scenario.query.includes("flow=initial-stock") ? "Memuat saldo awal stok" : "Memuat Pengaturan"}"]`,
    ),
  );
  if (scenario.query.includes("flow=initial-stock")) {
    assert.deepEqual(
      [...host.querySelectorAll("th")].map((cell) => cell.textContent?.trim()),
      ["Pengajuan", "Status", "Item", "Nilai saldo awal"],
    );
    assert(
      !host.textContent?.includes("disetujui"),
      "Loading does not invent a posted or empty outcome",
    );
  }
}
await act(async (): Promise<void> => root.unmount());
await browserWindow.happyDOM.close();
console.log("all settings skeleton tables mounted safely");
