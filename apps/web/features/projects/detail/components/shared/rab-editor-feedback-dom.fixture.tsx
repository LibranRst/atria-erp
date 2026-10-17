import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  rapRabFixtureData,
  rapRabFixturePermissions,
  type RapRabFixtureKind,
} from "../../../../../.storybook/rap-rab-data.fixture";

const browser = new Window({
  url: "https://atria.test/projects/fixture?tab=rab",
  width: 1440,
  height: 976,
});
Reflect.set(browser.Element.prototype, "animate", undefined);
for (const key of [
  "window",
  "document",
  "navigator",
  "performance",
  "CSS",
  "HTMLElement",
  "HTMLAnchorElement",
  "HTMLButtonElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "HTMLSelectElement",
  "Element",
  "Node",
  "NodeList",
  "HTMLCollection",
  "NodeFilter",
  "Event",
  "CustomEvent",
  "FocusEvent",
  "MouseEvent",
  "PointerEvent",
  "KeyboardEvent",
  "SVGElement",
  "MutationObserver",
  "ResizeObserver",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
]) {
  const value: unknown = key === "window" ? browser : Reflect.get(browser, key);
  Reflect.set(
    globalThis,
    key,
    typeof value === "function" &&
      ["getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"].includes(key)
      ? value.bind(browser)
      : value,
  );
}
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
const nextNavigation = await import("next/navigation");
let refreshes = 0;
mock.module("next/navigation", (): typeof nextNavigation => ({
  ...nextNavigation,
  usePathname: (): string => "/projects/fixture",
  useSearchParams: (): ReturnType<typeof nextNavigation.useSearchParams> =>
    new nextNavigation.ReadonlyURLSearchParams(window.location.search),
  useRouter: (): ReturnType<typeof nextNavigation.useRouter> => ({
    bfcacheId: "rab-editor-feedback",
    back: (): void => {},
    forward: (): void => {},
    refresh: (): void => {
      refreshes += 1;
    },
    push: (): void => {},
    replace: (): void => {},
    prefetch: (): void => {},
  }),
}));
const errors: string[] = [];
const successes: string[] = [];
mock.module("sonner", () => ({
  toast: {
    error: (message: string): void => {
      errors.push(message);
    },
    success: (message: string): void => {
      successes.push(message);
    },
    info: (): void => {},
  },
}));
interface RecordedCall {
  readonly operation: string;
  readonly args: readonly unknown[];
  readonly finish: (result: ActionResponse<unknown>) => void;
}
const calls: RecordedCall[] = [];
const failure: ActionResponse<never> = {
  success: false,
  error: { code: "CONFLICT", message: "Sumber berubah. Periksa kembali draft sebelum menyimpan." },
};
mock.module("@/lib/api/backend", () => ({
  callBackendAction: async (
    operation: string,
    args: readonly unknown[],
  ): Promise<ActionResponse<unknown>> =>
    new Promise<ActionResponse<unknown>>((finish) => {
      calls.push({ operation, args, finish });
    }),
  callBackendQuery: async (): Promise<ActionResponse<never>> => failure,
}));

const { createRoot } = await import("react-dom/client");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { useWorkspaceViewportPresentation } = await import("@/lib/navigation/workspace-viewport");
const { PermissionsProvider } = await import("@/components/auth/permissions-provider");
const { DesktopUIProvider } = await import("@/components/ui");
const { useRabManager } = await import("../../hooks/use-rab-manager");
const { useRapManager } = await import("../../hooks/use-rap-manager");
const { RapRabWorkflowDrawers } = await import("./rap-rab-workflow-drawers");
type Manager = ReturnType<typeof useRabManager>;
let observed: Manager | null = null;
let data = rapRabFixtureData("rab-draft");
let generation = 0;
function WorkflowOwner(): React.JSX.Element {
  const rabManager = useRabManager({ ...data, userRole: "OWNER" });
  const rapManager = useRapManager({ ...data, userRole: "OWNER" });
  React.useLayoutEffect(() => {
    observed = rabManager;
  });
  return <RapRabWorkflowDrawers {...data} rapManager={rapManager} rabManager={rabManager} />;
}
function Fixture(): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation();
  return (
    <WorkspacePresentationProvider presentation={presentation}>
      <DesktopUIProvider responsive>
        <PermissionsProvider permissions={rapRabFixturePermissions("owner")}>
          <WorkflowOwner key={generation} />
        </PermissionsProvider>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
function manager(): Manager {
  assert(observed);
  return observed;
}
async function settle(duration = 35): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, duration));
  });
}
async function render(width = 1440): Promise<void> {
  await act(async (): Promise<void> => {
    browser.happyDOM.setWindowSize({ width, height: 976 });
    window.dispatchEvent(new Event("resize"));
    root.render(<Fixture />);
  });
  await settle();
}
async function intent(run: (owner: Manager) => void): Promise<void> {
  await act(async (): Promise<void> => run(manager()));
  await settle();
}
function visible(element: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement)
    if (
      current.hasAttribute("hidden") ||
      current.hasAttribute("inert") ||
      current.getAttribute("aria-hidden") === "true" ||
      getComputedStyle(current).display === "none"
    )
      return false;
  return true;
}
function dialog(title: string): HTMLElement {
  const found = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].find(
    (item) => {
      const label =
        item.getAttribute("aria-label") ??
        (item.getAttribute("aria-labelledby") ?? "")
          .split(" ")
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" ")
          .trim();
      return visible(item) && label === title;
    },
  );
  assert(found instanceof HTMLElement, `Actual ${title} editor is open`);
  return found;
}
function button(container: ParentNode, label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find(
    (item) => visible(item) && item.textContent?.trim() === label,
  );
  assert(found instanceof HTMLButtonElement, `Visible ${label} action exists`);
  return found;
}
async function click(control: HTMLElement): Promise<void> {
  await act(async (): Promise<void> => control.click());
  await settle();
}
async function requestClose(editor: HTMLElement): Promise<void> {
  const close = editor.querySelector('button[aria-label="Tutup"]');
  assert(close instanceof HTMLElement);
  await click(close);
}
async function discard(editor: HTMLElement): Promise<void> {
  await requestClose(editor);
  await click(button(dialog("Buang perubahan?"), "Buang perubahan"));
  await settle(400);
}
async function type(input: HTMLInputElement | HTMLTextAreaElement, value: string): Promise<void> {
  const prototype =
    input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  assert(setter);
  await act(async (): Promise<void> => {
    input.focus();
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
}
async function finish(index: number, result: ActionResponse<unknown>): Promise<void> {
  const call = calls[index];
  assert(call);
  await act(async (): Promise<void> => call.finish(result));
  await settle();
}
function firstItem(): NonNullable<typeof data.rabEstimate>["items"][number] {
  const item = data.rabEstimate?.items[0];
  assert(item);
  return item;
}
function setUp(kind: RapRabFixtureKind): void {
  data = rapRabFixtureData(kind);
  generation += 1;
}
interface EditorCase {
  readonly key: "item" | "manual" | "bundle" | "source" | "change-order" | "void";
  readonly fixture: RapRabFixtureKind;
  readonly title: string;
  readonly submit: string;
  readonly operation: string;
  readonly open: (owner: Manager) => void;
  readonly seed: (owner: Manager) => void;
  readonly save: (owner: Manager) => void;
  readonly snapshot: (owner: Manager) => unknown;
  readonly mutatePending: (owner: Manager) => void;
}
const cases: readonly EditorCase[] = [
  {
    key: "item",
    fixture: "rab-draft",
    title: "Edit Item RAB",
    submit: "Simpan",
    operation: ".updateRabEstimateItem",
    open: (owner): void => owner.setRabItemEditorId(firstItem().id),
    seed: (owner): void =>
      owner.handleRabEditChange(firstItem(), { clientLabel: "Item fixture dikoreksi" }),
    save: (owner): void => owner.handleSaveRabItem(firstItem()),
    snapshot: (owner): unknown => owner.rabDraftEdits,
    mutatePending: (owner): void =>
      owner.handleRabEditChange(firstItem(), {
        clientLabel: "Pending tidak boleh masuk",
        unit: "set",
      }),
  },
  {
    key: "manual",
    fixture: "rab-draft",
    title: "Tambah Item Manual",
    submit: "Tambah",
    operation: ".addRabManualItem",
    open: (owner): void => owner.setManualLineOpen(true),
    seed: (owner): void =>
      owner.setManualQuotationLine((current) => ({
        ...current,
        clientLabel: "Item manual fixture",
        unitPrice: "250000.25",
      })),
    save: (owner): void => owner.handleAddManualRabItem(),
    snapshot: (owner): unknown => owner.manualQuotationLine,
    mutatePending: (owner): void =>
      owner.setManualQuotationLine((current) => ({
        ...current,
        clientLabel: "Pending tidak boleh masuk",
        unit: "set",
      })),
  },
  {
    key: "bundle",
    fixture: "rab-draft",
    title: "Buat Paket RAB",
    submit: "Simpan",
    operation: ".createRabBundle",
    open: (owner): void => owner.openCreateBundle(),
    seed: (owner): void => {
      const ids =
        data.rabEstimate?.items
          .filter((item) => !item.bundleId && !item.isHidden)
          .slice(0, 2)
          .map((item) => item.id) ?? [];
      assert.equal(ids.length, 2);
      owner.setBundleForm((current) => ({
        ...current,
        clientLabel: "Paket fixture",
        itemIds: ids,
        unitPrice: "400000.25",
      }));
    },
    save: (owner): void => owner.handleSaveBundle(),
    snapshot: (owner): unknown => owner.bundleForm,
    mutatePending: (owner): void => {
      owner.setBundleForm((current) => ({
        ...current,
        clientLabel: "Pending tidak boleh masuk",
        unit: "set",
      }));
      owner.toggleBundleItem(firstItem().id);
    },
  },
  {
    key: "source",
    fixture: "rab-empty",
    title: "Pilih Sumber RAB",
    submit: "Buat",
    operation: ".generateRabFromSelectedSources",
    open: (owner): void => owner.setSourcePickerOpen(true),
    seed: (): void => {},
    save: (owner): void => owner.handleGenerateRab(),
    snapshot: (owner): unknown => [
      owner.selectedRapQuotationIds,
      owner.selectedCategoryQuotationIds,
      owner.selectedBaselineManualItemIds,
      owner.manualQuotationLine,
    ],
    mutatePending: (owner): void => {
      owner.setSelectedRapQuotationIds([]);
      owner.setSelectedCategoryQuotationIds([]);
      owner.setSelectedBaselineManualItemIds([]);
      owner.setManualQuotationLine((current) => ({
        ...current,
        clientLabel: "Pending tidak boleh masuk",
      }));
    },
  },
  {
    key: "change-order",
    fixture: "rab-revision",
    title: "Tinjau Change Order",
    submit: "Catat persetujuan klien",
    operation: ".createProjectChangeOrder",
    open: (owner): void => owner.setChangeOrderOpen(true),
    seed: (owner): void =>
      owner.setChangeOrderForm({
        reason: "Perubahan lingkup fixture",
        scopeSummary: "Tambah lingkup pekerjaan fixture",
        clientReference: "Surat persetujuan fixture",
        clientConfirmedAt: "2026-10-17",
      }),
    save: (owner): void => owner.handleApproveChangeOrder(),
    snapshot: (owner): unknown => owner.changeOrderForm,
    mutatePending: (owner): void =>
      owner.setChangeOrderForm((current) => ({ ...current, reason: "Pending tidak boleh masuk" })),
  },
  {
    key: "void",
    fixture: "rab-revision",
    title: "Batalkan Revisi?",
    submit: "Batalkan Revisi",
    operation: ".voidRabRevision",
    open: (owner): void => owner.setVoidRevisionOpen(true),
    seed: (owner): void => owner.setVoidReason("Alasan fixture"),
    save: (owner): void => owner.handleVoidRabRevision(),
    snapshot: (owner): unknown => owner.voidReason,
    mutatePending: (owner): void => owner.setVoidReason("Pending tidak boleh masuk"),
  },
];

for (const scenario of cases) {
  setUp(scenario.fixture);
  await render();
  await intent(scenario.open);
  await intent(scenario.seed);
  if (scenario.key === "change-order")
    await click(button(dialog("Proses Change Order"), "Lanjut Tinjau"));
  const editor = dialog(scenario.title);
  const snapshot = JSON.stringify(scenario.snapshot(manager()));
  const editable = editor.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]),textarea',
  );
  const selectedUnit = [...editor.querySelectorAll('button[aria-haspopup="listbox"]')].find(
    (control) =>
      (control.getAttribute("aria-labelledby") ?? "")
        .split(" ")
        .some((id) => document.getElementById(id)?.textContent?.trim() === "Satuan"),
  );
  let pendingOption: HTMLElement | null = null;
  if (selectedUnit instanceof HTMLElement) {
    await click(selectedUnit);
    const option = [...document.querySelectorAll('[role="option"]')].find(
      (candidate) => visible(candidate) && candidate.getAttribute("aria-selected") !== "true",
    );
    assert(option instanceof HTMLElement);
    pendingOption = option;
  }
  const start = calls.length,
    errorStart = errors.length,
    successStart = successes.length,
    refreshStart = refreshes;
  await intent(scenario.save);
  assert.equal(calls.length, start + 1);
  assert(calls[start]?.operation.endsWith(scenario.operation));
  assert(manager().isPending);
  await intent(scenario.save);
  await intent(scenario.mutatePending);
  assert.equal(calls.length, start + 1, `${scenario.key}: duplicate invocation has no writer`);
  assert.equal(
    JSON.stringify(scenario.snapshot(manager())),
    snapshot,
    `${scenario.key}: pending intent is frozen`,
  );
  for (const control of editor.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'input:not([type="hidden"]),textarea',
  ))
    assert(control.disabled, `${scenario.key}: editable field disables while pending`);
  for (const control of editor.querySelectorAll<HTMLButtonElement>(
    'button[role="checkbox"],button[role="radio"],button[aria-haspopup],button[aria-pressed]',
  ))
    assert(
      control.disabled || control.getAttribute("aria-disabled") === "true",
      `${scenario.key}: selection control disables while pending`,
    );
  if (editable) await type(editable, "Pending tidak boleh masuk");
  if (pendingOption?.isConnected && visible(pendingOption)) await click(pendingOption);
  assert.equal(
    JSON.stringify(scenario.snapshot(manager())),
    snapshot,
    `${scenario.key}: pending DOM/portaled events cannot change intent`,
  );
  await finish(start, failure);
  assert(!manager().isPending);
  assert(
    Boolean(dialog(scenario.title) === editor),
    `${scenario.key}: failure retains the real overlay owner`,
  );
  assert.equal(JSON.stringify(scenario.snapshot(manager())), snapshot);
  const alert = editor.querySelector('[role="alert"]');
  assert(
    alert && visible(alert) && alert.textContent?.includes("Sumber berubah"),
    `${scenario.key}: failure is inside the active modal`,
  );
  assert.equal(errors.length, errorStart + 1, `${scenario.key}: one failure toast`);
  assert.equal(successes.length, successStart);
  if (editable) {
    const value =
      editable instanceof HTMLTextAreaElement
        ? "Alasan koreksi fixture berikutnya"
        : "Nama koreksi fixture berikutnya";
    await type(editable, value);
    assert.notEqual(JSON.stringify(scenario.snapshot(manager())), snapshot);
    await render(390);
    assert(Boolean(dialog(scenario.title) === editor));
    assert(Boolean(document.activeElement === editable));
    await render(1440);
  } else if (scenario.key === "source") {
    const choice = editor.querySelector('button[aria-pressed="true"]');
    assert(choice instanceof HTMLButtonElement && !choice.disabled);
    await click(choice);
    assert.notEqual(JSON.stringify(scenario.snapshot(manager())), snapshot);
  }
  await click(button(editor, scenario.submit));
  assert.equal(calls.length, start + 2, `${scenario.key}: explicit retry creates only one write`);
  assert.equal(editor.querySelectorAll('[role="alert"]').length, 0);
  await finish(start + 1, {
    success: true,
    data: { id: "fixture-change-order", lineTotal: "250000.25" },
  });
  if (scenario.key === "change-order") {
    assert.equal(calls.length, start + 3);
    assert(calls[start + 2]?.operation.endsWith(".confirmChangeOrderClient"));
    await finish(start + 2, { success: true, data: null });
  }
  assert.equal(successes.length, successStart + 1, `${scenario.key}: one success toast`);
  assert.equal(errors.length, errorStart + 1);
  assert.equal(refreshes, refreshStart + 1);
}

setUp("rab-draft");
await render();
await intent((owner): void => owner.setRabItemEditorId(firstItem().id));
await intent((owner): void =>
  owner.handleRabEditChange(firstItem(), { clientLabel: "Koreksi sebelum konflik" }),
);
const failedEditor = dialog("Edit Item RAB");
const failedWrite = calls.length;
await click(button(failedEditor, "Simpan"));
await finish(failedWrite, failure);
const close = failedEditor.querySelector('button[aria-label="Tutup"]');
assert(close instanceof HTMLElement);
await click(close);
await click(button(dialog("Buang perubahan?"), "Buang perubahan"));
const writesBeforeOpening = calls.length,
  errorsBeforeOpening = errors.length;
await intent((owner): void => owner.setManualLineOpen(true));
assert.equal(dialog("Tambah Item Manual").querySelectorAll('[role="alert"]').length, 0);
assert.equal(calls.length, writesBeforeOpening);
assert.equal(errors.length, errorsBeforeOpening);
assert(
  !calls.some((call) => call.operation.endsWith(".approveProjectChangeOrder")),
  "Recording client confirmation never approves the change order",
);

setUp("rab-draft");
await render();
await intent((owner): void => owner.setManualLineOpen(true));
const originalManual = JSON.stringify(manager().manualQuotationLine);
await intent((owner): void =>
  owner.setManualQuotationLine((current) => ({
    ...current,
    clientLabel: "Isian yang dibuang",
    quantity: "7.50",
    unit: "set",
    unitPrice: "12345.67",
    itemNature: "SERVICE_FEE",
  })),
);
const callsBeforeDiscard = calls.length;
await discard(dialog("Tambah Item Manual"));
await intent((owner): void => owner.setManualLineOpen(true));
assert.equal(
  JSON.stringify(manager().manualQuotationLine),
  originalManual,
  "Explicit manual discard restores every field to the existing empty manual intent",
);
await requestClose(dialog("Tambah Item Manual"));
await settle(400);
assert.equal(
  calls.length,
  callsBeforeDiscard,
  "Discarding and reopening manual input never saves it",
);

setUp("complete");
await render();
await intent((owner): void => owner.setSourcePickerOpen(true));
function sourceChoices(): string {
  return JSON.stringify({
    rap: manager().selectedRapQuotationIds,
    packages: manager().selectedCategoryQuotationIds,
    manual: manager().selectedBaselineManualItemIds,
  });
}
const authoritativeChoices = sourceChoices();
assert(
  manager().selectedRapQuotationIds.length > 0 &&
    manager().selectedCategoryQuotationIds.length > 0 &&
    manager().selectedBaselineManualItemIds.length > 0,
  "The fixture includes authoritative material, package and manual baseline sources",
);
await intent((owner): void => {
  owner.setSelectedRapQuotationIds((current) => current.slice(1));
  owner.setSelectedCategoryQuotationIds((current) => current.slice(1));
  owner.setSelectedBaselineManualItemIds((current) => current.slice(1));
});
const editedChoices = sourceChoices();
assert.notEqual(editedChoices, authoritativeChoices);
await requestClose(dialog("Buat Revisi RAB"));
await click(button(dialog("Buang perubahan?"), "Batal"));
assert.equal(sourceChoices(), editedChoices, "Canceling discard keeps corrected source intent");
await discard(dialog("Buat Revisi RAB"));
await intent((owner): void => owner.setSourcePickerOpen(true));
assert.equal(
  sourceChoices(),
  authoritativeChoices,
  "Source discard restores the existing initial-source rules, including baseline manual items",
);
assert.equal(calls.length, callsBeforeDiscard);

setUp("rab-empty");
await render();
await intent((owner): void => owner.setSourcePickerOpen(true));
const initialEmptySourceChoices = sourceChoices();
const sourceEditor = dialog("Pilih Sumber RAB");
const manualSwitch = sourceEditor.querySelector('input[type="checkbox"]');
assert(manualSwitch instanceof HTMLElement);
await click(manualSwitch);
const manualInput = sourceEditor.querySelector<HTMLInputElement>(
  'input[placeholder="Contoh: Koordinasi Design"]',
);
assert(manualInput, "The optional manual entry is expanded in the actual source form");
await type(manualInput, "Manual sumber yang dibuang");
await discard(sourceEditor);
await intent((owner): void => owner.setSourcePickerOpen(true));
assert.equal(sourceChoices(), initialEmptySourceChoices);
assert.equal(manager().manualQuotationLine.clientLabel, "");
const reopenedManualSwitch = dialog("Pilih Sumber RAB").querySelector('input[type="checkbox"]');
assert(
  reopenedManualSwitch instanceof HTMLInputElement && !reopenedManualSwitch.checked,
  "Explicit source discard resets the optional manual-entry switch; presence may retain exiting nodes",
);
assert.equal(calls.length, callsBeforeDiscard);

setUp("rab-draft");
await render();
const bundle = data.rabEstimate?.bundles[0];
assert(bundle);
await intent((owner): void => owner.openEditBundle(bundle));
const bundleEditor = dialog("Edit Paket RAB");
const originalBundle = JSON.stringify(manager().bundleForm);
const deleteStart = calls.length,
  deleteErrors = errors.length,
  deleteSuccesses = successes.length;
await click(button(bundleEditor, "Bongkar Paket"));
await click(button(dialog("Bongkar paket RAB?"), "Bongkar Paket"));
assert(
  manager().isPending && manager().bundleEditorOpen,
  "The parent stays open during bundle deletion",
);
assert.equal(calls.length, deleteStart + 1);
assert(calls[deleteStart]?.operation.endsWith(".deleteRabBundle"));
await intent((owner): void => owner.handleDeleteBundle(bundle.id));
assert.equal(calls.length, deleteStart + 1, "Pending bundle deletion cannot be submitted twice");
await finish(deleteStart, failure);
assert(Boolean(dialog("Edit Paket RAB") === bundleEditor));
assert.equal(JSON.stringify(manager().bundleForm), originalBundle);
assert(
  bundleEditor.querySelector('[role="alert"]')?.textContent?.includes("Sumber berubah"),
  "Failed bundle deletion retains its context and visible retry feedback",
);
assert.equal(errors.length, deleteErrors + 1);
await click(button(bundleEditor, "Bongkar Paket"));
await click(button(dialog("Bongkar paket RAB?"), "Bongkar Paket"));
assert.equal(calls.length, deleteStart + 2, "Only explicit confirmation retries bundle deletion");
for (const call of calls.slice(deleteStart)) {
  const payload = call.args[0];
  assert(payload && typeof payload === "object" && "bundleId" in payload);
  assert.equal(payload.bundleId, bundle.id);
}
await finish(deleteStart + 1, { success: true, data: null });
assert(!manager().bundleEditorOpen, "Successful deletion closes the parent editor");
assert.equal(successes.length, deleteSuccesses + 1);
assert.equal(errors.length, deleteErrors + 1);
await act(async (): Promise<void> => root.unmount());
await browser.happyDOM.abort();
console.log("RAB editor feedback DOM regression passed");
