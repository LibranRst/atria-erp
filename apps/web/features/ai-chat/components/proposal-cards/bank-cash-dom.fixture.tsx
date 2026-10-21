import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { mock } from "bun:test";
import React, { act, type ReactNode } from "react";
import { FixtureFooterActions } from "./proposal-footer.fixture";
import { bankCashProposalSchema } from "@atria/core/ai/bank-cash";
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
  readDenied = false,
  confirmCalls = 0;
let complete: ((value: unknown) => void) | null = null;
const p = bankCashProposalSchema.parse({
  kind: "BANK_CASH",
  input: {
    action: "CASH_MOVEMENT",
    bankAccountId: "77777777-7777-7777-7777-777777777771",
    type: "OUTFLOW",
    amount: 15,
    category: "bank_fee",
    description: "Biaya administrasi bank",
    transactionDate: "2026-10-11",
    referenceNumber: "REF-QA-11",
  },
  title: "Dana keluar",
  entityName: "Kas pengujian",
  expectedContext: "0".repeat(64),
  effect: "Mencatat kas setelah konfirmasi.",
  facts: [
    { label: "Referensi", value: "REF-QA-11", money: false },
    { label: "Nominal", value: 15, money: true },
  ],
  comparisons: [{ label: "Saldo rekening", before: 1000, after: 985, money: true }],
  details: [],
});
mock.module("@/components/auth/permissions-provider", () => ({
  useCan: () => (): boolean => allowed,
}));
mock.module("@/lib/navigation/workspace-presentation", () => ({
  useWorkspacePresentation: () => "desktop",
}));
mock.module("@/app/actions/ai/bank-cash", () => ({
  getAiBankCashProposal: async () =>
    readDenied
      ? { success: false, error: { code: "FORBIDDEN", message: "Akses rekening berubah." } }
      : { success: true, data: { proposal: p, status: "READY", resultId: null } },
  confirmAiBankCashProposal: async (input: unknown) => {
    confirmCalls++;
    assert.deepEqual(input, {
      conversationId: "77777777-7777-7777-7777-777777777770",
      toolCallId: "qa-bank",
    });
    return new Promise((resolve) => {
      complete = resolve;
    });
  },
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
  ReviewCollection: ({ children }: Children) => <ul>{children}</ul>,
  ReviewItem: ({ children }: Children) => <li>{children}</li>,
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
const { BankCashProposalCard } = await import("./bank-cash-proposal-card");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
async function render(streaming = false): Promise<void> {
  await act(async () =>
    root.render(
      <BankCashProposalCard
        proposal={p}
        conversationId="77777777-7777-7777-7777-777777777770"
        toolCallId="qa-bank"
        isBusy={false}
        isStreaming={streaming}
        alreadyConfirmed={false}
        onFollowUp={(): void => {}}
      />,
    ),
  );
}
async function click(b: HTMLElement): Promise<void> {
  await act(async () =>
    b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })),
  );
}
function button(label: string, scope: ParentNode = document): HTMLButtonElement {
  const b = [...scope.querySelectorAll("button")].find((b) => b.textContent === label);
  assert.ok(b);
  return b;
}
await render();
assert.ok(host.textContent?.includes("REF-QA-11"));
assert.ok(host.textContent?.includes("1000"));
assert.equal(host.querySelector("[data-sheet]"), null);
await click(button("Catat dana keluar"));
const dialog = host.querySelector('[role="alertdialog"]');
assert.ok(dialog);
assert.equal(confirmCalls, 0, "opening confirmation cannot post cash");
await click(button("Catat dana keluar", dialog));
await click(button("Catat dana keluar", dialog));
assert.equal(confirmCalls, 1, "pending blocks repeat submission");
assert.equal(button("Batal", dialog).disabled, true);
assert.ok(complete);
await act(async () => {
  if (complete)
    complete({ success: true, data: { resultId: "saved-bank-cash", alreadyConfirmed: false } });
});
assert.equal(host.querySelector('[role="alertdialog"]'), null);
assert.ok(host.textContent?.includes("Mutasi kas berhasil dicatat"));
await act(async () => root.unmount());
const root2 = createRoot(host);
readDenied = true;
allowed = false;
await act(async () =>
  root2.render(
    <BankCashProposalCard
      proposal={p}
      conversationId="77777777-7777-7777-7777-777777777770"
      toolCallId="qa-denied"
      isBusy={false}
      isStreaming={false}
      alreadyConfirmed={false}
      onFollowUp={(): void => {}}
    />,
  ),
);
assert.equal(
  host.querySelectorAll("[data-money]").length,
  0,
  "revoked read rights hide bank snapshots",
);
assert.equal(button("Catat dana keluar").disabled, true);
await act(async () => root2.unmount());
await w.happyDOM.close();
console.log("bank cash confirmation and permission DOM regression passed");
