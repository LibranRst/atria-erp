import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act, type ReactNode } from "react";
import { rapChangeProposalSchema, type RapChangeView } from "@atria/core/ai/rap-change";
const browserWindow = new Window({ url: "https://atria.test/ai", width: 390 });
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

const id = "00000000-0000-0000-0000-000000000001",
  other = "00000000-0000-0000-0000-000000000002";
const before = {
  itemId: id,
  materialId: null,
  name: "Panel",
  unit: "lembar",
  area: "Utama",
  requiredQuantity: 2,
  bufferQuantity: 0,
  estimatedUnitCost: 50000,
  totalQuantity: 2,
  estimatedTotalCost: 100000,
};
let proposal = rapChangeProposalSchema.parse({
  kind: "RAP_MATERIAL_CHANGES",
  projectId: id,
  projectName: "Fixture",
  projectRapId: id,
  expectedContext: "a".repeat(64),
  rows: [
    {
      action: "UPDATE",
      before,
      after: { ...before, requiredQuantity: 4, totalQuantity: 4, estimatedTotalCost: 200000 },
    },
    { action: "DELETE", before: { ...before, itemId: other, area: "Lain" }, after: null },
  ],
  budget: {
    allocated: 315000,
    actual: 0,
    pending: 0,
    remaining: 315000,
    beforePlan: 200000,
    afterPlan: 200000,
    delta: 0,
    overAllocation: 0,
  },
});
let status: RapChangeView["status"] = "READY";
const saves: unknown[] = [];
mock.module("@/app/actions/ai/rap-change", () => ({
  getAiRapChangeProposal: async () => ({
    success: true,
    data: { proposal, status, confirmedAt: null },
  }),
  confirmAiRapChangeProposal: async (input: unknown) => {
    saves.push(input);
    return {
      success: true,
      data: { projectRapId: id, updatedIds: [id], deletedIds: [other], alreadyConfirmed: false },
    };
  },
}));
type Children = { readonly children?: ReactNode };
function Button({
  children,
  onClick,
  disabled,
}: {
  readonly children?: ReactNode;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
}): React.JSX.Element {
  return (
    <button disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
mock.module("@/components/ui", () => ({
  FormDisclosure: ({
    title,
    children,
    expanded,
    onToggle,
  }: {
    readonly title: string;
    readonly children: React.ReactNode;
    readonly expanded?: boolean;
    readonly onToggle?: () => void;
  }): React.JSX.Element => (
    <section>
      <button onClick={onToggle}>{title}</button>
      {expanded ? children : null}
    </section>
  ),

  Button,
  AppIcon: () => null,
  MoneyValue: ({ amount }: { readonly amount: number }) => <span>{amount}</span>,
  FactRow: ({ label, value }: { readonly label: string; readonly value: ReactNode }) => (
    <p>
      {label}:{value}
    </p>
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
  GroupedSurface: ({ children }: Children) => <section>{children}</section>,
  FormSection: ({ children }: Children) => <section>{children}</section>,
  ReviewCollection: () => null,
  ReviewItem: () => null,
  FormSheet: ({
    open,
    children,
    footer,
  }: {
    readonly open: boolean;
    readonly children: ReactNode;
    readonly footer: ReactNode;
  }) =>
    open ? (
      <section>
        {children}
        {footer}
      </section>
    ) : null,
  ConfirmationDialog: ({
    open,
    title,
    description,
    onClose,
    onConfirm,
    confirmLabel,
    pending,
  }: {
    readonly open: boolean;
    readonly title: string;
    readonly description: string;
    readonly onClose: () => void;
    readonly onConfirm: () => void;
    readonly confirmLabel: string;
    readonly pending: boolean;
  }) =>
    open ? (
      <section role="alertdialog">
        <h2>{title}</h2>
        <p>{description}</p>
        <Button disabled={pending} onClick={onClose}>
          Batal
        </Button>
        <Button disabled={pending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </section>
    ) : null,
}));
mock.module("./proposal-card-shell", () => ({
  ProposalCardShell: ({ children, footer }: Children & { readonly footer: ReactNode }) => (
    <section>
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
      {label}:{before}→{after}
    </p>
  ),
}));
const { createRoot } = await import("react-dom/client");
const { RapChangeProposalCard } = await import("./rap-change-proposal-card");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
function button(text: string): HTMLButtonElement {
  const found = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.trim() === text,
  );
  assert.ok(found, `missing ${text}`);
  return found;
}
async function render(key: string): Promise<void> {
  await act(async () =>
    root.render(
      <RapChangeProposalCard
        key={key}
        proposal={proposal}
        conversationId={id}
        toolCallId={key}
        isStreaming={false}
        isBusy={false}
        alreadyConfirmed={false}
        onFollowUp={() => undefined}
      />,
    ),
  );
}
await render("one");
await act(async () => button("Buka review").click());
assert.equal(saves.length, 0);
assert.ok(host.textContent?.includes("Kebutuhan:2 lembar→4 lembar"));
await act(async () => button("Konfirmasi perubahan & hapus").click());
assert.equal(saves.length, 0, "opening destructive review cannot mutate");
assert.ok(host.querySelector('[role="alertdialog"]'));
await act(async () => button("Batal").click());
assert.equal(saves.length, 0);
await act(async () => button("Konfirmasi perubahan & hapus").click());
await act(async () => {
  const confirm = button("Simpan & hapus baris RAP");
  confirm.click();
  confirm.click();
});
assert.deepEqual(
  saves,
  [{ conversationId: id, toolCallId: "one" }],
  "confirmation is identity-only and duplicate clicks coalesce",
);
status = "STALE";
await render("stale");
await act(async () => button("Buka review").click());
assert.ok(button("Konfirmasi perubahan & hapus").disabled);
assert.ok(button("Minta usulan terbaru"));
status = "READY";
proposal = rapChangeProposalSchema.parse({ ...proposal, rows: [proposal.rows[0]] });
await render("single-inline");
assert.equal(host.querySelector("[data-sheet]"), null);
assert.equal(
  [...host.querySelectorAll("button")].some((b) => b.textContent?.trim() === "Buka review"),
  false,
);
const beforeSave = saves.length;
await act(async () => button("Simpan perubahan RAP").click());
assert.equal(saves.length, beforeSave + 1);
assert.equal(host.querySelector('[role="alertdialog"]'), null);
await act(async () => root.unmount());
await browserWindow.happyDOM.close();
console.log("RAP changes confirmation DOM passed");
