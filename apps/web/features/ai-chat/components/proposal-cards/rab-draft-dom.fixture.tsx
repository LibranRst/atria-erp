import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act, type ReactNode } from "react";
import {
  applyRabReview,
  rabDraftPatchSchema,
  rabDraftPayloadSchema,
  rabDraftProposalSchema,
  type RabDraftReceipt,
  type RabDraftView,
} from "@atria/core/ai/rab-draft";
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
const proposal = rabDraftProposalSchema.parse({
  kind: "RAB_DRAFT",
  projectId: id,
  projectName: "Fixture RAB",
  revision: 1,
  supersedesId: null,
  title: "RAB fixture",
  clientNotes: "",
  expectedContext: "a".repeat(64),
  rows: Array.from({ length: 6 }, (_, index) => {
    const rowId = `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    return {
      rowId,
      sourceId: rowId,
      sourceKind: "MATERIAL",
      sourceName: `Panel ${index + 1}`,
      sourceRevision: 1,
      clientLabel: `Panel ${index + 1}`,
      description: "Finishing untuk klien",
      quantity: 2,
      unit: "lembar",
      unitPrice: 10000,
      selected: true,
    };
  }),
});
let view: RabDraftView = {
  proposal,
  draftId: id,
  revision: 1,
  status: "READY",
  rabEstimateId: null,
};
let resolvePatch: ((result: ActionResponse<RabDraftView>) => void) | undefined,
  resolveSave: ((result: ActionResponse<RabDraftReceipt>) => void) | undefined;
const patches: unknown[] = [],
  saves: unknown[] = [];
mock.module("@/app/actions/ai/rab-draft", () => ({
  getAiRabDraftProposal: async () => ({ success: true, data: view }),
  patchAiRabDraftProposal: (input: unknown): Promise<ActionResponse<RabDraftView>> => {
    patches.push(input);
    return new Promise((resolve) => {
      resolvePatch = resolve;
    });
  },
  confirmAiRabDraftProposal: (input: unknown): Promise<ActionResponse<RabDraftReceipt>> => {
    saves.push(input);
    return new Promise((resolve) => {
      resolveSave = resolve;
    });
  },
}));
let presentation: "mobile" | "desktop" = "desktop";
mock.module("@/lib/navigation/workspace-presentation", () => ({
  useWorkspacePresentation: () => presentation,
}));
type Children = { readonly children?: ReactNode };
function Button({
  children,
  onClick,
  disabled,
}: Children & { readonly onClick?: () => void; readonly disabled?: boolean }): React.JSX.Element {
  return (
    <button onClick={onClick} disabled={disabled}>
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
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );
}
mock.module("@/components/ui", () => ({
  Button,
  ButtonLink: ({ children, href }: Children & { readonly href: string }) => (
    <a href={href}>{children}</a>
  ),
  AppIcon: () => null,
  MoneyValue: ({ amount }: { readonly amount: number }) => <span>{amount}</span>,
  FactRow: ({ label, value }: { readonly label: string; readonly value: ReactNode }) => (
    <p>
      {label}: {value}
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
  FormField: ({
    label,
    htmlFor,
    children,
  }: Children & { readonly label: string; readonly htmlFor?: string }) => (
    <label htmlFor={htmlFor}>
      {label}
      {children}
    </label>
  ),
  TextInput: Input,
  Textarea: Input,
  NumericInput: Input,
  MoneyInput: Input,
  ChoiceRow: ({
    title,
    checked,
    onChange,
    disabled,
  }: {
    readonly title: string;
    readonly checked: boolean;
    readonly onChange: (checked: boolean) => void;
    readonly disabled?: boolean;
  }) => (
    <button
      role="checkbox"
      aria-label={title}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      {title}
    </button>
  ),
  FormSheet: ({
    open,
    children,
    footer,
    desktopAsideSummary,
  }: Children & {
    readonly open: boolean;
    readonly footer: ReactNode;
    readonly desktopAsideSummary: ReactNode;
  }) =>
    open ? (
      <section>
        {children}
        {desktopAsideSummary}
        {footer}
      </section>
    ) : null,
  ConfirmationDialog: () => null,
  FormDisclosure: ({
    title,
    expanded,
    onToggle,
    children,
  }: Children & {
    readonly title: string;
    readonly expanded: boolean;
    readonly onToggle: () => void;
  }) => (
    <section>
      <Button onClick={onToggle}>{title}</Button>
      {expanded && children}
    </section>
  ),
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
const { RabDraftProposalCard } = await import("./rab-draft-proposal-card");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
function render(key = "ready"): void {
  root.render(
    <RabDraftProposalCard
      key={key}
      proposal={proposal}
      conversationId={id}
      toolCallId="call-rab"
      isStreaming={false}
      isBusy={false}
      alreadyConfirmed={false}
      onFollowUp={() => undefined}
    />,
  );
}
function button(text: string): HTMLButtonElement {
  const found = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.trim() === text,
  );
  assert.ok(found, `Missing ${text}`);
  return found;
}
await act(async () => render());
await act(async () => button("Review RAB").click());
assert.equal(
  host.querySelectorAll("[data-review-item]").length,
  5,
  "Desktop review has a five-row page",
);
const input = host.querySelector<HTMLInputElement>('input[id$="-unitPrice"]');
assert.ok(input);
await act(async () => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  assert.ok(set);
  set.call(input, "15000.25");
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
await act(async () => button("Berikutnya").click());
assert.equal(host.querySelectorAll("[data-review-item]").length, 1);
await act(async () => {
  const choice = host.querySelector<HTMLButtonElement>('[aria-label="Pilih Panel 6"]');
  assert.ok(choice);
  choice.click();
});
await act(async () => button("Sebelumnya").click());
assert.equal(
  host.querySelector<HTMLInputElement>('input[id$="-unitPrice"]')?.value,
  "15000.25",
  "Pagination retains local corrections",
);
assert.ok(button("Simpan draft RAB").disabled, "Business save cannot bypass Apply");
const apply = button("Terapkan koreksi");
await act(async () => {
  apply.click();
  apply.click();
});
assert.equal(patches.length, 1, "Double Apply coalesces");
const patchValue = rabDraftPatchSchema.parse(patches[0]);
const payload = rabDraftPayloadSchema.parse({
  conversationId: patchValue.conversationId,
  toolCallId: patchValue.toolCallId,
  title: patchValue.title,
  clientNotes: patchValue.clientNotes,
  rows: patchValue.rows,
});
view = { ...view, revision: 2, proposal: applyRabReview(proposal, payload) };
await act(async () => resolvePatch?.({ success: true, data: view }));
assert.equal(button("Terapkan koreksi"), apply, "Apply must not turn into Save under the pointer");
assert.ok(apply.disabled);
await act(async () => apply.click());
assert.equal(saves.length, 0);
await act(async () => {
  button("Simpan draft RAB").click();
  button("Simpan draft RAB").click();
});
assert.deepEqual(saves, [{ conversationId: id, toolCallId: "call-rab", expectedRevision: 2 }]);
await act(async () =>
  resolveSave?.({ success: true, data: { rabEstimateId: id, alreadyConfirmed: false } }),
);
assert.ok(host.textContent?.includes("Draft RAB tersimpan"));
assert.equal(
  host.querySelector('[aria-label="Pilih Panel 6"]'),
  null,
  "Receipt omits excluded rows",
);
assert.equal(
  host.querySelectorAll("[data-review-item]").length,
  5,
  "Receipt shows exactly the saved subset",
);
presentation = "mobile";
await act(async () => render());
assert.equal(button("Rincian").disabled, false, "Saved mobile details remain readable");
await act(async () => button("Rincian").click());
assert.ok(button("Ringkas"));
assert.equal(
  host.querySelectorAll("input").length,
  0,
  "Confirmed details cannot edit client fields",
);
assert.ok(host.querySelector('a[href^="/projects/"]'));
view = { ...view, status: "STALE" };
await act(async () => render("stale"));
await act(async () => button("Review RAB").click());
assert.ok(button("Simpan draft RAB").disabled, "Stale source cannot save");
await act(async () => root.unmount());
await browserWindow.happyDOM.close();
console.log("RAB draft DOM passed");
