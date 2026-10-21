import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act, type ReactNode } from "react";
import { setupProposalSchema, type SetupView } from "@atria/core/ai/rap-finalization";
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
const snapshot = {
  name: "Paket ditinjau",
  scopeDescription: "Scope jelas",
  area: "Utama",
  quantity: 1,
  unit: "ls",
  estimatedUnitCost: 50000,
  estimatedTotalCost: 50000,
  vendorId: null,
  vendorName: null,
  sourceLibraryItemId: null,
  internalNote: null,
};
const before = {
  status: "DRAFT",
  stage: "MATERIAL",
  materialCount: 1,
  tukangSkipped: false,
  subconSkipped: false,
  packages: [
    { id, category: "TUKANG", status: "DRAFT", snapshot },
    { id: other, category: "SUBCON", status: "DRAFT", snapshot },
  ],
};
const steps = [
  { action: "READY_PACKAGES", itemIds: [id, other] },
  { action: "ADVANCE", targetStage: "TUKANG" },
  { action: "ADVANCE", targetStage: "SUBCON" },
  { action: "ADVANCE", targetStage: "REVIEW" },
  { action: "FINALIZE" },
];
let proposal = setupProposalSchema.parse({
  kind: "RAP_SETUP_ACTIONS",
  projectId: id,
  projectName: "Fixture",
  projectRapId: id,
  expectedContext: "a".repeat(64),
  request: { projectId: id, steps },
  before,
  after: {
    ...before,
    status: "LOCKED",
    stage: "COMPLETE",
    packages: before.packages.map((p) => ({ ...p, status: "ACTIVE" })),
  },
  steps: steps.map((step, index) => ({
    step,
    permission:
      index === 0
        ? "update:budget"
        : index === 1
          ? "update:rap"
          : index === 4
            ? "lock:rap"
            : "update:budget",
    label:
      index === 0
        ? "Tandai dua paket Siap"
        : index === 4
          ? "Finalisasi dan kunci RAP"
          : "Lanjut tahap",
    detail: "Keputusan ditinjau",
    packageIds: index === 0 ? [id, other] : [],
  })),
  budget: {
    projectValue: 1000000,
    internalCap: 900000,
    planTotal: 200000,
    actual: 0,
    pending: 0,
    remaining: 900000,
    marginAmount: 1000000,
    categories: [
      {
        id,
        code: "MATERIAL",
        name: "Material",
        allocated: 315000,
        planned: 100000,
        actual: 0,
        pending: 0,
        remaining: 315000,
        overAllocation: 0,
      },
    ],
  },
});
let status: SetupView["status"] = "READY";
const saves: unknown[] = [];
mock.module("@/app/actions/ai/rap-finalization", () => ({
  getAiRapSetupProposal: async () => ({
    success: true,
    data: { proposal, status, confirmedAt: null },
  }),
  confirmAiRapSetupProposal: async (input: unknown) => {
    saves.push(input);
    return {
      success: true,
      data: { projectRapId: id, stage: "COMPLETE", status: "LOCKED", alreadyConfirmed: false },
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
const { RapSetupProposalCard } = await import("./rap-setup-proposal-card");
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
      <RapSetupProposalCard
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
await act(async () => button("Finalisasi RAP").click());
assert.equal(saves.length, 0, "opening final lock confirmation cannot mutate");
assert.ok(host.querySelector('[role="alertdialog"]'));
await act(async () => button("Batal").click());
assert.equal(saves.length, 0);
await act(async () => button("Finalisasi RAP").click());
await act(async () => {
  const confirm = button("Konfirmasi & kunci RAP");
  confirm.click();
  confirm.click();
});
assert.deepEqual(
  saves,
  [{ conversationId: id, toolCallId: "one" }],
  "identity-only lock and duplicate-click coalescing",
);
assert.ok(host.textContent?.includes("RAP telah dikunci"));
status = "STALE";
await render("stale");
await act(async () => button("Buka review").click());
assert.ok(button("Finalisasi RAP").disabled);
assert.ok(button("Minta usulan terbaru"));
status = "READY";
const finalStep = proposal.steps.find((s) => s.step.action === "FINALIZE");
assert.ok(finalStep);
proposal = setupProposalSchema.parse({
  ...proposal,
  request: { ...proposal.request, steps: [finalStep.step] },
  steps: [finalStep],
  budget: {
    ...proposal.budget,
    planTotal: 100,
    internalCap: 900000,
    categories: proposal.budget.categories.map((c) => ({ ...c, overAllocation: 0 })),
  },
});
await render("single-inline");
assert.equal(host.querySelector("[data-sheet]"), null);
const beforeFinal = saves.length;
await act(async () => button("Finalisasi RAP").click());
assert.ok(host.querySelector('[role="alertdialog"]'));
assert.equal(saves.length, beforeFinal);
await act(async () => button("Batal").click());
await act(async () => root.unmount());
await browserWindow.happyDOM.close();
console.log("RAP setup confirmation DOM passed");
