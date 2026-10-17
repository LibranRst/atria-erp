import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { WorkspacePresentation } from "@/lib/navigation/workspace-routes";
import type { ExpensesSkeletonVariant } from "./expenses-desktop-skeleton";

const browserWindow = new Window({ url: "https://atria.test/expenses", width: 1280, height: 960 });
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
  usePathname: (): string => "/expenses",
  useRouter: (): ReturnType<typeof nextNavigation.useRouter> => ({
    bfcacheId: "expenses-skeleton-fixture",
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
const { ExpensesDesktopSkeleton } = await import("./expenses-desktop-skeleton");
const { default: ExpensesLoading } = await import("@/app/expenses/loading");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
const cases: readonly {
  readonly name: string;
  readonly presentation: WorkspacePresentation;
  readonly query: string;
  readonly variant?: ExpensesSkeletonVariant;
  readonly route?: boolean;
  readonly width?: number;
  readonly showDetail?: boolean;
  readonly firstColumn: string | null;
}[] = [
  {
    name: "explicit claims",
    width: 1024,
    presentation: "desktop",
    query: "",
    variant: "claims",
    firstColumn: "Pengeluaran",
  },
  {
    name: "explicit bills",
    presentation: "desktop",
    query: "",
    variant: "bills",
    firstColumn: "Tagihan",
  },
  {
    name: "explicit payments",
    width: 1440,
    presentation: "desktop",
    query: "",
    variant: "payments",
    firstColumn: "Pembayaran",
  },
  {
    name: "canonical route payments",
    presentation: "desktop",
    query: "view=vendor-bills&project-inbox-expenses-vendor-view=PAYMENTS",
    route: true,
    firstColumn: "Pembayaran",
  },
  {
    name: "known context narrow",
    presentation: "desktop",
    query: "",
    variant: "claims",
    showDetail: true,
    width: 1024,
    firstColumn: "Pengeluaran",
  },
  {
    name: "known context wide",
    presentation: "desktop",
    query: "",
    variant: "payments",
    showDetail: true,
    width: 1280,
    firstColumn: "Pembayaran",
  },
  {
    name: "canonical route claims",
    presentation: "desktop",
    query: "",
    route: true,
    firstColumn: "Pengeluaran",
  },
  {
    name: "canonical route bills",
    presentation: "desktop",
    query: "view=vendor-bills",
    route: true,
    firstColumn: "Tagihan",
  },
  { name: "mobile incumbent", presentation: "mobile", query: "", route: true, firstColumn: null },
  {
    name: "native fallback",
    presentation: "mobile",
    query: "surface=mobile&view=vendor-bills",
    route: true,
    firstColumn: null,
  },
];
for (const scenario of cases) {
  await act(async (): Promise<void> => {
    browserWindow.happyDOM.setWindowSize({ width: scenario.width ?? 1280, height: 960 });
    window.history.replaceState({}, "", `/expenses?${scenario.query}`);
    root.render(
      <WorkspacePresentationProvider presentation={scenario.presentation}>
        <DesktopUIProvider responsive>
          {scenario.route ? (
            <ExpensesLoading key={scenario.name} />
          ) : (
            <ExpensesDesktopSkeleton
              key={scenario.name}
              variant={scenario.variant}
              showDetail={scenario.showDetail}
            />
          )}
        </DesktopUIProvider>
      </WorkspacePresentationProvider>,
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  });
  if (scenario.firstColumn) {
    assert.equal(host.querySelectorAll("th").length, 5, `Header collection for ${scenario.name}`);
    assert.equal(
      host.querySelectorAll("tbody tr").length,
      10,
      `Full first page for ${scenario.name}`,
    );
    assert.equal(
      host.querySelectorAll("tbody td").length,
      50,
      `Body collection for ${scenario.name}`,
    );
    assert.equal(host.querySelector("th")?.textContent, scenario.firstColumn);
    assert.equal(
      Boolean(host.querySelector("[data-expenses-skeleton-detail]")),
      Boolean(scenario.showDetail),
      "initial skeleton never reserves unknown detail context",
    );
    assert.equal(
      Boolean(host.querySelector('[class*="xl:grid-cols-"]')),
      Boolean(scenario.showDetail),
      "only a known selected context narrows the table skeleton",
    );
    for (const table of host.querySelectorAll("table")) {
      assert.ok(
        table.closest('[inert][aria-hidden="true"]'),
        "Decorative table is excluded from focus and accessibility",
      );
    }
    assert.ok(host.querySelector('[role="status"][aria-label="Memuat Pengeluaran"]'));
    assert.equal(
      host.querySelectorAll("button").length,
      0,
      "No skeleton controls invite interaction",
    );
  } else {
    assert.equal(
      host.querySelectorAll("table").length,
      0,
      "Mobile retains its original grouped-row skeleton",
    );
    assert.ok(host.querySelector('[role="status"][aria-label="Memuat Kas dan Tagihan"]'));
  }
}
await act(async (): Promise<void> => root.unmount());
await browserWindow.happyDOM.close();
console.log("Expenses skeleton responsive structure passed");
