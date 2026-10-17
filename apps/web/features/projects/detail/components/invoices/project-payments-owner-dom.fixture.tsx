import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { WorkflowFormSheet } from "@/components/ui";
import type { ProjectTabsProps } from "../../types/project-tabs-types";
import type { recordClientPayment } from "@/app/actions/finance/record-client-payment";
import type { getInvoicePrefillContext } from "@/app/actions/finance/get-invoice-prefill-context";
import type { InvoicePrefillResult } from "@atria/core/finance/invoice-prefill";
import type { PermissionKey } from "@atria/core/auth/permissions";
import type { listExpenseDrafts } from "@/app/actions/finance/expense-drafts";

const browser = new Window({
  url: "https://atria.test/projects/fixture?tab=payments&keep=1#rincian",
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
let currentPath = "/projects/fixture";
const nextNavigation = await import("next/navigation");
mock.module("next/navigation", (): typeof nextNavigation => ({
  ...nextNavigation,
  usePathname: (): string => currentPath,
  useSearchParams: (): ReturnType<typeof nextNavigation.useSearchParams> =>
    new nextNavigation.ReadonlyURLSearchParams(window.location.search),
  useRouter: (): ReturnType<typeof nextNavigation.useRouter> => ({
    bfcacheId: "payments-owner-fixture",
    back: (): void => {},
    forward: (): void => {},
    refresh: (): void => {},
    push: (): void => {},
    replace: (): void => {},
    prefetch: (): void => {},
  }),
}));

const ui = await import("@/components/ui");
/** Geometry only: real selectors, controls, owner review/recovery/dismissal remain under test. */
function SheetProbe(
  props: React.ComponentProps<typeof WorkflowFormSheet>,
): React.JSX.Element | null {
  if (!props.open) return null;
  return (
    <section data-payment-sheet aria-label={props.title}>
      <aside data-payment-summary>{props.desktopAsideSummary}</aside>
      {props.children}
      <button
        type="button"
        data-payment-primary
        disabled={props.disabled || props.pending}
        onClick={props.onPrimary}
      >
        {props.primaryLabel}
      </button>
      {props.secondaryLabel ? (
        <button
          type="button"
          data-payment-secondary
          disabled={props.pending}
          onClick={props.onSecondary}
        >
          {props.secondaryLabel}
        </button>
      ) : null}
      <button type="button" data-payment-close disabled={props.pending} onClick={props.onClose}>
        Test close payment
      </button>
      <output data-payment-pending>{String(props.pending)}</output>
    </section>
  );
}
mock.module("@/components/ui", () => ({ ...ui, WorkflowFormSheet: SheetProbe }));
mock.module("@/features/projects/detail/components/shared/rap-rab-manager", () => ({
  RapRabManager: (): React.JSX.Element => <p>Specialized RAP</p>,
}));
type PaymentInput = Parameters<typeof recordClientPayment>[0];
type PaymentResult = Awaited<ReturnType<typeof recordClientPayment>>;
let submitted: PaymentInput | null = null;
let finishPayment: ((result: PaymentResult) => void) | null = null;
mock.module("@/app/actions/finance/record-client-payment", () => ({
  recordClientPayment: (input: PaymentInput): Promise<PaymentResult> => {
    submitted = input;
    return new Promise<PaymentResult>((resolve) => {
      finishPayment = resolve;
    });
  },
}));
type PrefillResult = Awaited<ReturnType<typeof getInvoicePrefillContext>>;
const prefills: { readonly projectId: string; readonly finish: (result: PrefillResult) => void }[] =
  [];
mock.module("@/app/actions/finance/get-invoice-prefill-context", () => ({
  getInvoicePrefillContext: (
    input: Parameters<typeof getInvoicePrefillContext>[0],
  ): Promise<PrefillResult> =>
    new Promise<PrefillResult>((resolve) => {
      prefills.push({ projectId: input.projectId, finish: resolve });
    }),
}));
let invoiceWrites = 0;
mock.module("@/app/actions/finance/create-client-invoice", () => ({
  createClientInvoice: async (): Promise<never> => {
    invoiceWrites += 1;
    throw new Error("Owner fixture must never create a real invoice");
  },
}));
type DraftRead = Awaited<ReturnType<typeof listExpenseDrafts>>;
const draftReads: Array<(result: DraftRead) => void> = [];
let draftReadCount = 0;
mock.module("@/app/actions/finance/expense-drafts", () => ({
  listExpenseDrafts: (): Promise<DraftRead> => {
    draftReadCount += 1;
    return new Promise<DraftRead>((resolve) => draftReads.push(resolve));
  },
  discardExpenseDraft: async (): Promise<never> => {
    throw new Error("Read QA does not discard drafts");
  },
}));
const { createRoot } = await import("react-dom/client");
const { PermissionsProvider } = await import("@/components/auth/permissions-provider");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { useWorkspaceViewportPresentation } = await import("@/lib/navigation/workspace-viewport");
const { ActivityDetailProvider } =
  await import("@/features/activity-detail/components/activity-detail-provider");
const { ProjectStateProvider, useProjectState } = await import("../shared/project-state-context");
const { ProjectTabs } = await import("../shared/project-tabs");
const { GlobalInvoiceDrawer } = await import("./global-invoice-drawer");
const { projectOperationsFixtureData, projectOperationsFixturePermissions } =
  await import("../../../../../.storybook/project-operations-data.fixture");
const base = projectOperationsFixtureData("complete");
const invoice = {
  id: "10000000-0000-4000-8000-000000000001",
  invoiceNumber: "INV-MENTENG-OWNER-01",
  amount: "100000.75",
  status: "PARTIALLY_PAID" as const,
  stage: "DP",
  dueDate: new Date("2026-10-20T00:00:00+07:00"),
  createdAt: new Date("2026-10-01T00:00:00+07:00"),
  payments: [
    {
      id: "10000000-0000-4000-8000-000000000002",
      amountPaid: "10000.25",
      paymentDate: new Date("2026-10-02T00:00:00+07:00"),
      referenceNumber: "RECEIPT-ORIGINAL",
    },
  ],
};
const accounts = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    name: "Kas Utama",
    bankName: "BCA",
    accountNumber: "001-ORIGINAL",
    balance: "1000000.25",
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    name: "Penerimaan Proyek",
    bankName: "Mandiri",
    accountNumber: "002-ORIGINAL",
    balance: "2000000.50",
  },
];
const initial: ProjectTabsProps = {
  ...base,
  invoices: [invoice],
  bankAccounts: accounts,
  projectInvoicesSource: { status: "ready" },
};
const permissions: readonly PermissionKey[] = [
  ...projectOperationsFixturePermissions("complete"),
  "view:client_invoice",
  "create:client_invoice",
  "reconcile:client_invoice",
  "view:bank_account",
];
function LockProbe(): React.JSX.Element {
  const state = useProjectState();
  return <output data-project-lock>{String(state.isLocked)}</output>;
}
function Owner({
  data,
  globalOnly = false,
}: {
  readonly data: ProjectTabsProps;
  readonly globalOnly?: boolean;
}): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation();
  return (
    <WorkspacePresentationProvider presentation={presentation}>
      <ui.DesktopUIProvider responsive>
        <PermissionsProvider permissions={permissions}>
          <ProjectStateProvider>
            <ActivityDetailProvider>
              {globalOnly ? (
                <GlobalInvoiceDrawer />
              ) : (
                <>
                  <LockProbe />
                  <ProjectTabs {...data} />
                </>
              )}
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
function button(text: string): HTMLButtonElement {
  const found = [...document.querySelectorAll("button")].find((node) => node.textContent === text);
  assert(found, `Button ${text} exists`);
  return found;
}
function option(text: string): HTMLElement {
  const found = [
    ...document.querySelectorAll<HTMLElement>('[role="option"], [role="menuitem"]'),
  ].find((node) => node.textContent?.includes(text));
  assert(found, `Option ${text} exists`);
  return found;
}
function control(label: string): HTMLButtonElement {
  const found = [
    ...host.querySelectorAll<HTMLButtonElement>("[data-payment-sheet] button[aria-haspopup]"),
  ].find((node) => {
    const labelId = node.getAttribute("aria-labelledby") ?? "";
    return labelId
      .split(" ")
      .some((key) => document.getElementById(key)?.textContent?.includes(label));
  });
  assert(found, `Select ${label} exists`);
  return found;
}
async function type(element: HTMLInputElement | HTMLTextAreaElement, value: string): Promise<void> {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
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
}
async function render(data: ProjectTabsProps, globalOnly = false): Promise<void> {
  await act(async (): Promise<void> => {
    root.render(<Owner data={data} globalOnly={globalOnly} />);
  });
  await settle();
}
function input(label: string): HTMLInputElement {
  const fieldLabel = [...host.querySelectorAll("[data-payment-sheet] label")].find((entry) =>
    entry.textContent?.includes(label),
  );
  const fieldId = fieldLabel?.getAttribute("for");
  const found = fieldId ? document.getElementById(fieldId) : null;
  assert(found instanceof HTMLInputElement, `Actual input ${label} exists`);
  return found;
}
function notes(): HTMLTextAreaElement {
  const found = host.querySelector<HTMLTextAreaElement>("[data-payment-sheet] textarea");
  assert(found, "Actual invoice note exists");
  return found;
}
async function navigate(pathname: string, search: string): Promise<void> {
  await act(async (): Promise<void> => {
    currentPath = pathname;
    window.history.replaceState({}, "", `${pathname}${search}#rincian`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await render(initial, true);
}
function prefill(projectCode: string): InvoicePrefillResult {
  return {
    projectCode,
    suggestedInvoiceNumber: `INV-${projectCode}-PREFILL`,
    suggestedStage: "DP",
    suggestedAmount: 30000.25,
    suggestedDueDate: "2026-11-01",
    suggestedNotes: `Default ${projectCode}`,
    totalContractValue: 100000,
    totalInvoiced: 0,
    remainingUnbilled: 100000,
    activeInvoicesCount: 0,
    presets: [
      {
        label: "Uang muka 30%",
        percentage: 0.3,
        stage: "DP",
        amount: 30000.25,
        notes: `DP ${projectCode}`,
      },
      {
        label: "Progress 20%",
        percentage: 0.2,
        stage: "PROGRESS_1",
        amount: 20000.75,
        notes: `Progress ${projectCode}`,
      },
    ],
  };
}
try {
  await render(initial);
  assert.equal(draftReadCount, 0, "Payments does not eagerly read expense drafts");
  function projectTab(label: string): HTMLElement {
    const tab = [...host.querySelectorAll<HTMLElement>('[role="tab"]')].find(
      (item) => item.textContent?.trim() === label,
    );
    assert(tab, `Project tab ${label} exists`);
    return tab;
  }
  await click(projectTab("Operasional"));
  await click(projectTab("Pengeluaran"));
  assert.equal(draftReadCount, 1, "Opening project expenses reads the current user's draft list");
  const finishDrafts = draftReads.shift();
  assert(finishDrafts);
  await act(async (): Promise<void> =>
    finishDrafts({
      success: true,
      data: [
        {
          id: "retained-project-draft",
          revision: 1,
          projectId: initial.project.id,
          projectName: initial.project.name,
          itemCount: 1,
          totalAmount: 125.25,
          hasReceipt: false,
          lastSavedAt: new Date("2026-10-16T00:00:00Z"),
        },
      ],
    }),
  );
  await settle();
  assert(
    [...host.querySelectorAll("button")].some((button) =>
      button.textContent?.includes("1 draft siap dilanjutkan"),
    ),
    "The current project draft summary is available",
  );
  await click(projectTab("Stok"));
  await click(projectTab("Pengeluaran"));
  assert.equal(
    draftReadCount,
    1,
    "Actual ProjectTabs preserves loaded drafts across conditional child unmount",
  );
  assert.equal(host.querySelector('[aria-label="Memuat draft pengeluaran"]'), null);
  assert(
    [...host.querySelectorAll("button")].some((button) =>
      button.textContent?.includes("1 draft siap dilanjutkan"),
    ),
    "The current project draft summary is available",
  );
  await click(projectTab("Keuangan"));
  const firstInvoiceRow = host.querySelector<HTMLElement>(
    'table[aria-label="Invoice klien proyek"] tbody tr',
  );
  assert(firstInvoiceRow, "Invoice collection is available without an initial selected row");
  assert.equal(host.querySelector('[data-atria-selected="true"]'), null);
  await click(firstInvoiceRow);
  await click(button("Catat penerimaan"));
  assert(host.querySelector("[data-payment-sheet]"), "Actual receipt owner opens");
  await click(control("Rekening Penerima Dana"));
  await click(option("Penerimaan Proyek"));
  await type(input("Nominal Diterima"), "12345.67");
  const originalReference = input("Nomor Referensi Bukti Transfer");
  await type(originalReference, "TRANSFER-REVIEWED-ORIGINAL");
  await act(async (): Promise<void> => {
    originalReference.focus();
  });
  const summary = host.querySelector("[data-payment-summary]")?.textContent;
  await resize(390);
  await resize(1440);
  assert.equal(
    input("Nomor Referensi Bukti Transfer"),
    originalReference,
    "Resize retains exact input DOM",
  );
  assert.equal(document.activeElement, originalReference, "Resize preserves focused receipt field");
  assert.equal(originalReference.value, "TRANSFER-REVIEWED-ORIGINAL");
  const changed: ProjectTabsProps = {
    ...initial,
    project: {
      ...initial.project,
      name: "Incoming replacement project",
      status: "COMPLETED",
      totalContractValue: "999999.99",
    },
    invoices: [
      {
        ...invoice,
        id: "replacement-invoice",
        invoiceNumber: "INV-UNREVIEWED",
        amount: "999999.99",
        payments: [],
      },
    ],
    bankAccounts: [
      {
        ...accounts[0]!,
        id: "replacement-bank",
        name: "Incoming replacement bank",
        balance: "999999.99",
      },
    ],
    projectBudgetDashboard: null,
    projectBudgetSource: { status: "unavailable" },
    projectInvoicesSource: {
      status: "unavailable",
      message: "Incoming invoice source unavailable",
    },
  };
  await render(changed);
  assert.equal(input("Nomor Referensi Bukti Transfer"), originalReference);
  assert.equal(
    host.querySelector("[data-payment-summary]")?.textContent,
    summary,
    "Incoming invoice/account/source does not alter reviewed context",
  );
  assert.equal(host.querySelector("[data-project-lock]")?.textContent, "false");
  assert(!host.textContent?.includes("Incoming replacement project"));
  await click(button("Tinjau"));
  assert(
    host.querySelector("[data-payment-sheet]")?.getAttribute("aria-label") ===
      "Tinjau penerimaan klien",
  );
  assert(
    host.querySelector("[data-payment-sheet]")?.textContent?.includes("002-ORIGINAL"),
    "Review retains original chosen account identity",
  );
  await click(button("Catat"));
  assert(submitted, "Safe mocked writer receives the explicit human action");
  assert.equal(Reflect.get(submitted, "clientInvoiceId"), invoice.id);
  assert.equal(Reflect.get(submitted, "bankAccountId"), accounts[1]?.id);
  assert.equal(Reflect.get(submitted, "amountPaid"), 12345.67);
  assert.equal(Reflect.get(submitted, "referenceNumber"), "TRANSFER-REVIEWED-ORIGINAL");
  const submittedPaymentDate: unknown = Reflect.get(submitted, "paymentDate");
  assert(submittedPaymentDate instanceof Date);
  assert.equal(host.querySelector("[data-payment-pending]")?.textContent, "true");
  assert(
    host.querySelector<HTMLButtonElement>("[data-payment-close]")?.disabled,
    "Pending receipt cannot dismiss",
  );
  assert(
    host.querySelector<HTMLButtonElement>("[data-payment-primary]")?.disabled,
    "Pending receipt cannot submit twice",
  );
  await render({
    ...changed,
    invoices: [],
    bankAccounts: [],
    projectInvoicesSource: { status: "missing" },
  });
  await resize(360);
  await resize(1280);
  assert.equal(host.querySelector("[data-project-lock]")?.textContent, "false");
  assert.equal(host.querySelector("[data-payment-summary]")?.textContent, summary);
  assert(finishPayment);
  await act(async (): Promise<void> => {
    finishPayment?.({
      success: false,
      error: { code: "CONFLICT", message: "Safe receipt fixture failure" },
    });
  });
  await click(button("Ubah"));
  assert.equal(
    input("Nomor Referensi Bukti Transfer").value,
    "TRANSFER-REVIEWED-ORIGINAL",
    "Failed action retains editable reference",
  );
  assert.equal(input("Nominal Diterima").value, "12345.67", "Failed action retains exact cents");
  await click(button("Test close payment"));
  assert(document.body.textContent?.includes("Perubahan belum selesai"));
  await click(button("Buang Perubahan"));
  assert.equal(host.querySelector("[data-payment-sheet]"), null);
  assert.equal(
    host.querySelector("[data-project-lock]")?.textContent,
    "true",
    "Latest source adopted after explicit discard",
  );
  assert(host.textContent?.includes("Incoming replacement project"));

  // The actual global wrapper uses its pathname key: route transitions isolate form state.
  await navigate("/projects/project-a", "?tab=payments&new-invoice=true&keep=1");
  assert.equal(prefills.at(-1)?.projectId, "project-a");
  const aRequest = prefills.at(-1);
  assert(aRequest);
  await type(input("Nomor Invoice"), "INV-A-USER-DRAFT");
  await type(input("Nominal Tagihan"), "54321.45");
  await type(notes(), "Draft milik proyek A");
  const aStored = window.localStorage.getItem("atria:client-invoice:project-a");
  assert(aStored?.includes("Draft milik proyek A"));
  await navigate("/projects/project-b", "?tab=payments&new-invoice=true&keep=1");
  assert.equal(
    input("Nomor Invoice").value,
    "",
    "New route must not carry previous project's invoice draft",
  );
  assert.equal(notes().value, "");
  assert.equal(
    window.localStorage.getItem("atria:client-invoice:project-a"),
    aStored,
    "Routing never overwrites previous namespace",
  );
  await act(async (): Promise<void> => {
    aRequest.finish({ success: true, data: prefill("A-LATE") });
  });
  assert.equal(
    input("Nomor Invoice").value,
    "",
    "Unmounted project's late prefill cannot populate next project's form",
  );
  const bRequest = prefills.at(-1);
  assert.equal(bRequest?.projectId, "project-b");
  assert(bRequest);
  await act(async (): Promise<void> => {
    bRequest.finish({ success: true, data: prefill("B") });
  });
  assert.equal(input("Nomor Invoice").value, "INV-B-PREFILL");
  assert.equal(button("Uang muka 30%").getAttribute("aria-pressed"), "true");
  const progressPreset = button("Progress 20%");
  await click(progressPreset);
  assert.equal(input("Nominal Tagihan").value, "20000.75");
  assert.equal(notes().value, "Progress B");
  assert.equal(progressPreset.getAttribute("aria-pressed"), "true");
  assert.equal(button("Uang muka 30%").getAttribute("aria-pressed"), "false");
  await type(notes(), "Draft milik proyek B");
  const bStored = window.localStorage.getItem("atria:client-invoice:project-b");
  assert(bStored?.includes("Draft milik proyek B"));
  await navigate("/projects/project-a", "?tab=payments&new-invoice=true&keep=1");
  assert.equal(
    input("Nomor Invoice").value,
    "INV-A-USER-DRAFT",
    "Returning to A recovers only A draft",
  );
  assert.equal(input("Nominal Tagihan").value, "54321.45");
  assert.equal(notes().value, "Draft milik proyek A");
  assert.equal(window.localStorage.getItem("atria:client-invoice:project-b"), bStored);
  const noteDom = notes();
  await act(async (): Promise<void> => {
    noteDom.focus();
  });
  await resize(390);
  await resize(1440);
  assert.equal(notes(), noteDom, "Same-path responsive resize never remounts global invoice draft");
  assert.equal(document.activeElement, noteDom);
  await navigate("/projects/project-a", "?tab=payments&new-invoice=true&keep=1&invoice-filter=all");
  assert.equal(notes(), noteDom, "Same pathname query changes preserve the invoice form owner");
  assert.equal(notes().value, "Draft milik proyek A");
  assert.equal(invoiceWrites, 0);
  assert.equal(new URL(window.location.href).searchParams.get("keep"), "1");
  assert.equal(window.location.hash, "#rincian");
  console.log("Project payments actual owner DOM regressions passed");
} finally {
  await act(async (): Promise<void> => {
    root.unmount();
  });
  await browser.happyDOM.close();
}
