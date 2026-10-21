import { FixtureFooterActions } from "./proposal-footer.fixture";
import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act, type ReactNode } from "react";
import type {
  ProjectStockProposal,
  ProjectStockView,
  ProjectStockReceipt,
} from "@atria/core/ai/project-stock";
import type { ActionResponse } from "@atria/core/types/action-response";
const browserWindow = new Window({ url: "https://atria.test/ai", width: 1280 });
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLInputElement",
  "Element",
  "Node",
  "Event",
  "MouseEvent",
  "PointerEvent",
  "KeyboardEvent",
  "SVGElement",
  "MutationObserver",
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
const id = "10000000-0000-4000-8000-000000000001";
const ids = Array.from(
  { length: 7 },
  (_, i) => `20000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
);
let proposal: ProjectStockProposal = {
  kind: "PROJECT_STOCK",
  projectId: id,
  projectName: "Proyek uji stok",
  action: "USE",
  expectedContext: "a".repeat(64),
  input: {
    projectId: id,
    action: "USE",
    rows: ids.map((materialId) => ({
      materialId,
      inventoryLocationId: id,
      quantity: 2,
      projectRapItemId: null,
      projectCostId: null,
      vendorBillId: null,
      note: "Kebutuhan proyek",
    })),
  },
  rows: ids.map((rowId, i) => ({
    id: rowId,
    materialName: `Panel ${i + 1}`,
    locationName: "Gudang utama",
    unit: "lembar",
    quantity: 2,
    unitCost: 5,
    costOverride: false,
    note: "Kebutuhan proyek",
    sourceLabel: "RAP Dapur",
    before: { current: 100, reserved: 20, available: 80, ownReserved: 4, netUsed: 3 },
    after: { current: 98, reserved: 18, available: 80, ownReserved: 2, netUsed: 5 },
  })),
  budget: {
    allocated: 987654321,
    actualBefore: 0,
    actualAfter: 70,
    pending: 0,
    remainingAfter: 987654251,
    costDelta: 70,
    overAllocation: 0,
    rapTotal: 6000,
  },
  costEffect: "DEBIT",
};
let viewStatus: ProjectStockView["status"] = "READY",
  desktop = true,
  budgetAllowed = true,
  readError: string | null = null;
const calls: unknown[] = [];
let resolveSave: ((result: ActionResponse<ProjectStockReceipt>) => void) | null = null;
mock.module("@/app/actions/ai/project-stock", () => ({
  getAiProjectStockProposal: async (): Promise<ActionResponse<ProjectStockView>> =>
    readError
      ? { success: false, error: { code: "FORBIDDEN", message: readError } }
      : { success: true, data: { proposal, status: viewStatus, resultId: null } },
  confirmAiProjectStockProposal: (input: unknown): Promise<ActionResponse<ProjectStockReceipt>> => {
    calls.push(input);
    return new Promise((resolve) => {
      resolveSave = resolve;
    });
  },
}));
mock.module("@/components/auth/permissions-provider", () => ({
  useCan:
    () =>
    (permission: string): boolean =>
      permission !== "view:budget" || budgetAllowed,
}));
mock.module("@/lib/navigation/workspace-presentation", () => ({
  useWorkspacePresentation: (): "desktop" | "mobile" => (desktop ? "desktop" : "mobile"),
}));
type Children = { readonly children?: ReactNode };
function Button({
  children,
  onClick,
  disabled,
  pending,
}: Children & {
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  readonly pending?: boolean;
}): React.JSX.Element {
  return (
    <button disabled={disabled || pending} onClick={onClick}>
      {children}
    </button>
  );
}
mock.module("@/components/ui", () => ({
  SheetFooterActions: FixtureFooterActions,
  Button,
  ButtonLink: ({ children, href }: Children & { readonly href: string }): React.JSX.Element => (
    <a href={href}>{children}</a>
  ),
  AppIcon: (): null => null,
  MoneyValue: ({ amount }: { readonly amount: number }): React.JSX.Element => (
    <span data-money={amount}>{amount}</span>
  ),
  InlineStateRow: ({
    title,
    description,
    action,
  }: {
    readonly title: string;
    readonly description: string;
    readonly action?: React.ReactNode;
  }): React.JSX.Element => (
    <div>
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  ),
  GroupedSurface: ({ children }: Children): React.JSX.Element => <section>{children}</section>,
  FactRow: ({
    label,
    value,
  }: {
    readonly label: string;
    readonly value: ReactNode;
  }): React.JSX.Element => (
    <p>
      {label}:{value}
    </p>
  ),
  ReviewCollection: ({ children }: Children): React.JSX.Element => <ul>{children}</ul>,
  ReviewItem: ({
    title,
    children,
    summary,
    primaryValue,
  }: Children & {
    readonly title: ReactNode;
    readonly summary?: ReactNode;
    readonly primaryValue?: ReactNode;
  }): React.JSX.Element => (
    <li>
      {title}
      {summary}
      {primaryValue}
      {children}
    </li>
  ),
  FormDisclosure: ({
    title,
    children,
  }: Children & { readonly title: string }): React.JSX.Element => (
    <details>
      <summary>{title}</summary>
      {children}
    </details>
  ),
  FormSheet: ({
    open,
    children,
    footer,
    desktopAsideSummary,
  }: Children & {
    readonly open: boolean;
    readonly footer: ReactNode;
    readonly desktopAsideSummary?: ReactNode;
  }): React.JSX.Element | null =>
    open ? (
      <section data-sheet>
        <div data-review-content>{children}</div>
        {desktop && desktopAsideSummary}
        <div data-review-actions>{footer}</div>
      </section>
    ) : null,
  ConfirmationDialog: ({
    open,
    title,
    children,
    onConfirm,
    onClose,
    confirmLabel,
    pending,
  }: Children & {
    readonly open: boolean;
    readonly title: string;
    readonly onConfirm: () => void;
    readonly onClose: () => void;
    readonly confirmLabel: string;
    readonly pending?: boolean;
  }): React.JSX.Element | null =>
    open ? (
      <section role="alertdialog" aria-label={title}>
        {children}
        <Button disabled={pending} onClick={onClose}>
          Kembali
        </Button>
        <Button disabled={pending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </section>
    ) : null,
}));
mock.module("./proposal-card-shell", () => ({
  ProposalCardShell: ({
    children,
    footer,
  }: Children & { readonly footer: ReactNode }): React.JSX.Element => (
    <article>
      {children}
      {footer}
    </article>
  ),
  ProposalDiffRow: ({
    label,
    before,
    after,
  }: {
    readonly label: string;
    readonly before: ReactNode;
    readonly after: ReactNode;
  }): React.JSX.Element => (
    <p>
      {label}:{before}→{after}
    </p>
  ),
}));
const { createRoot } = await import("react-dom/client"),
  { ProjectStockProposalCard } = await import("./project-stock-proposal-card");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
async function render(key = "stock", streaming = false): Promise<void> {
  await act(async () =>
    root.render(
      <ProjectStockProposalCard
        key={key}
        proposal={proposal}
        conversationId={id}
        toolCallId={key}
        isStreaming={streaming}
        isBusy={false}
        alreadyConfirmed={false}
        onFollowUp={() => undefined}
      />,
    ),
  );
}
function button(text: string, scope: Element = host): HTMLButtonElement {
  const value = [...scope.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.trim() === text,
  );
  assert.ok(value, `Missing ${text}`);
  return value;
}
await render("stock", true);
await act(async () => button("Buka review").click());
assert.ok(button("Catat pemakaian").disabled);
await render();
assert.equal(host.querySelectorAll("li").length, 5);
await act(async () => button("Berikutnya").click());
assert.ok(host.textContent?.includes("Panel 6"));
desktop = false;
await render();
assert.equal(host.querySelectorAll("li").length, 2);
assert.ok(host.textContent?.includes("Panel 6"));
await act(async () => button("Catat pemakaian").click());
assert.equal(calls.length, 0);
assert.ok(host.querySelector('[role="alertdialog"]'));
await act(async () => button("Kembali").click());
assert.equal(calls.length, 0);
await act(async () => button("Catat pemakaian").click());
const dialog = host.querySelector('[role="alertdialog"]');
assert.ok(dialog);
await act(async () => {
  button("Catat pemakaian", dialog).click();
  button("Catat pemakaian", dialog).click();
});
assert.equal(calls.length, 1);
assert.deepEqual(calls[0], { conversationId: id, toolCallId: "stock" });
assert.ok(resolveSave);
await act(async () =>
  resolveSave?.({ success: true, data: { resultId: id, alreadyConfirmed: false } }),
);
assert.ok(host.querySelector('a[href="/materials"]'));
viewStatus = "STALE";
await render("stale");
await act(async () => button("Buka review").click());
assert.ok(button("Catat pemakaian").disabled);
assert.ok(button("Minta preview terbaru"));
viewStatus = "READY";
budgetAllowed = false;
await render("privacy");
await act(async () => button("Buka review").click());
assert.equal(host.querySelector('[data-money="987654321"]'), null);
readError = "Proyek di luar akses Anda.";
await render("error");
await act(async () => button("Buka review").click());
assert.ok(host.querySelector("[data-review-content] [data-proposal-review-feedback]"));
assert.equal(host.querySelector('[data-review-actions] [role="alert"]'), null);
assert.ok(button("Catat pemakaian").disabled);
assert.ok(button("Periksa lagi"));
readError = null;
for (const [action, label] of [
  ["RELEASE_RESERVATION", "Lepas reservasi"],
  ["WASTE", "Catat material terbuang"],
] as const) {
  proposal = {
    ...proposal,
    action,
    input: { ...proposal.input, action },
    rows: proposal.rows.slice(0, 1),
  };
  await render(action);
  assert.equal(host.querySelector("[data-sheet]"), null);
  assert.ok(host.textContent?.includes("Gudang utama"));
  assert.equal(button(label).disabled, false, host.textContent ?? "No content");
  await act(async () => button(label).click());
  if (action === "RELEASE_RESERVATION") {
    assert.equal(host.querySelector('[role="alertdialog"]'), null);
    assert.equal(calls.length, 2);
    await act(async () =>
      resolveSave?.({ success: true, data: { resultId: id, alreadyConfirmed: false } }),
    );
  } else {
    assert.ok(host.querySelector('[role="alertdialog"]'), host.textContent ?? "No content");
    assert.equal(calls.length, 2);
    await act(async () => button("Kembali").click());
  }
}
await act(async () => root.unmount());
await browserWindow.happyDOM.close();
console.log("Project stock DOM passed");
