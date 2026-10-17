import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
const browserWindow = new Window({
  url: "https://atria.test/reconciliation",
  width: 1024,
  height: 976,
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
  usePathname: (): string => "/reconciliation",
  useRouter: (): ReturnType<typeof nextNavigation.useRouter> => ({
    bfcacheId: "list-detail-focus",
    back: (): void => {},
    forward: (): void => {},
    refresh: (): void => {},
    push: (): void => {},
    replace: (): void => {},
    prefetch: (): void => {},
  }),
}));

const fixture = await import("../../../.storybook/reconciliation-actions.fixture");
const { reconciliationFixtureData, RECONCILIATION_FIXTURE_PERMISSIONS } =
  await import("../../../.storybook/reconciliation-data.fixture");
let writes = 0;
const forbiddenWrite = async (): Promise<never> => {
  writes += 1;
  throw new Error("Matching focus QA does not mutate data");
};
mock.module("../hooks/reconciliation-read-client", () => ({
  readReconciliationDesktop: fixture.readReconciliationDesktop,
  readReconciliationMatchContext: fixture.readReconciliationMatchContext,
}));
mock.module("@/app/actions/finance/reconciliation-workspace", () => ({
  recordBankStatementRow: forbiddenWrite,
  importParsedBankStatementRows: forbiddenWrite,
}));
mock.module("@/app/actions/finance/reconcile-cash-transaction", () => ({
  reconcileCashTransaction: forbiddenWrite,
  markReconciliationException: forbiddenWrite,
  clearReconciliationException: forbiddenWrite,
}));
mock.module("@/app/actions/finance/analyze-bank-statement", () => ({
  analyzeBankStatement: forbiddenWrite,
}));
const { createRoot } = await import("react-dom/client");
const { DesktopUIProvider } = await import("@/components/ui");
const { PermissionsProvider } = await import("@/components/auth/permissions-provider");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { useWorkspaceViewportPresentation } = await import("@/lib/navigation/workspace-viewport");
const { ReconciliationWorkspace } = await import("./reconciliation-workspace");
const data = reconciliationFixtureData();
const visibility = document.createElement("style");
const visibilityRules =
  ".hidden{display:none}@media(min-width:1280px){.xl\\:block{display:block}.xl\\:hidden{display:none}}";
visibility.textContent = visibilityRules;
document.head.append(visibility);
function Owner(): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation();
  return (
    <WorkspacePresentationProvider presentation={presentation}>
      <DesktopUIProvider responsive>
        <PermissionsProvider
          permissions={RECONCILIATION_FIXTURE_PERMISSIONS}
          user={{ id: "owner", name: "Owner", image: null, dataScope: "GLOBAL" }}
        >
          <ReconciliationWorkspace initialData={data} />
        </PermissionsProvider>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
async function settle(ms = 40): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  });
}
async function width(value: number): Promise<void> {
  await act(async (): Promise<void> => {
    browserWindow.happyDOM.setWindowSize({ width: value, height: 976 });
    visibility.textContent = visibilityRules;
    window.dispatchEvent(new Event("resize"));
  });
  await settle();
}
async function click(node: HTMLElement): Promise<void> {
  await act(async (): Promise<void> => {
    node.focus();
    node.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    node.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    node.click();
  });
  await settle();
}
function button(label: string, owner: ParentNode = document): HTMLButtonElement {
  const node = [...owner.querySelectorAll<HTMLButtonElement>("button")].find(
    (node) => node.textContent?.trim() === label,
  );
  assert(node, `Button ${label} exists`);
  return node;
}
function matching(): HTMLElement {
  const node = document.querySelector<HTMLElement>(
    '[role="dialog"][aria-label="Cocokkan transaksi"]',
  );
  assert(node, "Actual matching workflow opens");
  return node;
}
function closeMatching(): HTMLButtonElement {
  const node = matching().querySelector<HTMLButtonElement>('button[aria-label="Tutup"]');
  assert(node);
  return node;
}
try {
  for (const [startWidth, endWidth] of [
    [1024, 1024],
    [1024, 1440],
    [1440, 1024],
  ] as const) {
    await width(startWidth);
    await act(async (): Promise<void> => root.render(<Owner key={`${startWidth}-${endWidth}`} />));
    await settle(80);
    const row = host.querySelector<HTMLElement>(
      'table[aria-label="Mutasi bank belum cocok"] tbody tr',
    );
    assert(row);
    await act(async (): Promise<void> => {
      row.focus();
      row.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }),
      );
      row.dispatchEvent(new KeyboardEvent("keyup", { key: " ", bubbles: true, cancelable: true }));
    });
    await settle(60);
    await click(button("Tinjau pasangan", host));
    await settle(80);
    const opener = closeMatching();
    await click(opener);
    await settle(60);
    await click(button("Batal"));
    await settle(650);
    assert.ok(
      document.activeElement === opener,
      "Cancelling discard restores the existing matching sheet close control",
    );
    await width(endWidth);
    await click(closeMatching());
    await settle(60);
    await click(button("Buang perubahan"));
    await settle(700);
    assert.equal(document.querySelectorAll('[role="dialog"], [role="alertdialog"]').length, 0);
    if (endWidth < 1280)
      assert.ok(
        document.activeElement === button("Kembali ke daftar", host),
        "Matching discard returns to stable narrow Back after the candidate opener unmounts",
      );
    else
      assert.ok(
        document.activeElement === host.querySelector('[aria-label="Panel konteks rekonsiliasi"]'),
        "Matching discard returns to the labeled wide context pane after resize",
      );
    assert.equal(writes, 0, "Selection and dismissal never invoke finance writers");
  }
  console.log("Actual reconciliation matching return focus regressions passed");
} finally {
  await act(async (): Promise<void> => root.unmount());
  await browserWindow.happyDOM.close();
}
