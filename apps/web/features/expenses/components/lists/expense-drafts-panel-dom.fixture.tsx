import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { ExpenseDraftSummary } from "@/app/actions/finance/expense-drafts";
import type { WorkspacePresentation } from "@/lib/navigation/workspace-routes";

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
    bfcacheId: "expense-draft-panel-fixture",
    back: (): void => {},
    forward: (): void => {},
    refresh: (): void => {},
    push: (): void => {},
    replace: (): void => {},
    prefetch: (): void => {},
  }),
}));
type DraftRead = ActionResponse<readonly ExpenseDraftSummary[]>;
const reads: Array<(result: DraftRead) => void> = [];
let readCalls = 0;
let writes = 0;
mock.module("@/app/actions/finance/expense-drafts", () => ({
  listExpenseDrafts: async (): Promise<DraftRead> => {
    readCalls += 1;
    return new Promise<DraftRead>((resolve) => reads.push(resolve));
  },
  discardExpenseDraft: async (): Promise<ActionResponse<never>> => {
    writes += 1;
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Fixture does not discard data." },
    };
  },
}));
const { createRoot } = await import("react-dom/client");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { DesktopUIProvider } = await import("@/components/ui");
const { ExpenseDraftsPanel } = await import("./expense-drafts-panel");
const { ExpenseDraftsReadProvider } = await import("./expense-drafts-read-provider");
const { PermissionsProvider } = await import("@/components/auth/permissions-provider");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
const draft: ExpenseDraftSummary = {
  id: "draft-fixture",
  revision: 1,
  projectId: "project-fixture",
  projectName: "Cipete House",
  itemCount: 2,
  totalAmount: 1_900_000.25,
  hasReceipt: false,
  lastSavedAt: new Date("2026-10-14T02:20:00Z"),
};

async function render(
  presentation: WorkspacePresentation,
  key = "shared",
  options: {
    readonly shown?: boolean;
    readonly generation?: number;
    readonly actor?: string;
    readonly projectId?: string;
  } = {},
): Promise<void> {
  await act(async (): Promise<void> => {
    root.render(
      <WorkspacePresentationProvider presentation={presentation}>
        <DesktopUIProvider responsive>
          <PermissionsProvider
            permissions={["create:cost"]}
            user={{
              id: options.actor ?? "owner",
              sessionId: options.actor ?? "owner",
              name: "Owner",
              image: null,
              dataScope: "GLOBAL",
            }}
          >
            <ExpenseDraftsReadProvider
              key={key}
              generation={options.generation ?? 0}
              projectId={options.projectId}
            >
              {options.shown === false ? null : (
                <ExpenseDraftsPanel projectId={options.projectId} />
              )}
            </ExpenseDraftsReadProvider>
          </PermissionsProvider>
        </DesktopUIProvider>
      </WorkspacePresentationProvider>,
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 35));
  });
}

async function resolveRead(result: DraftRead): Promise<void> {
  if (reads.length === 0) {
    await act(async (): Promise<void> => {
      await new Promise<void>((done) => setTimeout(done, 35));
    });
  }
  const resolve = reads.shift();
  assert.ok(resolve, "An isolated draft read is pending");
  await act(async (): Promise<void> => {
    resolve(result);
    await new Promise<void>((done) => setTimeout(done, 35));
  });
}
function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) =>
      candidate.textContent?.trim().startsWith(label) ||
      candidate.getAttribute("aria-label") === label,
  );
  assert.ok(found, `Button ${label}`);
  return found;
}
async function click(target: HTMLButtonElement): Promise<void> {
  await act(async (): Promise<void> => {
    target.click();
    await new Promise<void>((done) => setTimeout(done, 40));
  });
}

await render("desktop");
assert.ok(host.querySelector('[role="status"][aria-label="Memuat draft pengeluaran"]'));
assert.equal(host.querySelectorAll("button").length, 0);
await resolveRead({
  success: false,
  error: { code: "INTERNAL_SERVER_ERROR", message: "Draft read failed." },
});
assert.ok(host.textContent?.includes("Draft belum dapat dimuat"));
assert.ok(host.textContent?.includes("Draft read failed."));
await click(button("Coba lagi"));
assert.ok(host.querySelector('[role="status"][aria-label="Memuat draft pengeluaran"]'));
await resolveRead({ success: true, data: [draft] });
assert.ok(!host.textContent?.includes("Draft belum dapat dimuat"));
await click(button("1 draft siap dilanjutkan"));
assert.ok(
  host.querySelector('[aria-label="Rp 1.900.000,25"]'),
  "Draft exact amount retains supplied cents",
);
assert.ok(button("Lanjutkan"));
await click(button("Buang draft Cipete House"));
assert.equal(document.querySelectorAll('[role="alertdialog"]').length, 1);
assert.equal(writes, 0, "Opening the discard confirmation never mutates a draft");
await click(button("Batal"));
const continueButton = button("Lanjutkan");
await act(async (): Promise<void> => continueButton.focus());
await render("mobile");
assert.equal(
  button("Lanjutkan"),
  continueButton,
  "Focused desktop control stays mounted through resize",
);
assert.equal(document.activeElement, continueButton);
await render("desktop");
await click(continueButton);
assert.equal(new URL(window.location.href).searchParams.get("expense-draft"), draft.id);
assert.equal(new URL(window.location.href).searchParams.get("new-expense"), "true");
await act(async (): Promise<void> => {
  continueButton.blur();
});
await render("desktop", "empty");
await resolveRead({ success: true, data: [] });
assert.equal(host.textContent, "", "Successful zero drafts leave no fabricated healthy card");
await render("mobile", "mobile-error");
await resolveRead({
  success: false,
  error: { code: "INTERNAL_SERVER_ERROR", message: "Mobile compatibility" },
});
assert.equal(host.textContent, "", "Mobile failure presentation remains compatible");
await render("desktop", "retained", { projectId: draft.projectId });
await resolveRead({ success: true, data: [draft] });
const firstReadCount = readCalls;
await render("desktop", "retained", { shown: false, projectId: draft.projectId });
await render("desktop", "retained", { projectId: draft.projectId });
assert.equal(readCalls, firstReadCount, "A conditional project-tab revisit reuses the loaded read");
assert.equal(host.querySelector('[aria-label="Memuat draft pengeluaran"]'), null);
assert.ok(button("1 draft siap dilanjutkan"));
await render("desktop", "retained", { shown: false, projectId: draft.projectId });
await act(async (): Promise<void> => {
  window.dispatchEvent(new Event("atria:expense-drafts-changed"));
});
assert.equal(readCalls, firstReadCount, "Hidden draft owners invalidate without eager reads");
await render("desktop", "retained", { projectId: draft.projectId });
assert.equal(
  readCalls,
  firstReadCount + 1,
  "Draft changes invalidate a previously cached project read",
);
assert.ok(host.querySelector('[aria-label="Memuat draft pengeluaran"]'));
await resolveRead({ success: true, data: [draft] });
await render("desktop", "retained", { projectId: draft.projectId, generation: 1 });
assert.ok(
  host.querySelector('[aria-label="Memuat draft pengeluaran"]'),
  "Parent source changes immediately hide old current rows",
);
await resolveRead({
  success: false,
  error: { code: "FORBIDDEN", message: "Draft access revoked." },
});
assert.ok(host.textContent?.includes("Draft access revoked."));
assert.ok(!host.textContent?.includes("draft siap dilanjutkan"));
const deniedReadCount = readCalls;
await render("desktop", "retained", { shown: false, projectId: draft.projectId, generation: 1 });
await render("desktop", "retained", { projectId: draft.projectId, generation: 1 });
assert.equal(readCalls, deniedReadCount, "Denied reads stay denied across consumer remount");
assert.ok(host.textContent?.includes("Draft access revoked."));
await render("desktop", "retained", {
  actor: "different-session",
  projectId: draft.projectId,
  generation: 1,
});
assert.equal(
  readCalls,
  deniedReadCount + 1,
  "A different actor/session cannot inherit the denied or successful cache",
);
await resolveRead({ success: true, data: [] });
assert.equal(host.textContent, "");
await render("desktop", "retained", {
  actor: "different-session",
  projectId: "different-project",
  generation: 1,
});
assert.equal(
  readCalls,
  deniedReadCount + 2,
  "A different project cannot reuse another project's draft list",
);
await resolveRead({ success: true, data: [draft] });
assert.equal(host.textContent, "", "Project filtering never exposes the previous project's drafts");
assert.equal(writes, 0);
await act(async (): Promise<void> => root.unmount());
await browserWindow.happyDOM.close();
console.log("Expense draft read states and responsive owner regression passed");
