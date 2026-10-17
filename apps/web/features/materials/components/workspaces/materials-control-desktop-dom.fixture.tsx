import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import { z } from "zod";
import type { MaterialDesktopWorkspace } from "../desktop/material-desktop-workspace";
import type { StockCountSheet } from "../sheets/stock-count-sheet";
import type { TransferSheet } from "../sheets/transfer-sheet";
import type { GoodsReceiptSheetProps } from "../sheets/goods-receipt-types";
import type { MaterialOperationsDashboard } from "@/app/actions/material/operations-dashboard";
import type { CurrentUserProfile } from "@/components/auth/permissions-provider";
import type { PermissionKey } from "@atria/core/auth/permissions";
import type {
  MaterialDesktopActivityData,
  MaterialDesktopActivityInput,
} from "@atria/core/material/material-desktop";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  materialsFixtureCounts,
  materialsFixtureData,
} from "../../../../.storybook/materials-data.fixture";

const browser = new Window({ url: "https://atria.test/materials", width: 1440 });
for (const key of [
  "window",
  "document",
  "navigator",
  "performance",
  "CSS",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLButtonElement",
  "HTMLTextAreaElement",
  "HTMLSelectElement",
  "Element",
  "Node",
  "NodeList",
  "HTMLCollection",
  "NodeFilter",
  "Event",
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

function Nothing(): null {
  return null;
}
mock.module("@/components/ui", () => ({
  AppIcon: Nothing,
  Badge: Nothing,
  ConfirmationDialog: Nothing,
  OperationSuccessDialog: Nothing,
  PageHeader: Nothing,
  SwitchRow: Nothing,
  Textarea: Nothing,
  PageState: Nothing,
}));
let currentActor: CurrentUserProfile = {
  id: "actor-one",
  sessionId: "session-one",
  roleId: "owner",
  dataScope: "GLOBAL",
  name: "Fixture",
  image: null,
};
let actorPermissions: readonly PermissionKey[] = ["view:inventory"];
mock.module("@/components/auth/permissions-provider", () => ({
  useCan: () => (): boolean => true,
  useCurrentUserProfile: () => currentActor,
  usePermissions: () => actorPermissions,
}));
mock.module("next/navigation", () => ({
  useSearchParams: (): URLSearchParams => new URLSearchParams(window.location.search),
}));
mock.module("@/lib/navigation/workspace-navigation", () => ({
  useRouter: () => ({
    refresh: (): void => undefined,
    replace: (href: string): void => window.history.replaceState({}, "", href),
  }),
}));
mock.module("sonner", () => ({
  toast: {
    error: (): void => undefined,
    success: (): void => undefined,
    info: (): void => undefined,
  },
}));

const remoteDraft = {
  ...materialsFixtureCounts()[40],
  status: "DRAFT",
  canEdit: true,
  countNumber: "SO-REMOTE-0041",
  note: "Draft di luar preview dashboard",
};
function Desktop(props: React.ComponentProps<typeof MaterialDesktopWorkspace>): React.JSX.Element {
  const activity = useMaterialDesktopActivity({
    active: props.active && props.tab === "activity",
    suspended: props.suspended || props.pending,
    refreshToken: props.refreshToken ?? props.data,
  });
  return (
    <section aria-label="Desktop owner probe">
      <output data-source>{props.data.inventory[0]?.materialName}</output>
      <output data-activity>
        {JSON.stringify({
          kind: activity.data?.kind ?? null,
          total: activity.data?.total ?? null,
          loading: activity.loading,
        })}
      </output>
      <output data-owner-state>
        {JSON.stringify({
          active: props.active,
          pending: props.pending,
          suspended: props.suspended,
        })}
      </output>
      <button type="button" onClick={() => props.onOperation("COUNT")}>
        New count
      </button>
      <button type="button" onClick={() => props.onOperation("TRANSFER")}>
        New transfer
      </button>
      <button type="button" onClick={() => props.onLoadCountDraft(remoteDraft)}>
        Load remote count
      </button>
      <button type="button" onClick={props.onReload}>
        Owner refresh
      </button>
      {(["movements", "receipts", "counts"] as const).map((kind) => (
        <button
          key={kind}
          type="button"
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.set("tab", "activity");
            url.searchParams.set("activity-kind", kind);
            window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
          }}
        >
          Activity {kind}
        </button>
      ))}
    </section>
  );
}
mock.module("../desktop/material-desktop-workspace", () => ({ MaterialDesktopWorkspace: Desktop }));
mock.module("@/features/materials/components/sheets/goods-receipt-sheet", () => ({
  GoodsReceiptSheet: (props: GoodsReceiptSheetProps): React.JSX.Element => (
    <button type="button" onClick={props.onMutationComplete}>
      Receipt succeeded
    </button>
  ),
}));
mock.module("@/features/materials/components/sheets/material-operation-sheets", () => ({
  MaterialDetail: Nothing,
}));
mock.module("@/features/materials/components/tabs/material-dashboard-tabs", () => ({
  MaterialActivityTab: Nothing,
  MaterialInventoryTab: Nothing,
  MaterialNeedsTab: Nothing,
  MaterialOverviewTab: Nothing,
}));
mock.module("@/features/materials/components/tabs/material-tabs-navigation", () => ({
  MaterialTabsNavigation: Nothing,
}));

function Count(props: React.ComponentProps<typeof StockCountSheet>): React.JSX.Element | null {
  if (!props.open) return null;
  return (
    <section aria-label="Count probe">
      <output data-count>
        {JSON.stringify({
          id: props.stockCountId,
          number: props.documentNumber,
          location: props.locationId,
          note: props.note,
          counted: props.counted,
          drafts: props.existingDrafts.map((row) => row.id),
          pending: props.pending,
        })}
      </output>
      <button type="button" onClick={() => props.onNoteChange("Local count edit")}>
        Edit count
      </button>
      <button type="button" onClick={props.onSaveDraft}>
        Save count
      </button>
      <button type="button" onClick={props.onSubmit}>
        Submit count
      </button>
      <button type="button" onClick={props.onClose}>
        Discard count
      </button>
    </section>
  );
}
function Transfer(props: React.ComponentProps<typeof TransferSheet>): React.JSX.Element | null {
  if (!props.open) return null;
  return (
    <section aria-label="Transfer probe">
      <output data-transfer>
        {JSON.stringify({
          number: props.documentNumber,
          note: props.note,
          from: props.fromLocationId,
          to: props.toLocationId,
          items: props.items,
          pending: props.pending,
        })}
      </output>
      <button
        type="button"
        onClick={() => {
          props.onDocumentNumberChange("TRF-LOCAL-001");
          props.onNoteChange("Transfer draft survives resize");
          props.onFromLocationChange(props.locationOptions[0].value);
          props.onToLocationChange(props.locationOptions[1].value);
          props.onItemsChange([
            { key: "local-row", materialId: props.materials[0].id, quantity: "2.75" },
          ]);
        }}
      >
        Edit transfer
      </button>
      <button type="button" onClick={props.onSubmit}>
        Submit transfer
      </button>
      <button type="button" onClick={props.onClose}>
        Discard transfer
      </button>
    </section>
  );
}
mock.module("@/features/materials/components/shared/material-operation-dialogs", () => ({
  EmergencyAdjustSheet: Nothing,
  InventoryLocationSheet: Nothing,
  ProjectMaterialOperationSheet: Nothing,
  ReceiptDetailSheet: Nothing,
  StockCountSheet: Count,
  TransferSheet: Transfer,
}));

const fail = async (): Promise<ActionResponse<never>> => ({
  success: false,
  error: { code: "VALIDATION_ERROR", message: "Fixture does not save" },
});
let resolveWrite: ((result: ActionResponse<{ readonly id: string }>) => void) | undefined;
function pendingWrite(): Promise<ActionResponse<{ readonly id: string }>> {
  return new Promise((resolve) => {
    resolveWrite = resolve;
  });
}
mock.module("@/app/actions/material/inventory", () => ({
  reserveMaterialForProject: fail,
  returnMaterialFromProject: fail,
  useMaterialForProject: fail,
  wasteMaterialForProject: fail,
}));
mock.module("@/app/actions/material/operations-dashboard", () => ({
  getMaterialMovementPage: fail,
}));
mock.module("@/app/actions/material/warehouse", () => ({ createInventoryLocation: fail }));
mock.module("@/app/actions/material/warehouse-transfer", () => ({
  createStockTransfer: pendingWrite,
}));
mock.module("@/app/actions/material/warehouse-stock-count", () => ({
  approveStockCount: fail,
  rejectStockCount: fail,
  saveStockCount: pendingWrite,
  submitStockCount: fail,
}));
mock.module("@/app/actions/material/warehouse-receipt-reversal", () => ({
  approveGoodsReceiptReversal: fail,
  rejectGoodsReceiptReversal: fail,
  requestGoodsReceiptReversal: fail,
}));
mock.module("@/app/actions/material/warehouse-adjustment", () => ({ emergencyAdjustStock: fail }));
type ActivityRead = {
  readonly input: MaterialDesktopActivityInput;
  readonly resolve: (result: ActionResponse<MaterialDesktopActivityData>) => void;
};
const activityReads: ActivityRead[] = [];
mock.module("@/features/materials/hooks/material-desktop-read-client", () => ({
  readMaterialDesktopActivity: (
    input: MaterialDesktopActivityInput,
  ): Promise<ActionResponse<MaterialDesktopActivityData>> =>
    new Promise((resolve) => activityReads.push({ input, resolve })),
}));

const { createRoot } = await import("react-dom/client");
const { useMaterialDesktopActivity } = await import("../../hooks/use-material-desktop-activity");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { MaterialsControlCenter } = await import("./materials-control-center");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
let data = materialsFixtureData();
async function render(width: number): Promise<void> {
  browser.happyDOM.setWindowSize({ width, height: 976 });
  await act(async (): Promise<void> => {
    root.render(
      <WorkspacePresentationProvider presentation={width >= 1024 ? "desktop" : "mobile"}>
        <MaterialsControlCenter data={data} />
      </WorkspacePresentationProvider>,
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  });
}
async function click(label: string): Promise<void> {
  await act(async (): Promise<void> => {
    const button = [...host.querySelectorAll("button")].find(
      (element) => element.textContent === label,
    );
    assert(button, `missing ${label}`);
    button.click();
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  });
}
function read(selector: string): string {
  const output = host.querySelector(selector);
  assert(output, `missing ${selector}`);
  return output.textContent ?? "";
}
function sourceName(next: MaterialOperationsDashboard, name: string): MaterialOperationsDashboard {
  return {
    ...next,
    inventory: next.inventory.map((row, index) =>
      index === 0 ? { ...row, materialName: name } : row,
    ),
  };
}
await render(1440);
assert(!data.counts.some((row) => row.id === remoteDraft.id));
await click("Load remote count");
assert.equal(new URL(window.location.href).searchParams.get("action"), "COUNT");
const countSchema = z.object({
  id: z.string().nullable(),
  number: z.string(),
  location: z.string(),
  note: z.string(),
  counted: z.record(z.string(), z.string()),
  drafts: z.array(z.string()),
  pending: z.boolean(),
});
let count = countSchema.parse(JSON.parse(read("[data-count]")));
assert.equal(count.id, remoteDraft.id);
assert.equal(count.number, remoteDraft.countNumber);
assert.equal(count.note, remoteDraft.note);
assert.equal(count.location, remoteDraft.locationId);
assert.equal(
  count.counted[remoteDraft.items[0].materialId],
  String(remoteDraft.items[0].countedQuantity),
);
assert(count.drafts.includes(remoteDraft.id));
await click("Edit count");
data = sourceName(data, "Incoming source during count");
await render(390);
await render(1440);
assert.notEqual(read("[data-source]"), "Incoming source during count");
assert.match(read("[data-count]"), /Local count edit/);
await click("Save count");
assert.match(read("[data-count]"), /"pending":true/);
await render(390);
await render(1440);
assert.match(read("[data-count]"), /"pending":true/);
assert.match(read("[data-count]"), /Local count edit/);
await act(async (): Promise<void> => {
  assert(resolveWrite);
  resolveWrite(await fail());
});
assert.match(read("[data-count]"), /"pending":false/);
await click("Discard count");
assert.equal(host.querySelector("[data-count]"), null);
assert.equal(read("[data-source]"), "Incoming source during count");
await click("New count");
count = countSchema.parse(JSON.parse(read("[data-count]")));
assert.equal(count.id, null);
assert.equal(count.note, "");
assert.deepEqual(count.counted, {});
assert(!count.drafts.includes(remoteDraft.id));
await click("Discard count");
await click("New transfer");
await click("Edit transfer");
const transferBefore = read("[data-transfer]");
data = sourceName(data, "Incoming source during transfer");
await render(390);
await render(1440);
assert.equal(read("[data-transfer]"), transferBefore);
assert.notEqual(read("[data-source]"), "Incoming source during transfer");
await click("Submit transfer");
assert.match(read("[data-transfer]"), /"pending":true/);
await render(390);
await render(1440);
assert.match(read("[data-transfer]"), /Transfer draft survives resize/);
assert.match(read("[data-transfer]"), /"quantity":"2.75"/);
assert.match(read("[data-transfer]"), /"pending":true/);
await act(async (): Promise<void> => {
  assert(resolveWrite);
  resolveWrite(await fail());
});
await click("Discard transfer");
assert.equal(read("[data-source]"), "Incoming source during transfer");
const activitySchema = z.object({
  kind: z.string().nullable(),
  total: z.number().nullable(),
  loading: z.boolean(),
});
async function answerActivity(): Promise<void> {
  const pendingRead = activityReads.at(-1);
  assert.ok(pendingRead);
  await act(async (): Promise<void> => {
    pendingRead.resolve({
      success: true,
      data: {
        kind: pendingRead.input.kind,
        rows: [],
        total: activityReads.length,
        page: pendingRead.input.page,
        pageSize: pendingRead.input.pageSize,
        updatedAt: new Date(),
      },
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  });
}
await click("Activity movements");
await answerActivity();
await click("Activity receipts");
await answerActivity();
const beforeOwnerRefresh = activityReads.length;
await click("Activity movements");
assert.equal(
  activityReads.length,
  beforeOwnerRefresh,
  "the real owner retains visited activity pages",
);
await click("Owner refresh");
assert.equal(
  activityReads.length,
  beforeOwnerRefresh + 1,
  "manual refresh evicts immediately before any new parent props arrive",
);
assert.equal(activitySchema.parse(JSON.parse(read("[data-activity]"))).kind, null);
await answerActivity();
await click("Activity receipts");
assert.equal(
  activityReads.length,
  beforeOwnerRefresh + 2,
  "manual refresh evicts sibling kinds too",
);
await answerActivity();
const beforeReceiptSuccess = activityReads.length;
await click("Receipt succeeded");
assert.equal(
  activityReads.length,
  beforeReceiptSuccess + 1,
  "the Goods Receipt success callback invalidates activity independently of its pending owner and delayed router refresh",
);
assert.equal(activitySchema.parse(JSON.parse(read("[data-activity]"))).kind, null);
await answerActivity();
await click("Activity counts");
await answerActivity();
const beforePartialCount = activityReads.length;
await click("New count");
await click("Submit count");
await act(async (): Promise<void> => {
  assert.ok(resolveWrite);
  resolveWrite({ success: true, data: { id: "count-partially-saved" } });
});
assert.ok(
  host.querySelector("[data-count]"),
  "a failed count submission preserves the saved draft editor",
);
assert.equal(
  activityReads.length,
  beforePartialCount,
  "the dirty open form keeps invalidated reads suspended",
);
assert.equal(
  activitySchema.parse(JSON.parse(read("[data-activity]"))).kind,
  null,
  "a successful save still invalidates when the following submission fails",
);
await click("Discard count");
assert.equal(
  activityReads.length,
  beforePartialCount + 1,
  "closing the partial-success editor performs a fresh activity read",
);
await answerActivity();
await click("New transfer");
await click("Edit transfer");
await click("Submit transfer");
const beforeTransferSuccess = activityReads.length;
await act(async (): Promise<void> => {
  assert.ok(resolveWrite);
  resolveWrite({ success: true, data: { id: "transfer-saved" } });
  await new Promise<void>((resolve) => setTimeout(resolve, 10));
});
assert.equal(
  activityReads.length,
  beforeTransferSuccess + 1,
  "a successful operational write evicts cached kinds while router refresh still has no authoritative props",
);
assert.equal(activitySchema.parse(JSON.parse(read("[data-activity]"))).kind, null);
await answerActivity();
const beforeActorChange = activityReads.length;
currentActor = {
  ...currentActor,
  id: "actor-two",
  sessionId: "session-two",
  dataScope: "ASSIGNED",
};
actorPermissions = ["view:inventory", "view:rap"];
await render(1440);
assert.equal(
  activityReads.length,
  beforeActorChange + 1,
  "an actor/session/scope/permission change invalidates before parent snapshot replacement",
);
assert.equal(activitySchema.parse(JSON.parse(read("[data-activity]"))).kind, null);
await answerActivity();
await act(async (): Promise<void> => root.unmount());
await browser.happyDOM.close();
console.log(
  "material owner preserves remote count and transfer drafts, pending work, and deferred source across resize",
);
