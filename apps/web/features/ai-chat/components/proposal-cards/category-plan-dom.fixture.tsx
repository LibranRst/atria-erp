import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act, type ReactNode } from "react";
import { packageProposalSchema, type PackageView } from "@atria/core/ai/category-plan";
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
const fields = {
  name: "Pasang panel",
  scopeDescription: "Lingkup uji",
  area: "Utama",
  quantity: 2,
  unit: "m2",
  estimatedUnitCost: 50000,
  vendorId: null,
  internalNote: null,
};
const snapshot = {
  ...fields,
  vendorName: null,
  sourceLibraryItemId: null,
  estimatedTotalCost: 100000,
};
let proposal = packageProposalSchema.parse({
  kind: "CATEGORY_PLAN_PACKAGES",
  projectId: id,
  projectName: "Fixture",
  projectRapId: null,
  expectedContext: "a".repeat(64),
  request: {
    projectId: id,
    rows: [
      { action: "CREATE", category: "TUKANG", draft: { source: "MANUAL", ...fields } },
      { action: "UPDATE", itemId: other, changes: { quantity: 4 } },
    ],
  },
  rows: [
    {
      rowId: id,
      itemId: null,
      action: "CREATE",
      category: "TUKANG",
      before: null,
      after: snapshot,
      priceSourceLabel: "Estimasi dari pengguna",
    },
    {
      rowId: other,
      itemId: other,
      action: "UPDATE",
      category: "SUBCON",
      before: snapshot,
      after: { ...snapshot, quantity: 4, estimatedTotalCost: 200000 },
      priceSourceLabel: "Estimasi koreksi pengguna",
    },
  ],
  budgets: [
    {
      category: "TUKANG",
      categoryId: id,
      allocated: 315000,
      actual: 0,
      pending: 0,
      remaining: 315000,
      beforePlan: 0,
      afterPlan: 100000,
      delta: 100000,
      overAllocation: 0,
    },
    {
      category: "SUBCON",
      categoryId: other,
      allocated: 315000,
      actual: 0,
      pending: 0,
      remaining: 315000,
      beforePlan: 100000,
      afterPlan: 200000,
      delta: 100000,
      overAllocation: 0,
    },
  ],
});
let status: PackageView["status"] = "READY";
const saves: unknown[] = [];
mock.module("@/app/actions/ai/category-plan", () => ({
  getAiCategoryPlanProposal: async () => ({
    success: true,
    data: { proposal, status, confirmedAt: null },
  }),
  confirmAiCategoryPlanProposal: async (input: unknown) => {
    saves.push(input);
    return {
      success: true,
      data: {
        items: [
          { rowId: id, itemId: id, action: "CREATE" },
          { rowId: other, itemId: other, action: "UPDATE" },
        ],
        alreadyConfirmed: false,
      },
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
  Button,
  AppIcon: () => null,
  MoneyValue: ({ amount }: { readonly amount: number }) => <span>{amount}</span>,
  FactRow: ({ label, value }: { readonly label: string; readonly value: ReactNode }) => (
    <p>
      {label}:{value}
    </p>
  ),
  FormDisclosure: ({
    children,
    expanded,
  }: {
    readonly children?: ReactNode;
    readonly expanded: boolean;
  }) => (expanded ? <div>{children}</div> : null),
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
const { CategoryPlanProposalCard } = await import("./category-plan-proposal-card");
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
      <CategoryPlanProposalCard
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
assert.equal(saves.length, 0, "review cannot mutate");
assert.ok(host.textContent?.includes("Jumlah:2 m2→4 m2"));
await act(async () => {
  const confirm = button("Simpan paket Draft");
  confirm.click();
  confirm.click();
});
assert.deepEqual(
  saves,
  [{ conversationId: id, toolCallId: "one" }],
  "identity-only confirmation and double-click coalescing",
);
assert.ok(host.textContent?.includes("Paket Draft tersimpan"));
status = "STALE";
await render("stale");
await act(async () => button("Buka review").click());
assert.ok(button("Simpan paket Draft").disabled);
assert.ok(button("Minta usulan terbaru"));
status = "READY";
proposal = packageProposalSchema.parse({
  ...proposal,
  request: {
    projectId: id,
    rows: [
      { action: "UPDATE", itemId: id, changes: { quantity: proposal.rows[0].after.quantity } },
    ],
  },
  rows: [
    {
      ...proposal.rows[0],
      action: "UPDATE",
      itemId: id,
      before: { ...proposal.rows[0].after, quantity: proposal.rows[0].after.quantity + 1 },
      after: proposal.rows[0].after,
    },
  ],
});
await render("single-inline");
assert.equal(host.querySelector("[data-sheet]"), null);
assert.equal(
  [...host.querySelectorAll("button")].some((b) => b.textContent?.trim() === "Buka review"),
  false,
);
const beforeSave = saves.length;
await act(async () => button("Simpan paket Draft").click());
assert.equal(saves.length, beforeSave + 1);
assert.equal(host.querySelector('[role="alertdialog"]'), null);
await act(async () => root.unmount());
await browserWindow.happyDOM.close();
console.log("Package confirmation DOM passed");
