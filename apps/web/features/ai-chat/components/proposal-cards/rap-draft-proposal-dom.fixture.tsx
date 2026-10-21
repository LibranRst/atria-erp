import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act, type ReactNode } from "react";
import {
  rapDraftProposalSchema,
  type RapDraftFields,
  type RapDraftView,
  type RapDraftReceipt,
} from "@atria/core/ai/rap-draft";
import { applyRapDraftPatches } from "@atria/core/ai/rap-review";
import type { ActionResponse } from "@atria/core/types/action-response";
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
const proposal = rapDraftProposalSchema.parse({
  kind: "RAP_MATERIAL_DRAFT",
  projectId: id,
  projectName: "Fixture",
  projectRapId: id,
  expectedContext: "a".repeat(64),
  notes: null,
  rows: [
    {
      rowId: id,
      materialId: id,
      materialName: "Panel",
      name: "Panel",
      unit: "lembar",
      area: "Area awal",
      requiredQuantity: 2,
      bufferQuantity: 0,
      estimatedUnitCost: 50000,
      totalQuantity: 2,
      estimatedTotalCost: 100000,
      availableStock: 0,
      priceSource: "REFERENCE",
      priceSourceLabel: "Harga referensi",
      source: "PURCHASE",
    },
  ],
  budget: {
    categoryId: id,
    categoryName: "Material",
    allocated: 315000,
    actual: 0,
    pending: 0,
    remaining: 315000,
    existingPlan: 250000,
    addition: 100000,
    afterPlan: 350000,
    overAllocation: 35000,
  },
  stock: [],
});
let view: RapDraftView = { proposal, status: "READY", confirmedAt: null, draftId: id, revision: 1 };
let resolvePatch: ((result: ActionResponse<RapDraftView>) => void) | undefined;
const patches: unknown[] = [],
  saves: unknown[] = [];
mock.module("@/app/actions/ai/rap-draft", () => ({
  getAiRapDraftProposal: async () => ({ success: true, data: view }),
  patchAiRapDraftProposal: (input: unknown): Promise<ActionResponse<RapDraftView>> => {
    patches.push(input);
    return new Promise((resolve) => {
      resolvePatch = resolve;
    });
  },
  confirmAiRapDraftProposal: async (input: unknown): Promise<ActionResponse<RapDraftReceipt>> => {
    saves.push(input);
    return { success: true, data: { projectRapId: id, itemIds: [id], alreadyConfirmed: false } };
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
function Input({
  id,
  value,
  onChange,
  disabled,
}: {
  readonly id?: string;
  readonly value: string | number;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
}): React.JSX.Element {
  return (
    <input
      id={id}
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );
}
mock.module("@/components/ui", () => ({
  Button,
  IconButton: ({
    label,
    onClick,
    disabled,
  }: {
    readonly label: string;
    readonly onClick?: () => void;
    readonly disabled?: boolean;
  }) => (
    <Button onClick={onClick} disabled={disabled}>
      {label}
    </Button>
  ),
  AppIcon: () => null,
  MoneyValue: ({ amount }: { readonly amount: number }) => <span>{amount}</span>,
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
  FactRow: ({ label, value }: { readonly label: string; readonly value: ReactNode }) => (
    <p>
      {label}: {value}
    </p>
  ),
  FormSection: ({ children }: Children) => <section>{children}</section>,
  FormField: ({
    label,
    htmlFor,
    children,
  }: {
    readonly label: string;
    readonly htmlFor?: string;
    readonly children: ReactNode;
  }) => (
    <label htmlFor={htmlFor}>
      {label}
      {children}
    </label>
  ),
  TextInput: Input,
  Textarea: Input,
  NumericInput: Input,
  MoneyInput: Input,
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
  FormDisclosure: ({
    title,
    expanded,
    onToggle,
    children,
  }: {
    readonly title: string;
    readonly expanded: boolean;
    readonly onToggle: () => void;
    readonly children: ReactNode;
  }) => (
    <section>
      <Button onClick={onToggle}>{title}</Button>
      {expanded ? children : null}
    </section>
  ),
  ConfirmationDialog: () => null,
  ReviewCollection: ({ children, footer }: Children & { readonly footer?: ReactNode }) => (
    <section>
      <ul>{children}</ul>
      {footer}
    </section>
  ),
  ReviewItem: ({
    title,
    selection,
    primaryValue,
    summary,
    editor,
    children,
    onToggle,
    expanded,
    editable,
    disabled,
  }: Children & {
    readonly title: ReactNode;
    readonly selection?: ReactNode;
    readonly primaryValue?: ReactNode;
    readonly summary?: ReactNode;
    readonly editor?: ReactNode;
    readonly onToggle?: () => void;
    readonly expanded?: boolean;
    readonly editable?: boolean;
    readonly disabled?: boolean;
  }) => (
    <li data-review-item="true">
      {title}
      {selection}
      {primaryValue}
      {summary}
      {onToggle ? (
        <Button disabled={disabled} onClick={onToggle}>
          {expanded ? "Ringkas" : editable ? "Edit" : "Rincian"}
        </Button>
      ) : null}
      {editor}
      {children}
    </li>
  ),
}));
mock.module("./proposal-card-shell", () => ({
  ProposalCardShell: ({ children, footer }: Children & { readonly footer: ReactNode }) => (
    <section>
      {children}
      {footer}
    </section>
  ),
}));
const { createRoot } = await import("react-dom/client");
const { RapDraftProposalCard } = await import("./rap-draft-proposal-card");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
await act(async () => {
  root.render(
    <RapDraftProposalCard
      proposal={proposal}
      conversationId={id}
      toolCallId="call-rap"
      isStreaming={false}
      isBusy={false}
      alreadyConfirmed={false}
      onFollowUp={() => undefined}
    />,
  );
});
function button(text: string): HTMLButtonElement {
  const found = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent?.trim() === text,
  );
  assert.ok(found, `missing ${text}`);
  return found;
}
await act(async () => {
  button("Review draft").click();
});
assert.ok(
  host.textContent?.includes("RAP setelah usulan: 350000"),
  "the visible budget comparison includes existing RAP, not only proposal addition",
);
assert.ok(
  host.textContent?.includes("Selisih35000"),
  "the visible warning names the excess of total planned RAP",
);
const input = host.querySelector<HTMLInputElement>('input[id$="requiredQuantity"]');
assert.ok(input);
await act(async () => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  assert.ok(set);
  set.call(input, "4");
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
assert.ok(button("Simpan draft RAP").disabled, "unapplied changes cannot save");
const apply = button("Terapkan koreksi");
await act(async () => {
  apply.click();
  apply.click();
});
assert.equal(patches.length, 1, "double Apply only sends one patch");
assert.deepEqual(patches[0], {
  conversationId: id,
  toolCallId: "call-rap",
  expectedRevision: 1,
  rows: [
    {
      rowId: id,
      fields: {
        area: "Area awal",
        requiredQuantity: 4,
        bufferQuantity: 0,
        estimatedUnitCost: 50000,
      },
    },
  ],
});
const fields: RapDraftFields = {
  area: "Area awal",
  requiredQuantity: 4,
  bufferQuantity: 0,
  estimatedUnitCost: 50000,
};
view = { ...view, revision: 2, proposal: applyRapDraftPatches(proposal, [{ rowId: id, fields }]) };
await act(async () => {
  resolvePatch?.({ success: true, data: view });
});
assert.equal(button("Terapkan koreksi"), apply, "Apply retains its target after success");
assert.ok(apply.disabled);
await act(async () => {
  apply.click();
});
assert.equal(saves.length, 0, "second click on Apply never becomes a business Save");
assert.equal(button("Simpan draft RAP").disabled, false);
await act(async () => {
  button("Simpan draft RAP").click();
});
assert.deepEqual(
  saves,
  [{ conversationId: id, toolCallId: "call-rap", expectedRevision: 2 }],
  "Save only sends reviewed identity/revision",
);
await act(async () => {
  root.unmount();
});
await browserWindow.happyDOM.close();
console.log("RAP draft proposal DOM passed");
