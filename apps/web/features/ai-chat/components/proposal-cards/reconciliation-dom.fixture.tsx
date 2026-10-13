import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { mock } from "bun:test";
import React, { act, type ReactNode } from "react";
import { FixtureFooterActions } from "./proposal-footer.fixture";
import { reconciliationProposalSchema } from "@atria/core/ai/bank-reconciliation";
const w = new Window({ url: "https://atria.test/ai" });
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
  "MutationObserver",
  "getComputedStyle",
]) {
  const value: unknown = key === "window" ? w : Reflect.get(w, key);
  Reflect.set(
    globalThis,
    key,
    typeof value === "function" && key === "getComputedStyle" ? value.bind(w) : value,
  );
}
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
const { createRoot } = await import("react-dom/client");
let allowed = true,
  confirmCalls = 0,
  patchCalls = 0;
let completeSave: ((value: unknown) => void) | null = null,
  completePatch: ((value: unknown) => void) | null = null;
const identity = { conversationId: "77777777-7777-7777-7777-777777777770", toolCallId: "qa-recon" };
const p = reconciliationProposalSchema.parse({
  kind: "BANK_RECONCILIATION_WORKFLOW",
  input: {
    action: "IMPORT",
    bankAccountId: "77777777-7777-7777-7777-777777777771",
    fileName: "qa.csv",
    rows: [
      {
        transactionDate: "2026-10-11",
        description: "Mutasi sintetis",
        amount: 15000,
        type: "INFLOW",
      },
    ],
  },
  title: "Impor mutasi bank",
  bankAccountId: "77777777-7777-7777-7777-777777777771",
  bankAccountName: "Bank QA",
  accountNumber: "123456",
  expectedContext: "0".repeat(64),
  rows: [
    {
      rowId: "import-1",
      statementRowId: null,
      mutation: {
        transactionDate: "2026-10-11",
        description: "Mutasi sintetis",
        amount: 15000,
        type: "INFLOW",
      },
      fingerprint: "0".repeat(64),
      duplicate: false,
      selected: true,
      candidates: [],
      chosenCashId: null,
    },
  ],
  exception: null,
  warning: null,
  effect: "Saldo tetap",
});
let server = { proposal: p, status: "READY", revision: 1, resultId: null };
mock.module("@/components/auth/permissions-provider", () => ({
  useCan: () => (): boolean => allowed,
}));
mock.module("@/lib/navigation/workspace-presentation", () => ({
  useWorkspacePresentation: () => "desktop",
}));
mock.module("@/app/actions/ai/bank-reconciliation", () => ({
  getAiReconciliationProposal: async () => ({ success: true, data: server }),
  patchAiReconciliationProposal: async (input: unknown) => {
    patchCalls++;
    assert.equal(Reflect.get(input as object, "expectedRevision"), server.revision);
    return new Promise((resolve) => {
      completePatch = resolve;
    });
  },
  confirmAiReconciliationProposal: async (input: unknown) => {
    confirmCalls++;
    assert.deepEqual(input, { ...identity, expectedRevision: 3 });
    return new Promise((resolve) => {
      completeSave = resolve;
    });
  },
  discardAiReconciliationProposal: async () => ({
    success: true,
    data: { ...server, status: "DISCARDED" },
  }),
}));
type Children = { readonly children?: ReactNode };
function Button({
  children,
  onClick,
  disabled,
  pending,
}: {
  readonly children?: ReactNode;
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
  Button,
  SheetFooterActions: FixtureFooterActions,
  ButtonLink: ({ children, href }: Children & { readonly href: string }) => (
    <a href={href}>{children}</a>
  ),
  MoneyValue: ({ amount }: { readonly amount: number }) => <span data-money>{amount}</span>,
  FormSheet: ({
    open,
    children,
    footer,
  }: Children & { readonly open: boolean; readonly footer: ReactNode }) =>
    open ? (
      <section data-sheet>
        {children}
        {footer}
      </section>
    ) : null,
  ConfirmationDialog: ({
    open,
    children,
    title,
    onClose,
    onConfirm,
    confirmLabel,
    pending,
    disabled,
  }: Children & {
    readonly open: boolean;
    readonly title: string;
    readonly onClose: () => void;
    readonly onConfirm: () => void;
    readonly confirmLabel: string;
    readonly pending: boolean;
    readonly disabled: boolean;
  }) =>
    open ? (
      <section role="alertdialog" aria-label={title}>
        {children}
        <Button pending={pending} onClick={onClose}>
          Batal
        </Button>
        <Button pending={pending} disabled={disabled} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </section>
    ) : null,
  GroupedSurface: ({ children }: Children) => <section>{children}</section>,
  ReviewCollection: ({ children, footer }: Children & { readonly footer: ReactNode }) => (
    <div>
      {children}
      {footer}
    </div>
  ),
  ReviewItem: ({
    children,
    title,
    selection,
    primaryValue,
    summary,
  }: Children & {
    readonly title: ReactNode;
    readonly selection: ReactNode;
    readonly primaryValue: ReactNode;
    readonly summary: ReactNode;
  }) => (
    <div>
      {title}
      {primaryValue}
      {summary}
      {selection}
      {children}
    </div>
  ),
  ChoiceRow: ({
    checked,
    onChange,
    disabled,
  }: {
    readonly checked: boolean;
    readonly onChange: (value: boolean) => void;
    readonly disabled: boolean;
  }) => (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
  ),
  AdaptiveSelect: () => null,
  DatePickerField: () => null,
  FormField: ({ children }: Children) => <div>{children}</div>,
  FormSection: ({ children }: Children) => <div>{children}</div>,
  TextInput: () => null,
  MoneyInput: () => null,
  FactRow: ({ label, value }: { readonly label: string; readonly value: ReactNode }) => (
    <p>
      {label}
      {value}
    </p>
  ),
  FormDisclosure: ({ title, children }: Children & { readonly title: string }) => (
    <details>
      <summary>{title}</summary>
      {children}
    </details>
  ),
}));
mock.module("./proposal-card-shell", () => ({
  ProposalCardShell: ({
    children,
    footer,
    title,
  }: Children & { readonly footer: ReactNode; readonly title: string }) => (
    <section aria-label={title}>
      {children}
      {footer}
    </section>
  ),
  ProposalDiffRow: ({
    label,
    before,
    after,
  }: {
    readonly label: string;
    readonly before: ReactNode;
    readonly after: ReactNode;
  }) => (
    <p>
      {label} Sebelum:{before} Sesudah:{after}
    </p>
  ),
}));
mock.module("./proposal-review-feedback", () => ({
  ProposalReviewFeedback: ({ message }: { readonly message: string }) => (
    <p role="alert">{message}</p>
  ),
}));
const { ReconciliationWorkflowCard } = await import("./reconciliation-workflow-card");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
async function render(): Promise<void> {
  await act(async () =>
    root.render(
      <ReconciliationWorkflowCard
        proposal={p}
        {...identity}
        isBusy={false}
        isStreaming={false}
        alreadyConfirmed={false}
        onFollowUp={(): void => {}}
      />,
    ),
  );
}
function button(label: string, scope: ParentNode = host): HTMLButtonElement {
  const found = Array.from(scope.querySelectorAll("button")).find((b) => b.textContent === label);
  assert.ok(found, label);
  return found;
}
await render();
const checkbox = host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
await act(async () => checkbox.click());
assert.equal(checkbox.checked, false);
assert.equal(patchCalls, 1);
assert.equal(host.querySelectorAll('input[type="checkbox"]').length, 1);
await act(async () => checkbox.click());
assert.equal(checkbox.checked, true);
assert.equal(patchCalls, 1);
server = {
  ...server,
  revision: 2,
  proposal: { ...p, rows: p.rows.map((r) => ({ ...r, selected: false })) },
};
await act(async () => {
  completePatch?.({ success: true, data: server });
});
assert.equal(patchCalls, 2);
assert.equal(checkbox.checked, true);
server = { ...server, revision: 3, proposal: p };
await act(async () => {
  completePatch?.({ success: true, data: server });
});
await act(async () => button("Impor 1 mutasi").click());
assert.equal(confirmCalls, 0);
const dialog = host.querySelector('[role="alertdialog"]')!;
assert.ok(dialog);
await act(async () => {
  button("Impor 1 mutasi", dialog).click();
  button("Impor 1 mutasi", dialog).click();
});
assert.equal(confirmCalls, 1);
assert.equal(button("Batal", dialog).disabled, true);
await act(async () => {
  completeSave?.({ success: true, data: { resultId: "saved-import", alreadyConfirmed: false } });
});
assert.equal(host.querySelector('[role="alertdialog"]'), null);
assert.match(host.textContent ?? "", /mutasi tersimpan/);
allowed = false;
await render();
assert.doesNotMatch(host.textContent ?? "", /123456|15000|Mutasi sintetis/);
await act(async () => root.unmount());
w.happyDOM.abort();
console.log("reconciliation optimistic selection and protected confirmation DOM passed");
