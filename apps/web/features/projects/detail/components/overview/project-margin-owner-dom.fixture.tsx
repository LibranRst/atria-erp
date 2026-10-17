import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { ProjectTabsProps } from "../../types/project-tabs-types";
import type { PermissionKey } from "@atria/core/auth/permissions";

const browser = new Window({
  url: "https://atria.test/projects/fixture?tab=profitability&keep=1#rincian",
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
  "PopStateEvent",
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
const currentPath = "/projects/fixture";
const nextNavigation = await import("next/navigation");
mock.module("next/navigation", (): typeof nextNavigation => ({
  ...nextNavigation,
  usePathname: (): string => currentPath,
  useSearchParams: (): ReturnType<typeof nextNavigation.useSearchParams> =>
    new nextNavigation.ReadonlyURLSearchParams(window.location.search),
  useRouter: (): ReturnType<typeof nextNavigation.useRouter> => ({
    bfcacheId: "margin-owner-fixture",
    back: (): void => {},
    forward: (): void => {},
    refresh: (): void => {},
    push: (): void => {},
    replace: (): void => {},
    prefetch: (): void => {},
  }),
}));

import type {
  completeProject,
  getProjectClosingChecklist,
  ProjectClosingChecklist,
} from "@/app/actions/project/closing";
import type { ProjectMarginData } from "@atria/core/types/project-margin";

const ui = await import("@/components/ui");
// Only the unrelated specialized planning editor is replaced. Margin, closing,
// field controls, confirmation, focus/portal and source owner are production code.
mock.module("@/features/projects/detail/components/shared/rap-rab-manager", () => ({
  RapRabManager: (): React.JSX.Element => <p>Specialized RAP</p>,
}));
type ReadResult = Awaited<ReturnType<typeof getProjectClosingChecklist>>;
type CompleteInput = Parameters<typeof completeProject>[0];
type CompleteResult = Awaited<ReturnType<typeof completeProject>>;
const reads: { readonly projectId: string; readonly finish: (result: ReadResult) => void }[] = [];
const writes: {
  readonly input: CompleteInput;
  readonly finish: (result: CompleteResult) => void;
}[] = [];
mock.module("@/app/actions/project/closing", () => ({
  getProjectClosingChecklist: (projectId: string): Promise<ReadResult> =>
    new Promise<ReadResult>((finish) => reads.push({ projectId, finish })),
  completeProject: (input: CompleteInput): Promise<CompleteResult> =>
    new Promise<CompleteResult>((finish) => writes.push({ input, finish })),
}));
const { createRoot } = await import("react-dom/client");
const { PermissionsProvider } = await import("@/components/auth/permissions-provider");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { useWorkspaceViewportPresentation } = await import("@/lib/navigation/workspace-viewport");
const { ActivityDetailProvider } =
  await import("@/features/activity-detail/components/activity-detail-provider");
const { ProjectStateProvider, useProjectState } = await import("../shared/project-state-context");
const { ProjectTabs } = await import("../shared/project-tabs");
const { projectOperationsFixtureData } =
  await import("../../../../../.storybook/project-operations-data.fixture");
const base = projectOperationsFixtureData("complete");
const initialMargin: ProjectMarginData = {
  source: { status: "ready" },
  cashSource: { status: "ready" },
  finalSnapshotSource: { status: "missing" },
  cash: { received: 123456.78, paid: 45678.12, position: 77778.66 },
  finalSnapshot: null,
};
const initial: ProjectTabsProps = { ...base, userRole: "CUSTOM", projectMarginData: initialMargin };
const exactPermissions: readonly PermissionKey[] = [
  "view:project",
  "update:budget",
  "view:profitability",
  "close:project",
];
const checklist: ProjectClosingChecklist = {
  projectId: initial.project.id,
  canComplete: true,
  blockers: [],
  contractValue: 180000000.75,
  invoicedValue: 180000000.75,
  clientReceipts: 123456.78,
  actualCost: 45000000.25,
  cashOutflow: 45678.12,
  realizedMargin: 135000000.5,
  realizedMarginPercentage: 75,
  cashPosition: 77778.66,
  unresolvedReconciliationCount: 0,
  documentedReconciliationExceptionCount: 0,
};
function LockProbe(): React.JSX.Element {
  const state = useProjectState();
  return <output data-project-lock>{String(state.isLocked)}</output>;
}
function Owner({
  data,
  permissions,
}: {
  readonly data: ProjectTabsProps;
  readonly permissions: readonly PermissionKey[];
}): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation();
  return (
    <WorkspacePresentationProvider presentation={presentation}>
      <ui.DesktopUIProvider responsive>
        <PermissionsProvider permissions={permissions}>
          <ProjectStateProvider>
            <ActivityDetailProvider>
              <LockProbe />
              <ProjectTabs {...data} />
            </ActivityDetailProvider>
          </ProjectStateProvider>
        </PermissionsProvider>
      </ui.DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
async function settle(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 160));
  });
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  });
}
async function render(
  data: ProjectTabsProps = initial,
  permissions: readonly PermissionKey[] = exactPermissions,
): Promise<void> {
  await act(async (): Promise<void> => {
    root.render(<Owner data={data} permissions={permissions} />);
  });
  await settle();
}
async function click(element: HTMLElement): Promise<void> {
  await act(async (): Promise<void> => {
    element.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        buttons: 1,
      }),
    );
    element.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, buttons: 1 }),
    );
    element.focus();
  });
  await act(async (): Promise<void> => {
    element.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        buttons: 0,
      }),
    );
    element.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }),
    );
    element.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }),
    );
  });
  await settle();
}
function maybeButton(label: string): HTMLButtonElement | null {
  return (
    [...document.querySelectorAll("button")].find((node) => node.textContent === label) ?? null
  );
}
function button(label: string): HTMLButtonElement {
  const found = maybeButton(label);
  assert(found, `Actual closing button ${label} exists`);
  return found;
}
function note(): HTMLTextAreaElement {
  const found = host.querySelector<HTMLTextAreaElement>("textarea");
  assert(found, "Actual final closing note exists");
  return found;
}
async function type(element: HTMLTextAreaElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  assert(setter);
  await act(async (): Promise<void> => {
    setter.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function resize(width: number): Promise<void> {
  await act(async (): Promise<void> => {
    browser.happyDOM.setWindowSize({ width, height: 976 });
    window.dispatchEvent(new Event("resize"));
  });
  await settle();
}
async function finishRead(result: ReadResult): Promise<void> {
  const current = reads.at(-1);
  assert(current, "Actual checklist action was invoked");
  await act(async (): Promise<void> => {
    current.finish(result);
  });
  await settle();
}
function bodyText(): string {
  return document.body.textContent ?? "";
}
function assertReviewUnavailable(message: string): void {
  const review = maybeButton("Tinjau penutupan proyek");
  assert(!review || review.disabled, message);
}
async function settleExit(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 650));
  });
}
try {
  // Permission denial must precede any Margin numeric presenter, despite supplied data.
  await render(initial, ["view:project", "update:budget", "close:project"]);
  assert(host.textContent?.includes("Akses margin proyek terbatas"));
  assert(!host.textContent?.includes("123.456,78"));
  assert(!maybeButton("Periksa kesiapan penutupan"));
  assert.equal(reads.length, 0);
  assert.equal(writes.length, 0);
  // Viewing profitability never implies permission to inspect/complete closing.
  await render(initial, ["view:project", "view:profitability"]);
  assert(!host.textContent?.includes("Akses margin proyek terbatas"));
  assert(!maybeButton("Periksa kesiapan penutupan"));
  assert.equal(reads.length, 0);
  await render(initial, ["view:project", "view:profitability", "update:budget"]);
  assert(
    !maybeButton("Periksa kesiapan penutupan"),
    "Budget management does not imply closing permission",
  );
  await render(initial, ["view:project", "view:profitability", "close:project"]);
  assert(
    !maybeButton("Periksa kesiapan penutupan"),
    "Closing additionally requires budget management permission",
  );
  // Custom role gets closing through exact permissions, not a role-name shortcut.
  await render();
  await click(button("Periksa kesiapan penutupan"));
  assert.equal(reads.length, 1);
  assert.equal(reads[0]?.projectId, initial.project.id);
  assert.equal(writes.length, 0, "Readiness is a read, never an implicit close");
  await finishRead({ success: true, data: checklist });
  const originalNote = note();
  await type(originalNote, "  Final review retains the original project and cents.  ");
  await act(async (): Promise<void> => {
    originalNote.focus();
  });
  await resize(390);
  await resize(1440);
  assert.equal(note(), originalNote, "Responsive resize keeps the actual note DOM");
  assert.equal(document.activeElement, originalNote, "Resize preserves focused closing note");
  assert.equal(note().value, "  Final review retains the original project and cents.  ");
  const incoming: ProjectTabsProps = {
    ...initial,
    project: {
      ...initial.project,
      name: "Incoming source replacement",
      status: "COMPLETED",
      totalContractValue: "999999.99",
    },
    projectBudgetDashboard: null,
    projectBudgetSource: { status: "unavailable", message: "Incoming budget unavailable" },
    projectMarginData: {
      source: { status: "unavailable", message: "Incoming margin unavailable" },
      cashSource: { status: "unavailable" },
      finalSnapshotSource: { status: "ready" },
      cash: null,
      finalSnapshot: {
        id: "unreviewed-final",
        snapshotAt: new Date("2026-10-15T00:00:00Z"),
        contractValue: "999999.99",
        internalBudget: "900000.99",
        actualCost: "500000.25",
        remainingBudget: "400000.74",
        targetGrossAmount: "99999",
        targetGrossPercentage: "10",
        realizedMarginAmount: "499999.74",
        realizedMarginPercentage: "50",
        cashPosition: "444444.44",
      },
    },
  };
  await render(incoming);
  assert.equal(note(), originalNote, "Incoming null source must not remount the closing editor");
  assert.equal(document.activeElement, originalNote);
  assert(!host.textContent?.includes("Incoming source replacement"));
  assert.equal(host.querySelector("[data-project-lock]")?.textContent, "false");
  // Opening confirmation preserves the original reviewed source. No write until confirm.
  await click(button("Tinjau penutupan proyek"));
  assert(document.querySelector('[role="alertdialog"]'), "Shared ConfirmationDialog opens");
  assert.equal(writes.length, 0);
  const confirm = button("Selesaikan proyek");
  await click(confirm);
  assert.equal(writes.length, 1, "Only explicit confirmation invokes writer");
  const submittedInput: unknown = writes[0]?.input;
  assert(submittedInput !== null && typeof submittedInput === "object");
  assert.equal(
    Reflect.get(submittedInput, "projectId"),
    initial.project.id,
    "Writer receives original reviewed project ID",
  );
  assert.equal(
    Reflect.get(submittedInput, "closingNote"),
    "Final review retains the original project and cents.",
  );
  assert(confirm.disabled, "Pending confirmation disables repeat submission");
  assert(button("Batal").disabled, "Pending confirmation disables cancellation");
  await click(confirm);
  assert.equal(writes.length, 1, "Double confirmation cannot invoke a second mutation");
  await resize(360);
  await resize(1280);
  assert.equal(note(), originalNote, "Pending resize keeps original editor DOM");
  assert.equal(host.querySelector("[data-project-lock]")?.textContent, "false");
  await act(async (): Promise<void> => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
  });
  await click(button("Batal"));
  assert(
    document.querySelector('[role="alertdialog"]'),
    "Pending dialog cannot dismiss through Escape or cancel",
  );
  const failedWrite = writes.at(-1);
  assert(failedWrite);
  await act(async (): Promise<void> => {
    failedWrite.finish({
      success: false,
      error: { code: "CONFLICT", message: "Safe fixture close conflict" },
    });
  });
  await settleExit();
  assert(!document.querySelector('[role="alertdialog"]'));
  assert(bodyText().includes("Safe fixture close conflict"));
  assert.equal(note(), originalNote, "A failed closing request retains the original note DOM");
  assert.equal(note().value, "  Final review retains the original project and cents.  ");
  assertReviewUnavailable("Failed close invalidates readiness until a fresh read");
  assert(maybeButton("Tutup pemeriksaan"), "A retained draft can still be dismissed after failure");
  await click(button("Periksa kesiapan penutupan"));
  await finishRead({ success: true, data: checklist });
  assert.equal(
    note().value,
    "  Final review retains the original project and cents.  ",
    "Fresh check restores retained closing note after a failed write",
  );
  await click(button("Periksa ulang kesiapan"));
  assertReviewUnavailable("Refreshing readiness immediately disables stale completion");
  await finishRead({
    success: false,
    error: { code: "VALIDATION_ERROR", message: "Safe fixture readiness unavailable" },
  });
  assert(bodyText().includes("Safe fixture readiness unavailable"));
  assertReviewUnavailable("Failed refresh cannot reuse the earlier ready checklist");
  assert.equal(writes.length, 1);
  await click(button("Tutup pemeriksaan"));
  assert(
    document.querySelector('[role="alertdialog"]'),
    "Dirty inspection dismiss uses shared confirmation",
  );
  await click(button("Buang catatan"));
  await settleExit();
  assert.equal(host.querySelector("textarea"), null);
  assert(
    host.textContent?.includes("Incoming source replacement"),
    "Explicit discard adopts the latest deferred source",
  );
  assert.equal(host.querySelector("[data-project-lock]")?.textContent, "true");

  // Parent route changes use a keyed Margin owner: A's draft/checklist never become B's.
  await render(initial);
  await click(button("Periksa kesiapan penutupan"));
  await finishRead({ success: true, data: checklist });
  await type(note(), "Unfinished note belongs only to project A.");
  const secondId = "90000000-0000-4000-8000-000000000002";
  const secondBudget = initial.projectBudgetDashboard;
  assert(secondBudget);
  const second: ProjectTabsProps = {
    ...initial,
    project: { ...initial.project, id: secondId, name: "Project B owns a fresh inspection" },
    projectBudgetDashboard: { ...secondBudget, projectId: secondId },
  };
  await render(second);
  assert.equal(
    host.querySelector("textarea"),
    null,
    "Changing project clears the old note and ready checklist",
  );
  assert(host.textContent?.includes("Project B owns a fresh inspection"));
  assert(!bodyText().includes("Unfinished note belongs only to project A."));
  assert(!maybeButton("Tinjau penutupan proyek"));
  await click(button("Periksa kesiapan penutupan"));
  assert.equal(
    reads.at(-1)?.projectId,
    secondId,
    "A fresh check after route change targets project B",
  );
  await finishRead({
    success: false,
    error: { code: "VALIDATION_ERROR", message: "Safe fixture B unavailable" },
  });
  assert.equal(writes.length, 1, "No implicit writes from fresh read or route changes");

  // A stored FINAL is an independent historical source. Current budget/cash failure
  // must not hide it or replace its exact amounts with current/zero facts.
  const finalSnapshot: NonNullable<ProjectMarginData["finalSnapshot"]> = {
    id: "stored-final-owner-proof",
    snapshotAt: new Date("2026-10-13T10:15:00+07:00"),
    contractValue: "7654321.98",
    internalBudget: "6000000.25",
    actualCost: "6419754.09",
    remainingBudget: "-419753.84",
    targetGrossAmount: "1654321.73",
    targetGrossPercentage: "21.61",
    realizedMarginAmount: "1234567.89",
    realizedMarginPercentage: "16.13",
    cashPosition: "-12345.67",
  };
  function exactTitles(): string {
    return [...host.querySelectorAll("[title], [aria-label]")]
      .flatMap((element) => [
        element.getAttribute("title") ?? "",
        element.getAttribute("aria-label") ?? "",
      ])
      .join(" ")
      .replace(/\s/gu, "");
  }
  for (const status of ["unavailable", "missing"] as const) {
    const finalMargin: ProjectMarginData = {
      source: { status, message: "Current category source is separate from FINAL" },
      cashSource: { status: "unavailable", message: "Current cash source unavailable" },
      finalSnapshotSource: { status: "ready" },
      cash: null,
      finalSnapshot,
    };
    const finalData: ProjectTabsProps = {
      ...initial,
      project: { ...initial.project, status: "COMPLETED" },
      projectBudgetDashboard: null,
      projectBudgetSource: { status, message: "Current budget source is separate from FINAL" },
      projectMarginData: finalMargin,
    };
    await render(finalData);
    assert(
      host.textContent?.includes("Margin akhir tersimpan"),
      `FINAL survives current budget ${status}`,
    );
    for (const amount of [
      "1.234.567,89",
      "7.654.321,98",
      "6.000.000,25",
      "6.419.754,09",
      "419.753,84",
      "12.345,67",
    ]) {
      assert(
        exactTitles().includes(amount),
        `Stored FINAL exact amount ${amount} remains accessible with budget ${status}`,
      );
    }
    assert(host.textContent?.includes("Ringkasan saat proyek ditutup"));
    assert(host.textContent?.includes("13 Okt 2026"), "Frozen closing timestamp remains visible");
    assert(
      host.textContent?.includes(
        status === "missing"
          ? "Budget saat ini belum tersedia"
          : "Kategori saat ini belum dapat dimuat",
      ),
    );
    assert(
      host.textContent?.includes("Realisasi kas belum dapat dimuat"),
      "Current cash error is separate from frozen closing cash",
    );
    assert(
      !host.querySelector('[aria-label="Perbandingan kategori terhadap margin"]'),
      "Failed current categories never become a healthy zero table",
    );
    assert(!maybeButton("Periksa kesiapan penutupan"));
    assert(!maybeButton("Tinjau penutupan proyek"));
    assert.equal(host.querySelector("textarea"), null);
    const readCount: number = reads.length;
    await resize(390);
    for (const amount of ["1.234.567,89", "7.654.321,98", "6.000.000,25", "419.753,84"]) {
      assert(
        exactTitles().includes(amount),
        `Native/mobile composition preserves stored FINAL cents ${amount}`,
      );
    }
    assert(!maybeButton("Periksa kesiapan penutupan"));
    await resize(1280);
    assert.equal(reads.length, readCount, "Viewing a completed FINAL performs no closing read");

    await render(finalData, ["view:project", "update:budget", "close:project"]);
    assert(host.textContent?.includes("Akses margin proyek terbatas"));
    assert(
      !exactTitles().includes("1.234.567,89"),
      "Domain denial hides stored FINAL as well as current margin",
    );
    await render({
      ...finalData,
      projectMarginData: { ...finalMargin, source: { status: "restricted" } },
    });
    assert(host.textContent?.includes("Akses margin terbatas"));
    assert(
      !exactTitles().includes("1.234.567,89"),
      "Explicit source restriction cannot leak a supplied FINAL snapshot",
    );
  }
  assert.equal(writes.length, 1, "FINAL/error/restriction views never close a project");
  assert.equal(new URL(window.location.href).searchParams.get("keep"), "1");
  assert.equal(window.location.hash, "#rincian");
  console.log("Project Margin actual owner DOM regressions passed");
} finally {
  await act(async (): Promise<void> => {
    root.unmount();
  });
  await browser.happyDOM.close();
}
