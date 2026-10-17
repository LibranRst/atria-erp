import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { WorkspacePresentation } from "@/lib/navigation/workspace-routes";

const browserWindow = new Window({ url: "https://atria.test/approvals", width: 1280, height: 960 });
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
  usePathname: (): string => "/approvals",
  useRouter: (): ReturnType<typeof nextNavigation.useRouter> => ({
    bfcacheId: "approvals-skeleton-fixture",
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
const { default: ApprovalsLoading } = await import("@/app/approvals/loading");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
for (const scenario of [
  { name: "desktop", presentation: "desktop", nativeBridge: false },
  { name: "mobile", presentation: "mobile", nativeBridge: false },
  { name: "native fallback", presentation: "mobile", nativeBridge: true },
] satisfies readonly {
  readonly name: string;
  readonly presentation: WorkspacePresentation;
  readonly nativeBridge: boolean;
}[]) {
  await act(async (): Promise<void> => {
    root.render(
      <WorkspacePresentationProvider
        presentation={scenario.presentation}
        nativeBridge={scenario.nativeBridge}
      >
        <DesktopUIProvider responsive>
          <ApprovalsLoading key={scenario.name} />
        </DesktopUIProvider>
      </WorkspacePresentationProvider>,
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  });
  assert.ok(host.querySelector('[role="status"][aria-label="Memuat persetujuan"]'));
  assert.ok(host.textContent?.includes("Antrean persetujuan sedang disiapkan."));
  if (scenario.presentation === "desktop") {
    assert.deepEqual(
      Array.from(host.querySelectorAll("th"), (cell) => cell.textContent),
      ["Pengajuan", "Jenis", "Pengaju / vendor", "Nominal", "Masuk antrean", "Prioritas"],
    );
    assert.equal(host.querySelectorAll("tbody tr").length, 10);
    assert.equal(host.querySelectorAll("tbody td").length, 60);
    assert.ok(host.querySelector("table")?.closest('[inert][aria-hidden="true"]'));
    assert.equal(host.querySelectorAll("button").length, 0);
    assert.equal(host.querySelectorAll("input").length, 0);
  } else {
    assert.equal(host.querySelectorAll("table").length, 0);
    assert.ok(host.querySelector(".rounded-owner"));
  }
}
await act(async (): Promise<void> => root.unmount());
await browserWindow.happyDOM.close();
console.log("desktop, mobile and native approval skeletons mounted safely");
