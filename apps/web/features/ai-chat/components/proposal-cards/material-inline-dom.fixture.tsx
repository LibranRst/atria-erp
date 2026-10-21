import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act, type ReactNode } from "react";
import {
  materialDraftPayloadSchema,
  materialPatchSchema,
  materialSelectionSchema,
  type MaterialDraftView,
} from "@atria/core/ai/material-import";
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
let draft: MaterialDraftView = {
  id,
  revision: 1,
  canCreateVendor: false,
  options: { categories: ["Papan"], locations: ["Gudang"], vendors: [] },
  payload: materialDraftPayloadSchema.parse({
    conversationId: id,
    toolCallId: "fixture",
    analysisStatus: "READY",
    rows: Array.from({ length: 3 }, (_, index) => ({
      id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      fields: {
        name: `Panel ${index + 1}`,
        categoryName: "Papan",
        unit: "lembar",
        locationName: "Gudang",
        withoutVendor: true,
        lastPurchasePrice: 100000,
      },
      source: { row: index + 1, raw: `Panel ${index + 1}` },
      selected: true,
      issues: [],
    })),
  }),
};
const patches: unknown[] = [],
  saves: unknown[] = [];
const selections: {
  input: ReturnType<typeof materialSelectionSchema.parse>;
  resolve: (result: ActionResponse<MaterialDraftView>) => void;
}[] = [];
const progressReads: {
  readonly draftId: string;
  readonly resolve: (result: ActionResponse<MaterialDraftView>) => void;
}[] = [];
let deferProgressReads = false;
mock.module("@/app/actions/ai/material-master", () => ({
  startAiMaterialAnalysis: async () => ({ success: true, data: draft }),
  getAiMaterialDraft: (input: {
    readonly draftId: string;
  }): Promise<ActionResponse<MaterialDraftView>> =>
    deferProgressReads
      ? new Promise((resolve) => progressReads.push({ draftId: input.draftId, resolve }))
      : Promise.resolve({ success: true, data: draft }),
  patchAiMaterialDraft: async (input: unknown) => {
    patches.push(input);
    const parsed = materialPatchSchema.parse(input);
    draft = {
      ...draft,
      revision: draft.revision + 1,
      payload: {
        ...draft.payload,
        rows: draft.payload.rows.map((row) => {
          const change = parsed.rows.find((r) => r.id === row.id);
          return change ? { ...row, fields: change.fields, selected: change.selected } : row;
        }),
      },
    };
    return { success: true, data: draft };
  },
  selectAiMaterialRows: (input: unknown) =>
    new Promise<ActionResponse<MaterialDraftView>>((resolve) => {
      selections.push({ input: materialSelectionSchema.parse(input), resolve });
    }),
  saveAiMaterialRows: async (input: unknown) => {
    saves.push(input);
    return { success: true, data: draft };
  },
  confirmAiMaterialReference: async () => ({ success: true, data: draft }),
  retryAiMaterialAnalysis: async () => ({ success: true, data: draft }),
  discardAiMaterialDraft: async () => ({ success: true, data: draft }),
}));
mock.module("@/lib/navigation/workspace-presentation", () => ({
  useWorkspacePresentation: () => "desktop",
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
  value,
  onChange,
  disabled,
}: {
  readonly value: string | number;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
}): React.JSX.Element {
  return (
    <input
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );
}
mock.module("@/components/ui", () => ({
  Button,
  AppIcon: () => null,
  IconButton: () => null,
  ActionMenu: () => null,
  ConfirmationDialog: () => null,
  InlineReviewStrip: () => null,
  SegmentedTabs: () => null,
  FormRiskNotice: ({ children }: Children) => <section>{children}</section>,
  FormSection: ({ children }: Children) => <section>{children}</section>,
  FormField: ({ label, children }: Children & { readonly label: string }) => (
    <label>
      {label}
      {children}
    </label>
  ),
  TextInput: Input,
  Textarea: Input,
  MoneyInput: Input,
  NumericInput: Input,
  ComboboxField: ({
    label,
    value,
    onChange,
  }: {
    readonly label: string;
    readonly value: string;
    readonly onChange: (value: string) => void;
  }) => (
    <label>
      {label}
      <Input value={value} onChange={onChange} />
    </label>
  ),
  SwitchRow: () => null,
  COMMON_UNIT_OPTIONS: [],
  MoneyValue: ({ amount }: { readonly amount: number }) => <span>{amount}</span>,
  StatusBadge: () => null,
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
      aria-checked={checked}
      aria-label={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  ),
  ReviewCollection: ({ children }: Children) => <ul>{children}</ul>,
  ReviewItem: ({
    title,
    selection,
    editor,
    onToggle,
    disabled,
  }: {
    readonly title: ReactNode;
    readonly selection?: ReactNode;
    readonly editor?: ReactNode;
    readonly onToggle?: () => void;
    readonly disabled?: boolean;
  }) => (
    <li>
      {title}
      {selection}
      {onToggle ? (
        <Button disabled={disabled} onClick={onToggle}>
          Edit {title}
        </Button>
      ) : null}
      {editor}
    </li>
  ),
  WorkflowFormSheet: ({
    open,
    children,
    desktopAsideSummary,
    primaryLabel,
    onPrimary,
    disabled,
  }: Children & {
    readonly open: boolean;
    readonly desktopAsideSummary?: ReactNode;
    readonly primaryLabel: string;
    readonly onPrimary: () => void;
    readonly disabled: boolean;
  }) =>
    open ? (
      <section>
        {children}
        {desktopAsideSummary}
        <Button disabled={disabled} onClick={onPrimary}>
          {primaryLabel}
        </Button>
      </section>
    ) : null,
  FormDisclosure: () => null,
  GroupedSurface: ({ children }: Children) => <section>{children}</section>,
  FactRow: ({ label, value }: { readonly label: string; readonly value: ReactNode }) => (
    <p>
      {label}: {value}
    </p>
  ),
  useSheetPresenceValue: (value: unknown) => ({
    presentedValue: value,
    handleExitComplete: () => undefined,
  }),
}));
mock.module("./proposal-card-shell", () => ({
  ProposalCardShell: ({
    children,
    confirmLabel,
    onConfirm,
  }: Children & { readonly confirmLabel: string; readonly onConfirm: () => void }) => (
    <section>
      {children}
      <Button onClick={onConfirm}>{confirmLabel}</Button>
    </section>
  ),
}));
const { createRoot } = await import("react-dom/client"),
  { MaterialMasterProposalCard } = await import("./material-master-proposal-card");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
await act(async () =>
  root.render(<MaterialMasterProposalCard conversationId={id} toolCallId="fixture" />),
);
function button(text: string): HTMLButtonElement {
  const found = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.trim() === text,
  );
  assert.ok(found, `Missing ${text}`);
  return found;
}
function nameInput(): HTMLInputElement {
  const label = [...host.querySelectorAll("label")].find((e) => e.textContent?.startsWith("Nama"));
  const input = label?.querySelector("input");
  assert.ok(input);
  return input;
}
async function changeName(value: string): Promise<void> {
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    assert.ok(set);
    const input = nameInput();
    set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
await act(async () => button("Tinjau 3 material").click());
await act(async () => button("Edit Panel 1").click());
await changeName("Panel pertama koreksi");
assert.ok(
  host.querySelector<HTMLButtonElement>('[aria-label="Pilih Panel 2"]')?.disabled,
  "Dirty corrections cannot race selection writes",
);
await act(async () => button("Edit Panel 2").click());
await changeName("Panel kedua koreksi");
await act(async () => button("Edit Panel 1").click());
assert.equal(nameInput().value, "Panel pertama koreksi", "Switching rows retains pending fields");
await act(async () => button("Konfirmasi 2 koreksi").click());
assert.equal(patches.length, 1);
const patched = materialPatchSchema.parse(patches[0]);
assert.equal(patched.expectedRevision, 1);
assert.deepEqual(
  patched.rows.map((r) => r.fields.name).sort(),
  ["Panel kedua koreksi", "Panel pertama koreksi"].sort(),
);
assert.equal(saves.length, 0, "Apply is metadata, not business Save");
function checkbox(name: string): HTMLButtonElement {
  const found = host.querySelector<HTMLButtonElement>(`[aria-label="Pilih ${name}"]`);
  assert.ok(found);
  return found;
}
async function acceptSelection(index: number): Promise<void> {
  const request = selections[index];
  assert.ok(request);
  assert.equal(request.input.expectedRevision, draft.revision, "Queue uses acknowledged revision");
  draft = {
    ...draft,
    revision: draft.revision + 1,
    payload: {
      ...draft.payload,
      rows: draft.payload.rows.map((row) => ({
        ...row,
        selected: request.input.selectedRowIds.includes(row.id),
      })),
    },
  };
  await act(async () => request.resolve({ success: true, data: draft }));
}
await act(async () => checkbox("Panel pertama koreksi").click());
assert.equal(
  checkbox("Panel pertama koreksi").getAttribute("aria-checked"),
  "false",
  "Selection responds before the server returns",
);
assert.equal(
  checkbox("Panel kedua koreksi").disabled,
  false,
  "Other choices stay usable during autosave",
);
await act(async () => checkbox("Panel kedua koreksi").click());
assert.equal(checkbox("Panel kedua koreksi").getAttribute("aria-checked"), "false");
assert.equal(selections.length, 1, "Selection writes are serialized");
assert.equal(
  button("Simpan 1 material").disabled,
  true,
  "Business save waits for selection acknowledgement",
);
await acceptSelection(0);
assert.equal(selections.length, 2, "Latest choices flush after the first response");
assert.equal(
  checkbox("Panel kedua koreksi").getAttribute("aria-checked"),
  "false",
  "Older response cannot undo the latest choice",
);
await acceptSelection(1);
assert.deepEqual(
  draft.payload.rows.filter((row) => row.selected).map((row) => row.fields.name),
  ["Panel 3"],
);
assert.equal(button("Simpan 1 material").disabled, false);
await act(async () => checkbox("Panel pertama koreksi").click());
await act(async () =>
  selections[2].resolve({ success: false, error: { code: "CONFLICT", message: "Draft berubah." } }),
);
assert.equal(
  checkbox("Panel pertama koreksi").getAttribute("aria-checked"),
  "true",
  "Failed autosave retains the visible choice",
);
assert.equal(button("Simpan 2 material").disabled, true);
draft = { ...draft, revision: draft.revision + 1 };
await act(async () => button("Coba simpan pilihan lagi").click());
await acceptSelection(3);
assert.equal(button("Simpan 2 material").disabled, false);
assert.equal(saves.length, 0, "Selecting and retrying never create business records");
await act(async () => {
  checkbox("Panel pertama koreksi").click();
  checkbox("Panel kedua koreksi").click();
});
assert.equal(
  checkbox("Panel pertama koreksi").getAttribute("aria-checked"),
  "false",
  "Batched clicks retain the first intention",
);
assert.equal(checkbox("Panel kedua koreksi").getAttribute("aria-checked"), "true");
await acceptSelection(4);
await acceptSelection(5);
assert.deepEqual(
  draft.payload.rows.filter((row) => row.selected).map((row) => row.fields.name),
  ["Panel kedua koreksi", "Panel 3"],
);

const pollTimers: { readonly id: number; readonly tick: () => void; cleared: boolean }[] = [];
const nativeSetInterval = window.setInterval.bind(window);
const nativeClearInterval = window.clearInterval.bind(window);
Object.defineProperty(window, "setInterval", {
  configurable: true,
  writable: true,
  value: (handler: TimerHandler, timeout?: number, ...args: unknown[]): number => {
    if (timeout !== 2500) return nativeSetInterval(handler, timeout, ...args);
    assert.equal(typeof handler, "function");
    const timer = {
      id: 10000 + pollTimers.length,
      tick: (): void => {
        if (typeof handler === "function") handler(...args);
      },
      cleared: false,
    };
    pollTimers.push(timer);
    return timer.id;
  },
});
Object.defineProperty(window, "clearInterval", {
  configurable: true,
  writable: true,
  value: (timerId: number | undefined): void => {
    const timer = pollTimers.find((entry) => entry.id === timerId);
    if (timer) timer.cleared = true;
    else nativeClearInterval(timerId);
  },
});
draft = {
  ...draft,
  revision: 100,
  payload: {
    ...draft.payload,
    analysisStatus: "QUEUED",
    progress: 0,
    rows: draft.payload.rows.map((row) => ({ ...row, selected: true })),
  },
};
deferProgressReads = true;
await act(async () =>
  root.render(<MaterialMasterProposalCard key="poll" conversationId={id} toolCallId="poll" />),
);
assert.equal(pollTimers.length, 1, "queued analysis starts one polling interval");
assert.match(host.textContent ?? "", /0 baris diproses/);
await act(async () =>
  root.render(
    <MaterialMasterProposalCard key="poll" conversationId={id} toolCallId="poll" isStreaming />,
  ),
);
await act(async () =>
  root.render(<MaterialMasterProposalCard key="poll" conversationId={id} toolCallId="poll" />),
);
assert.equal(pollTimers.length, 1, "unrelated renders preserve the polling cadence");
await act(async () => {
  pollTimers[0]!.tick();
  pollTimers[0]!.tick();
});
assert.equal(progressReads.length, 2);
assert.equal(progressReads[0]!.draftId, id);
draft = {
  ...draft,
  revision: 101,
  payload: { ...draft.payload, analysisStatus: "PROCESSING", progress: 1 },
};
await act(async () => progressReads[0]!.resolve({ success: true, data: draft }));
assert.equal(pollTimers[0]!.cleared, true, "a status transition disposes the old interval");
assert.equal(pollTimers.length, 2);
assert.match(host.textContent ?? "", /1 baris diproses/);
await act(async () =>
  progressReads[1]!.resolve({
    success: true,
    data: { ...draft, revision: 102, payload: { ...draft.payload, analysisStatus: "FAILED" } },
  }),
);
assert.match(
  host.textContent ?? "",
  /1 baris diproses/,
  "a late response from the disposed interval is ignored",
);
assert.doesNotMatch(host.textContent ?? "", /Analisis perlu dicoba ulang/);
await act(async () => pollTimers[1]!.tick());
draft = {
  ...draft,
  revision: 103,
  payload: { ...draft.payload, analysisStatus: "READY", progress: 3 },
};
await act(async () => progressReads[2]!.resolve({ success: true, data: draft }));
assert.match(host.textContent ?? "", /Semua 3 material dipilih/);
assert.equal(pollTimers[1]!.cleared, true, "ready analysis stops polling");
assert.equal(pollTimers.filter((timer) => !timer.cleared).length, 0);
draft = { ...draft, revision: 104, payload: { ...draft.payload, analysisStatus: "PROCESSING" } };
await act(async () =>
  root.render(
    <MaterialMasterProposalCard key="poll-unmount" conversationId={id} toolCallId="poll-unmount" />,
  ),
);
assert.equal(pollTimers.length, 3);
await act(async () => root.unmount());
assert.equal(pollTimers[2]!.cleared, true, "unmount cleans up an active polling interval");
window.setInterval = nativeSetInterval;
window.clearInterval = nativeClearInterval;
assert.equal(saves.length, 0, "polling never creates business records");
await browserWindow.happyDOM.close();
console.log("Material inline DOM passed");
