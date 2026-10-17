import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import {
  APPROVALS_FIXTURE_REFERENCE,
  approvalsFixtureData,
  approvalsFixturePermissions,
  type ApprovalsFixtureScenario,
} from "../../../../.storybook/approvals-data.fixture";
import {
  approveFieldRequest,
  approveVendorPayment,
  approvalsFixtureDecisionCalls,
  decideInventoryOpening,
  releaseApprovalsFixtureDecisions,
  setApprovalsFixtureDecisionMode,
} from "../../../../.storybook/approvals-actions.fixture";
import type { ApprovalDetail } from "@atria/core/finance/approval-types";
import type { ActionResponse } from "@atria/core/types/action-response";
const browserWindow = new Window({ url: "https://atria.test/approvals", width: 1440, height: 976 });
Reflect.set(browserWindow.Element.prototype, "animate", undefined);
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
const nextNavigation = await import("next/navigation");
mock.module("next/navigation", (): typeof nextNavigation => ({
  ...nextNavigation,
  usePathname: (): string => "/approvals",
  useRouter: (): ReturnType<typeof nextNavigation.useRouter> => ({
    bfcacheId: "approval-workspace-fixture",
    back: (): void => {},
    forward: (): void => {},
    refresh: (): void => {},
    push: (): void => {},
    replace: (): void => {},
    prefetch: (): void => {},
  }),
}));
let acceptSyntheticFieldDecision = false;
async function isolatedFieldDecision(
  ...args: readonly unknown[]
): Promise<ActionResponse<undefined>> {
  const result = await approveFieldRequest(...args);
  // Test-only success for the local removed-row guard, never exported to Storybook or an API.
  return acceptSyntheticFieldDecision ? { success: true, data: undefined } : result;
}
mock.module("@/app/actions/finance/field-requests", () => ({
  approveFieldRequest: isolatedFieldDecision,
  approveVendorPayment,
}));
mock.module("@/app/actions/material/opening-inventory", () => ({ decideInventoryOpening }));

const visibility = document.createElement("style");
const visibilityRules =
  ".hidden{display:none}@media (min-width: 1280px){.xl\\:block{display:block}.xl\\:hidden{display:none}}";
visibility.textContent = visibilityRules;
document.head.append(visibility);
const { createRoot } = await import("react-dom/client");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { useWorkspaceViewportPresentation } = await import("@/lib/navigation/workspace-viewport");
const { DesktopUIProvider } = await import("@/components/ui");
const { PermissionsProvider } = await import("@/components/auth/permissions-provider");
const { ApprovalList } = await import("./approval-list");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
let incoming: readonly ApprovalDetail[] = approvalsFixtureData("complete");
let referenceDateIso = APPROVALS_FIXTURE_REFERENCE;
function Fixture({ scenario }: { readonly scenario: ApprovalsFixtureScenario }): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation();
  return (
    <WorkspacePresentationProvider presentation={presentation}>
      <DesktopUIProvider responsive>
        <PermissionsProvider
          permissions={approvalsFixturePermissions(scenario)}
          user={{ name: "Karin Putri", image: null, dataScope: "GLOBAL" }}
        >
          <ApprovalList
            initialApprovals={incoming}
            canEmergencyOverride={scenario !== "read-only" && scenario !== "stock-only"}
            referenceDateIso={referenceDateIso}
          />
        </PermissionsProvider>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
async function settle(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 40));
  });
}
async function render(scenario: ApprovalsFixtureScenario, key: string = scenario): Promise<void> {
  await act(async (): Promise<void> => {
    root.render(<Fixture key={key} scenario={scenario} />);
  });
  await settle();
}
async function width(next: number): Promise<void> {
  await act(async (): Promise<void> => {
    browserWindow.happyDOM.setWindowSize({ width: next, height: 976 });
    visibility.textContent = visibilityRules;
    window.dispatchEvent(new Event("resize"));
  });
  await settle();
}
async function press(element: HTMLElement): Promise<void> {
  await act(async (): Promise<void> => {
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    element.click();
  });
  await settle();
}
async function activateRow(element: HTMLElement, key: "Enter" | " "): Promise<void> {
  await act(async (): Promise<void> => {
    element.focus();
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    element.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }));
  });
  await settle();
}
function visible(element: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement) {
    if (current.hasAttribute("hidden") || getComputedStyle(current).display === "none")
      return false;
  }
  return true;
}
function focusedElement(): Element | null {
  return document.activeElement;
}
function table(): HTMLTableElement {
  const value = [
    ...host.querySelectorAll<HTMLTableElement>('table[aria-label="Antrean persetujuan"]'),
  ].find(visible);
  assert.ok(value, "Visible approval queue exists");
  return value;
}
function detail(): HTMLElement {
  const value = host.querySelector<HTMLElement>('section[aria-label^="Rincian persetujuan "]');
  assert.ok(value);
  return value;
}
function button(label: string, within: ParentNode = document): HTMLButtonElement {
  const value = [...within.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => visible(item) && item.textContent?.trim() === label,
  );
  assert.ok(value, `Button ${label} exists`);
  return value;
}
async function type(input: HTMLTextAreaElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  assert.ok(setter);
  await act(async (): Promise<void> => {
    input.focus();
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
}
try {
  setApprovalsFixtureDecisionMode("failure");
  await render("complete");
  assert.equal(table().querySelectorAll("tbody tr").length, 10);
  assert.equal(
    table().querySelectorAll('tbody tr[aria-selected="true"]').length,
    0,
    "the initial approval queue has no automatically selected row",
  );
  assert.equal(host.querySelector('section[aria-label^="Rincian persetujuan "]'), null);
  const firstRow = table().querySelectorAll<HTMLElement>("tbody tr")[0]!;
  const secondRow = table().querySelectorAll<HTMLElement>("tbody tr")[1]!;
  await press(firstRow);
  assert.equal(table().querySelectorAll('tbody tr[aria-selected="true"]').length, 1);
  assert.equal(visible(detail()), true);
  await press(firstRow);
  assert.equal(table().querySelectorAll('tbody tr[aria-selected="true"]').length, 0);
  assert.equal(
    host.querySelector('section[aria-label^="Rincian persetujuan "]'),
    null,
    "clicking the selected row again closes its context panel",
  );
  await press(secondRow);
  const pointerSelectedText = detail().getAttribute("aria-label");
  assert.equal(secondRow.getAttribute("aria-selected"), "true");
  await activateRow(secondRow, "Enter");
  assert.equal(table().querySelectorAll('tbody tr[aria-selected="true"]').length, 0);
  assert.equal(host.querySelector('section[aria-label^="Rincian persetujuan "]'), null);
  await activateRow(secondRow, "Enter");
  assert.equal(detail().getAttribute("aria-label"), pointerSelectedText);
  await activateRow(secondRow, " ");
  assert.equal(table().querySelectorAll('tbody tr[aria-selected="true"]').length, 0);
  assert.equal(host.querySelector('section[aria-label^="Rincian persetujuan "]'), null);
  await width(1093);
  assert.equal(table().querySelectorAll('tbody tr[aria-selected="true"]').length, 0);
  assert.equal(host.querySelector('section[aria-label^="Rincian persetujuan "]'), null);
  for (const key of ["Enter", " "] as const) {
    const invoker = table().querySelector<HTMLElement>("tbody tr");
    assert.ok(invoker);
    await activateRow(invoker, key);
    const back = button("Kembali ke daftar", detail());
    assert.ok(focusedElement() === back, `${key}: narrow detail receives keyboard focus`);
    await press(back);
    assert.ok(focusedElement() === invoker, `${key}: Back restores the invoking row`);
    assert.equal(visible(table()), true);
  }
  await press(table().querySelector<HTMLElement>("tbody tr")!);
  assert.equal(visible(detail()), true, "The first row opens detail on the first click");
  await press(button("Kembali ke daftar", detail()));
  assert.equal(host.querySelector('section[aria-label^="Rincian persetujuan "]'), null);
  assert.equal(table().querySelectorAll('tbody tr[aria-selected="true"]').length, 0);
  await width(1440);
  assert.equal(host.querySelector('section[aria-label^="Rincian persetujuan "]'), null);
  await press(table().querySelectorAll<HTMLElement>("tbody tr")[1]!);
  const selectedText = detail().getAttribute("aria-label");
  await width(1093);
  assert.equal(visible(detail()), true);
  await width(1440);
  assert.equal(detail().getAttribute("aria-label"), selectedText);
  console.log("responsive first-click, Back, active highlight and explicit selection passed");

  const decisionPane = detail();
  await press(button("Tolak", decisionPane));
  const focusReason = document.getElementById("approval-rejection-reason");
  assert.ok(focusReason instanceof HTMLTextAreaElement);
  assert.ok(focusedElement() === focusReason, "rejection input receives initial autofocus");
  await type(focusReason, "Catatan untuk uji fokus");
  await width(390);
  assert.ok(document.getElementById(focusReason.id) === focusReason);
  assert.ok(focusedElement() === focusReason, "resize keeps the rejection editor focused");
  await width(1440);
  assert.equal(focusReason.value, "Catatan untuk uji fokus");
  assert.ok(focusedElement() === focusReason);
  await press(button("Batal"));
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 700));
  });
  await settle();
  assert.equal(document.querySelectorAll('[role="dialog"], [role="alertdialog"]').length, 0);
  assert.ok(
    focusedElement() === decisionPane,
    "canceling an auto-focused rejection returns to its logical approval pane",
  );
  await press(button("Setujui", decisionPane));
  await press(button("Batal"));
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 700));
  });
  await settle();
  assert.equal(document.querySelectorAll('[role="dialog"], [role="alertdialog"]').length, 0);
  assert.ok(
    focusedElement() === decisionPane,
    "canceling confirmation returns to the same approval pane",
  );

  incoming = approvalsFixtureData("read-only");
  await render("read-only");
  await press(table().querySelector<HTMLElement>("tbody tr")!);
  assert.equal(button("Setujui", detail()).disabled, true);
  assert.equal(button("Tolak", detail()).disabled, true);
  console.log("read-only permissions disable both decision actions");

  incoming = approvalsFixtureData("complete");
  await render("complete", "decision-flow");
  await press(table().querySelector<HTMLElement>("tbody tr")!);
  await press(button("Tolak", detail()));
  const input = document.getElementById("approval-rejection-reason");
  assert.ok(input instanceof HTMLTextAreaElement);
  await type(input, "Abcd");
  assert.equal(button("Tolak pengajuan").disabled, true);
  await type(input, "Nota harus diperbaiki dahulu");
  assert.equal(button("Tolak pengajuan").disabled, false);
  incoming = incoming.slice(1);
  referenceDateIso = "2026-10-15T06:00:00.000Z";
  await render("complete", "decision-flow");
  assert.equal(
    document.getElementById(input.id),
    input,
    "Incoming snapshots do not replace the decision editor",
  );
  await width(390);
  assert.equal(
    document.getElementById(input.id),
    input,
    "Resize preserves the exact decision textarea",
  );
  assert.equal(input.value, "Nota harus diperbaiki dahulu");
  assert.ok(focusedElement() === input);
  await width(1440);
  assert.equal(document.getElementById(input.id), input);
  setApprovalsFixtureDecisionMode("pending");
  await press(button("Tolak pengajuan"));
  assert.equal(input.disabled, true, "A pending decision protects the editor");
  const pendingSelection = detail().getAttribute("aria-label");
  const pendingRows = [...table().querySelectorAll<HTMLElement>("tbody tr")];
  const pendingSelectedRow = pendingRows.find(
    (row) => row.getAttribute("aria-selected") === "true",
  );
  const pendingOtherRow = pendingRows.find((row) => row !== pendingSelectedRow);
  assert.ok(pendingSelectedRow);
  assert.ok(pendingOtherRow);
  await press(pendingSelectedRow);
  assert.equal(
    detail().getAttribute("aria-label"),
    pendingSelection,
    "a pending decision prevents deselecting its source row",
  );
  await press(pendingOtherRow);
  assert.equal(
    detail().getAttribute("aria-label"),
    pendingSelection,
    "a pending decision prevents selecting another source row",
  );
  assert.equal(document.getElementById(input.id), input);
  await width(390);
  assert.equal(document.getElementById(input.id), input);
  assert.equal(input.value, "Nota harus diperbaiki dahulu");
  await act(async (): Promise<void> => {
    releaseApprovalsFixtureDecisions();
  });
  await settle();
  assert.equal(input.disabled, false);
  assert.equal(
    input.value,
    "Nota harus diperbaiki dahulu",
    "A failed decision retains the human reason for retry",
  );
  console.log(
    "rejection reason minimum, snapshot deferral, pending, failure and focused resize passed",
  );
  await act(async (): Promise<void> => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  await settle();
  await width(1440);
  assert.equal(
    table().textContent?.includes(approvalsFixtureData("complete")[0]!.description),
    false,
    "The deferred incoming source applies after the decision is closed",
  );
  console.log("deferred incoming collection applies after closing the protected decision");

  setApprovalsFixtureDecisionMode("failure");
  incoming = approvalsFixtureData("stock-only");
  await width(1440);
  await render("stock-only");
  await press(table().querySelector<HTMLElement>("tbody tr")!);
  assert.equal(button("Setujui", detail()).disabled, false);
  await press(button("Setujui", detail()));
  const stockDialog = document.querySelector<HTMLElement>('[role="alertdialog"]');
  assert.ok(stockDialog);
  const stockReason = document.getElementById("approval-approval-reason");
  assert.ok(stockReason instanceof HTMLTextAreaElement);
  await type(stockReason, "123456789");
  assert.equal(button("Setujui", stockDialog).disabled, true);
  await type(stockReason, "Saldo fisik sesuai dokumen");
  assert.equal(button("Setujui", stockDialog).disabled, false);
  await press(button("Setujui", stockDialog));
  assert.deepEqual(approvalsFixtureDecisionCalls(), [
    {
      kind: "stock",
      args: [
        {
          batchId: incoming[0]?.referenceId,
          decision: "APPROVE",
          reason: "Saldo fisik sesuai dokumen",
          emergencyOverride: false,
        },
      ],
    },
  ]);
  assert.equal(stockReason.value, "Saldo fisik sesuai dokumen");
  console.log("stock-only action permission and ten-character approval reason passed");

  incoming = approvalsFixtureData("self-override");
  await render("self-override");
  await press(table().querySelector<HTMLElement>("tbody tr")!);
  await press(button("Setujui", detail()));
  const overrideDialog = document.querySelector<HTMLElement>('[role="alertdialog"]');
  assert.ok(overrideDialog);
  assert.equal(button("Setujui", overrideDialog).disabled, true);
  const overrideToggle = overrideDialog.querySelector<HTMLInputElement>('input[type="checkbox"]');
  assert.ok(overrideToggle);
  await press(overrideToggle);
  const overrideReason = document.getElementById("approval-emergency-reason");
  assert.ok(overrideReason instanceof HTMLTextAreaElement);
  await type(overrideReason, "123456789");
  assert.equal(button("Setujui", overrideDialog).disabled, true);
  await type(overrideReason, "Kebutuhan lapangan telah dikonfirmasi");
  assert.equal(button("Setujui", overrideDialog).disabled, false);
  console.log("self approval retains explicit override plus ten-character audit reason");

  setApprovalsFixtureDecisionMode("failure");
  acceptSyntheticFieldDecision = true;
  const completeSource = approvalsFixtureData("complete");
  incoming = completeSource;
  referenceDateIso = APPROVALS_FIXTURE_REFERENCE;
  await render("complete", "isolated-synthetic-success");
  await press(table().querySelector<HTMLElement>("tbody tr")!);
  await press(button("Setujui", detail()));
  const syntheticDialog = document.querySelector<HTMLElement>('[role="alertdialog"]');
  assert.ok(syntheticDialog);
  await press(button("Setujui", syntheticDialog));
  const acceptedDescription = completeSource[0]!.description;
  assert.equal(table().textContent?.includes(acceptedDescription), false);
  incoming = [...completeSource];
  referenceDateIso = "2026-10-15T07:00:00.000Z";
  await render("complete", "isolated-synthetic-success");
  assert.equal(
    table().textContent?.includes(acceptedDescription),
    false,
    "A lagging refresh cannot resurrect the locally accepted row",
  );
  console.log(
    "isolated synthetic success protects removed rows from lagging refresh; no backend decision occurred",
  );

  acceptSyntheticFieldDecision = false;
  incoming = approvalsFixtureData("complete");
  await act(async (): Promise<void> => {
    window.history.replaceState(
      {},
      "",
      "/approvals?approvals-page=2&approvals-pageSize=10&approvals-sort=amount&approvals-direction=descending&cash-search=kept#evidence",
    );
    root.render(<Fixture key="desktop-url-query" scenario="complete" />);
  });
  await settle();
  const params = (): URLSearchParams => new URLSearchParams(window.location.search);
  assert.match(table().parentElement?.parentElement?.textContent ?? "", /Halaman 2/);
  assert.equal(table().querySelectorAll("tbody tr").length, 10);
  assert.equal(table().querySelectorAll('tbody tr[aria-selected="true"]').length, 0);
  await press(table().querySelector<HTMLElement>("tbody tr")!);
  assert.ok(detail());
  await press(button("Berikutnya"));
  assert.equal(params().get("approvals-page"), "3");
  assert.equal(
    host.querySelector('section[aria-label^="Rincian persetujuan "]'),
    null,
    "an off-page row cannot keep the old approval detail open",
  );
  assert.equal(table().querySelectorAll('tbody tr[aria-selected="true"]').length, 0);
  await width(1093);
  assert.equal(visible(table()), true, "narrowing after pagination still shows the current list");
  await width(1440);
  const amountHeader = [...table().querySelectorAll<HTMLElement>("th")].find((item) =>
    item.textContent?.includes("Nominal"),
  );
  assert.ok(amountHeader);
  await press(amountHeader);
  assert.equal(params().get("approvals-sort"), "amount");
  assert.equal(params().get("approvals-direction"), "ascending");
  assert.equal(params().get("approvals-page"), "1", "sorting resets the URL page");
  const search = host.querySelector<HTMLInputElement>(
    'input[aria-label="Cari antrean persetujuan"]',
  );
  assert.ok(search);
  await press(table().querySelector<HTMLElement>("tbody tr")!);
  assert.ok(detail());
  await act(async (): Promise<void> => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    assert.ok(setter);
    search.focus();
    setter.call(search, "Pencarian fixture tanpa hasil");
    search.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
  assert.equal(params().get("approvals-search"), "Pencarian fixture tanpa hasil");
  assert.equal(params().get("approvals-page"), "1");
  assert.equal(host.querySelector('input[aria-label="Cari antrean persetujuan"]'), search);
  assert.ok(
    focusedElement() === search,
    "filtering out the selected detail never steals search focus",
  );
  assert.equal(host.querySelector('section[aria-label^="Rincian persetujuan "]'), null);
  await press(button("Reset filter"));
  assert.equal(params().get("approvals-search"), "");
  const vendorTab = [...host.querySelectorAll<HTMLElement>('[role="tab"]')].find((item) =>
    item.textContent?.startsWith("Vendor"),
  );
  assert.ok(vendorTab);
  await press(vendorTab);
  assert.equal(params().get("approvals-filter"), "VENDOR");
  assert.equal(params().get("cash-search"), "kept");
  assert.equal(window.location.hash, "#evidence");
  await press(button("Reset filter"));
  await press(button("Semua prioritas"));
  const normalOption = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (item) => item.textContent?.trim() === "Normal",
  );
  assert.ok(normalOption);
  await press(normalOption);
  assert.equal(params().get("approvals-priority"), "NORMAL");
  assert.equal(params().get("approvals-page"), "1");
  await press(button("Reset filter"));
  const sizeTrigger = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent?.trim() === "10 baris",
  );
  assert.ok(sizeTrigger);
  await press(sizeTrigger);
  const sizeOption = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (item) => item.textContent?.trim() === "25 baris",
  );
  assert.ok(sizeOption);
  await press(sizeOption);
  assert.equal(params().get("approvals-pageSize"), "25");
  assert.equal(params().get("approvals-page"), "1");

  await act(async (): Promise<void> => {
    window.history.pushState(
      {},
      "",
      "/approvals?approvals-filter=FIELD&approvals-search=Panel&cash-search=kept#evidence",
    );
  });
  await settle();
  assert.equal(search.value, "Panel", "history query updates restore the live search");
  await act(async (): Promise<void> => {
    window.history.pushState(
      {},
      "",
      "/approvals?approvals-filter=VENDOR&approvals-search=Tagihan&cash-search=kept#evidence",
    );
    window.history.back();
  });
  await settle();
  assert.equal(search.value, "Panel", "Back restores the prior query without remounting the page");
  await act(async (): Promise<void> => window.history.forward());
  await settle();
  assert.equal(search.value, "Tagihan", "Forward restores its namespaced query");
  assert.equal(host.querySelector('input[aria-label="Cari antrean persetujuan"]'), search);
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 400));
  });
  const beforeMobileUrl = window.location.href;
  await width(390);
  await act(async (): Promise<void> => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    assert.ok(setter);
    setter.call(search, "hidden desktop control");
    search.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
  assert.equal(
    window.location.href,
    beforeMobileUrl,
    "mobile presentation cannot write desktop table query state",
  );
  console.log(
    "approval desktop URL restoration, filtering, sorting, pagination and current-page context passed",
  );
} finally {
  acceptSyntheticFieldDecision = false;
  setApprovalsFixtureDecisionMode("failure");
  await act(async (): Promise<void> => root.unmount());
  await browserWindow.happyDOM.close();
}
console.log("Approval workspace integration regression passed");
