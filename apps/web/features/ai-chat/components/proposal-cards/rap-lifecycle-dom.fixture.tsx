import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act, type ReactNode } from "react";
import {
  lifecycleProposalSchema,
  type LifecycleView,
  type LifecycleProposal,
} from "@atria/core/ai/rap-lifecycle";
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

const id = "00000000-0000-0000-0000-000000000001";
const proposal = lifecycleProposalSchema.parse({
  kind: "RAP_LIFECYCLE",
  projectId: id,
  projectName: "Fixture",
  projectRapId: id,
  expectedContext: "a".repeat(64),
  nextRapId: null,
  request: { action: "PACKAGE_CHANGES", projectId: id, rows: [{ action: "DELETE", itemId: id }] },
  rows: [
    {
      id,
      action: "DELETE",
      category: "TUKANG",
      name: "Paket ditinjau",
      detail: "Area Utama · 1 ls · Scope jelas",
      beforeStatus: "DRAFT",
      afterStatus: "DELETED",
      estimate: 50000,
      revision: 1,
      nextId: null,
    },
  ],
  budget: {
    projectValue: 1000000,
    internalCap: 900000,
    planTotal: 100000,
    actual: 0,
    pending: 0,
    remaining: 900000,
    marginAmount: 1000000,
    categories: [],
  },
});
let activeProposal: LifecycleProposal = proposal;
let status: LifecycleView["status"] = "READY";
const saves: unknown[] = [];
mock.module("@/app/actions/ai/rap-lifecycle", () => ({
  getAiRapLifecycleProposal: async () => ({
    success: true,
    data: { proposal: activeProposal, status, confirmedAt: null },
  }),
  confirmAiRapLifecycleProposal: async (input: unknown) => {
    saves.push(input);
    return {
      success: true,
      data: {
        projectRapId: id,
        revisionIds: [],
        reopenedIds: [],
        deletedIds: [id],
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
const { RapLifecycleProposalCard } = await import("./rap-lifecycle-proposal-card");
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
      <RapLifecycleProposalCard
        key={key}
        proposal={activeProposal}
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
assert.equal(host.querySelector("[data-sheet]"), null);
assert.equal(saves.length, 0, "review cannot mutate");
assert.ok(
  host.textContent?.includes("Area Utama · 1 ls · Scope jelas"),
  "mobile review retains full business detail",
);
await act(async () => button("Hapus paket").click());
assert.equal(saves.length, 0, "opening final lock confirmation cannot mutate");
assert.ok(host.querySelector('[role="alertdialog"]'));
await act(async () => button("Batal").click());
assert.equal(saves.length, 0);
await act(async () => button("Hapus paket").click());
await act(async () => {
  const confirm = button("Hapus dan simpan");
  confirm.click();
  confirm.click();
});
assert.deepEqual(
  saves,
  [{ conversationId: id, toolCallId: "one" }],
  "identity-only lock and duplicate-click coalescing",
);
assert.ok(host.textContent?.includes("Paket Draft terpilih sudah dihapus"));
status = "STALE";
await render("stale");
assert.equal(host.querySelector("[data-sheet]"), null);
assert.ok(button("Hapus paket").disabled);
assert.ok(button("Minta usulan terbaru"));
status = "READY";
activeProposal = lifecycleProposalSchema.parse({
  ...proposal,
  nextRapId: id,
  request: {
    action: "REVISION",
    projectId: id,
    reason: "Perubahan scope dapur",
    reviseMaterial: true,
    packageIds: [],
  },
  rows: [
    {
      ...proposal.rows[0],
      action: "REVISION",
      category: "MATERIAL",
      beforeStatus: "LOCKED",
      afterStatus: "DRAFT",
      nextId: id,
    },
  ],
});
await render("revision");
await act(async () => button("Buka review").click());
await act(async () => button("Buat draft revisi RAP").click());
assert.ok(
  host.textContent?.includes("Tinjau perubahan dan finalisasi kembali"),
  "saved revisions retain next action",
);
const fields = {
  materialId: null,
  name: "Panel manual",
  area: "Utama",
  requiredQuantity: 1,
  bufferQuantity: 0,
  unit: "ls",
  estimatedUnitCost: 50000,
  source: "VENDOR",
};
activeProposal = lifecycleProposalSchema.parse({
  ...proposal,
  nextRapId: null,
  request: { action: "ADD_MATERIAL", projectId: id, rows: [{ ...fields, sourceKind: "MANUAL" }] },
  rows: [
    {
      ...proposal.rows[0],
      action: "ADD",
      category: "MATERIAL",
      beforeStatus: "NEW",
      afterStatus: "DRAFT",
      nextId: id,
    },
  ],
  materialRows: [
    { rowId: id, values: { ...fields, projectRapId: id }, libraryId: null, clientUnitPrice: null },
  ],
});
await render("addition");
await act(async () => button("Buka review").click());
await act(async () => button("Simpan material RAP").click());
assert.ok(host.textContent?.includes("1 item Material telah ditambahkan"));
assert.ok(!host.textContent?.includes("akan ditambahkan"));
activeProposal = lifecycleProposalSchema.parse({
  ...proposal,
  request: { action: "PACKAGE_CHANGES", projectId: id, rows: [{ action: "REOPEN", itemId: id }] },
  rows: [{ ...proposal.rows[0], action: "REOPEN", beforeStatus: "ACTIVE", afterStatus: "DRAFT" }],
});
await render("reopen");
assert.equal(host.querySelector("[data-sheet]"), null);
await act(async () => button("Buka kembali paket").click());
assert.ok(host.textContent?.includes("Selesaikan koreksi lalu tandai Siap kembali"));
await act(async () => root.unmount());
await browserWindow.happyDOM.close();
console.log("RAP lifecycle confirmation DOM passed");
