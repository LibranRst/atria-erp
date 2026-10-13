import { FixtureFooterActions } from "./proposal-footer.fixture";
import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act, type ReactNode } from "react";
import type {
  RabWorkflowProposal,
  RabWorkflowView,
  RabWorkflowReceipt,
} from "@atria/core/ai/rab-workflow";
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
const base = {
  clientLabel: "Panel klien",
  description: "Finishing klien",
  quantity: 2,
  unit: "lembar",
  unitPrice: 100000,
  itemNature: "PRODUCTION" as const,
  isHidden: false,
};
const ids = Array.from(
  { length: 12 },
  (_, i) => `20000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
);
let proposal: RabWorkflowProposal = {
  kind: "RAB_WORKFLOW",
  projectId: id,
  projectName: "Proyek visual",
  rabEstimateId: id,
  title: "Penawaran dapur",
  revision: 1,
  expectedContext: "a".repeat(64),
  request: {
    action: "EDIT_DRAFT",
    rows: ids.map((itemId, i) =>
      i === 0
        ? { action: "EXCLUDE", itemId }
        : {
            action: "UPDATE",
            itemId,
            fields: { ...base, clientLabel: `Panel ${i + 1}`, unitPrice: 120000 },
          },
    ),
  },
  rows: ids.map((rowId, i) => ({
    id: rowId,
    title: `Panel ${i + 1}`,
    action: i === 0 ? "Keluarkan dari penawaran" : "Koreksi baris",
    detail: "",
    before: { ...base, clientLabel: `Panel ${i + 1}` },
    after: {
      ...base,
      clientLabel: `Panel ${i + 1}`,
      unitPrice: i === 0 ? 100000 : 120000,
      isHidden: i === 0,
    },
    beforeState: null,
    afterState: null,
  })),
  totalBefore: 2400000,
  totalAfter: 2640000,
  budgetImpact: null,
  warning: null,
};
let viewStatus: RabWorkflowView["status"] = "READY",
  desktop = true,
  budgetAllowed = true;
let readError: string | null = null;
const calls: unknown[] = [];
let resolveSave: ((result: ActionResponse<RabWorkflowReceipt>) => void) | null = null;
mock.module("@/app/actions/ai/rab-workflow", () => ({
  getAiRabWorkflowProposal: async (): Promise<ActionResponse<RabWorkflowView>> =>
    readError
      ? { success: false, error: { code: "FORBIDDEN", message: readError } }
      : {
          success: true,
          data: { proposal, status: viewStatus, resultId: null },
        },
  confirmAiRabWorkflowProposal: (input: unknown): Promise<ActionResponse<RabWorkflowReceipt>> => {
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
  { RabWorkflowProposalCard } = await import("./rab-workflow-proposal-card");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
async function render(key = "edit", streaming = false): Promise<void> {
  await act(async () =>
    root.render(
      <RabWorkflowProposalCard
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
  const found = [...scope.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.trim() === text,
  );
  assert.ok(found, `Missing ${text}`);
  return found;
}
await render("edit", true);
await act(async () => button("Buka review").click());
assert.ok(button("Simpan koreksi RAB").disabled, "Streaming cannot confirm unstored proposals");
await render();
assert.equal(host.querySelectorAll("li").length, 5);
await act(async () => button("Berikutnya").click());
assert.ok(host.textContent?.includes("Panel 6"));
desktop = false;
await render();
assert.equal(host.querySelectorAll("li").length, 5);
assert.ok(host.textContent?.includes("Panel 6"), "Pagination survives responsive presentation");
await act(async () => button("Simpan koreksi RAB").click());
assert.equal(calls.length, 0, "Exclusion opens protected confirmation first");
assert.ok(host.querySelector('[role="alertdialog"]'));
await act(async () => button("Kembali").click());
assert.equal(calls.length, 0);
await act(async () => button("Simpan koreksi RAB").click());
const dialog = host.querySelector('[role="alertdialog"]');
assert.ok(dialog);
await act(async () => {
  button("Simpan koreksi RAB", dialog).click();
  button("Simpan koreksi RAB", dialog).click();
});
assert.equal(calls.length, 1);
assert.deepEqual(calls[0], { conversationId: id, toolCallId: "edit" });
assert.ok(resolveSave);
await act(async () =>
  resolveSave?.({ success: true, data: { resultId: id, alreadyConfirmed: false } }),
);
assert.ok(host.querySelector('a[href*="tab=rab"]'));
viewStatus = "STALE";
await render("stale");
await act(async () => button("Buka review").click());
assert.ok(button("Simpan koreksi RAB").disabled);
assert.ok(button("Minta usulan terbaru"));
assert.equal(calls.length, 1);
proposal = {
  ...proposal,
  request: { action: "APPROVE_INITIAL" },
  rows: proposal.rows.slice(0, 1),
  budgetImpact: {
    contractBefore: 1000000,
    contractAfter: 987654321,
    capBefore: 800000,
    capAfter: 400000,
    categories: [
      { name: "Material", before: 500000, after: 200000, actual: 350000, manual: false },
    ],
  },
};
viewStatus = "READY";
await render("risk");
await act(async () => button("Buka review").click());
assert.ok(host.querySelector('[aria-label="Risiko alokasi budget"]'));
assert.ok(
  host.querySelector('[data-money="150000"]'),
  "Risk shortfall is visible without opening budget details",
);
await act(async () => button("Setujui RAB").click());
const approvalDialog = host.querySelector('[role="alertdialog"]');
assert.ok(approvalDialog?.querySelector('[aria-label="Risiko alokasi budget"]'));
assert.ok(approvalDialog?.textContent?.includes("Material"));
assert.ok(
  approvalDialog?.querySelector('[data-money="150000"]'),
  "Protected approval retains exact category risk",
);
budgetAllowed = false;
viewStatus = "READY";
await render("privacy");
await act(async () => button("Buka review").click());
assert.equal(
  host.querySelector('[data-money="987654321"]'),
  null,
  "Revoked budget access masks cached proposal financial impact",
);
assert.equal(host.querySelector('[aria-label="Risiko alokasi budget"]'), null);
proposal = {
  ...proposal,
  request: { action: "CREATE_REVISION", reason: "Perubahan lingkup dapur sesuai gambar baru" },
  budgetImpact: null,
};
await render("revision");
await act(async () => button("Buka review").click());
assert.ok(host.textContent?.includes("Alasan revisi"));
assert.ok(
  host.textContent?.includes("Perubahan lingkup dapur sesuai gambar baru"),
  "Review shows exact stored revision reason",
);
readError = "Proyek di luar akses Anda.";
await render("error");
await act(async () => button("Buka review").click());
assert.ok(host.querySelector("[data-review-content] [data-proposal-review-feedback]"));
assert.equal(
  host.querySelector('[data-review-actions] [role="alert"]'),
  null,
  "Error feedback stays out of protected action area",
);
assert.ok(button("Buat Draft revisi").disabled);
assert.ok(
  button("Periksa lagi").closest("[data-review-content]"),
  "Recovery remains with the blocked review context",
);
readError = null;
budgetAllowed = true;
viewStatus = "READY";
proposal = {
  ...proposal,
  request: { action: "APPROVE_INITIAL" },
  warning: null,
  rows: proposal.rows.slice(0, 1),
  budgetImpact: proposal.budgetImpact
    ? {
        ...proposal.budgetImpact,
        categories: proposal.budgetImpact.categories.map((c) => ({
          ...c,
          after: Math.max(c.after, c.actual),
        })),
      }
    : null,
};
await render("inline-approval");
assert.equal(host.querySelector("[data-sheet]"), null);
const beforeApproval = calls.length;
await act(async () => button("Setujui RAB").click());
assert.ok(host.querySelector('[role="alertdialog"]'));
assert.equal(calls.length, beforeApproval);
await act(async () => button("Kembali").click());
await act(async () => root.unmount());
await browserWindow.happyDOM.close();
console.log("RAB workflow DOM passed");
