import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { ClientInvoiceItem } from "../../types/project-invoices-types";

const browserWindow = new Window({
  url: "https://atria.test/projects/fixture",
  width: 1440,
  height: 976,
});
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
  usePathname: (): string => "/projects/fixture",
  useSearchParams: (): ReturnType<typeof nextNavigation.useSearchParams> =>
    new nextNavigation.ReadonlyURLSearchParams(window.location.search),
  useRouter: (): ReturnType<typeof nextNavigation.useRouter> => ({
    bfcacheId: "project-selection-fixture",
    back: (): void => {},
    forward: (): void => {},
    refresh: (): void => {},
    push: (): void => {},
    replace: (): void => {},
    prefetch: (): void => {},
  }),
}));
const visibility = document.createElement("style");
const visibilityRules =
  ".hidden{display:none}@media (min-width:1280px){.xl\\:block{display:block}.xl\\:hidden{display:none}}";
visibility.textContent = visibilityRules;
document.head.append(visibility);
const { createRoot } = await import("react-dom/client");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { DesktopUIProvider, Button, FormSheet } = await import("@/components/ui");
const { ProjectOverviewDesktop } = await import("../overview/project-overview-desktop");
const { ProjectMarginDesktop } = await import("../overview/project-margin-desktop");
const { RapDesktopTable } = await import("../rap/rap-desktop-table");
const { materialDesktopRows, packageDesktopRows } = await import("../rap/rap-desktop-model");
const { RabDesktopPanel } = await import("../rab/rab-desktop-panel");
const { ProjectStockDesktop } = await import("../stock/project-stock-desktop");
const { ProjectPaymentsDesktop } = await import("../invoices/project-payments-desktop");
const { RapRabManager } = await import("./rap-rab-manager");
const { PermissionsProvider } = await import("@/components/auth/permissions-provider");
const { projectOperationsFixtureData } =
  await import("../../../../../.storybook/project-operations-data.fixture");
const { rapRabFixtureData, rapRabFixturePermissions } =
  await import("../../../../../.storybook/rap-rab-data.fixture");
const data = projectOperationsFixtureData();
const planning = rapRabFixtureData();
function requireFixture<Value>(value: Value | null | undefined): Value {
  assert(value !== null && value !== undefined, "Representative existing fixture is complete");
  return value;
}
const budget = requireFixture(data.projectBudgetDashboard);
const estimate = requireFixture(planning.rabEstimate);
const rap = requireFixture(planning.rap);
const stock = requireFixture(data.projectStockData);
const invoice: ClientInvoiceItem = {
  id: "invoice-fixture",
  invoiceNumber: "INV-SELECTION",
  stage: "PROGRESS",
  status: "PARTIALLY_PAID",
  amount: "100.25",
  dueDate: new Date("2026-10-30T00:00:00Z"),
  createdAt: new Date("2026-10-01T00:00:00Z"),
  payments: [
    {
      id: "receipt-fixture",
      amountPaid: "1.25",
      paymentDate: new Date("2026-10-01T00:00:00Z"),
      referenceNumber: "TRF-SELECTION",
    },
  ],
};
type Scenario =
  | "overview"
  | "margin"
  | "rap-material"
  | "rap-tukang"
  | "rap-subcon"
  | "manager-rap"
  | "manager-rab"
  | "rab"
  | "stock"
  | "movements"
  | "invoices"
  | "receipts";
const noop = (): void => {};
const command = (): never => {
  throw new Error("Selection must not execute a workflow command");
};
function Owner({
  scenario,
  pending = false,
}: {
  readonly scenario: Scenario;
  readonly pending?: boolean;
}): React.JSX.Element {
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  let content: React.JSX.Element;
  if (scenario === "manager-rap" || scenario === "manager-rab")
    content = (
      <PermissionsProvider permissions={rapRabFixturePermissions("owner")}>
        <RapRabManager
          {...planning}
          userRole="OWNER"
          mode={scenario === "manager-rap" ? "rap" : "rab"}
        />
      </PermissionsProvider>
    );
  else if (scenario === "overview")
    content = (
      <ProjectOverviewDesktop
        budget={budget}
        contractValue={budget.contractValue}
        actions={[]}
        readiness={[]}
        selectedCategoryId={selectedCategoryId}
        categorySort={undefined}
        canUpdateBudget={false}
        canApproveBudget={false}
        canReallocate={false}
        decisionPending={pending}
        onCategorySelect={setSelectedCategoryId}
        onCategoryClose={(): void => setSelectedCategoryId(null)}
        onCategorySort={noop}
        onBudgetDecision={command}
        onReallocate={command}
        onNavigate={command}
      />
    );
  else if (scenario === "margin")
    content = (
      <ProjectMarginDesktop
        budget={budget}
        marginData={{
          source: { status: "ready" },
          cashSource: { status: "missing" },
          finalSnapshotSource: { status: "missing" },
          cash: null,
          finalSnapshot: null,
        }}
        projectStatus="ACTIVE"
        selectedCategoryId={selectedCategoryId}
        onCategorySelect={setSelectedCategoryId}
        onCategoryClose={(): void => setSelectedCategoryId(null)}
        onNavigate={command}
        onRetry={command}
      />
    );
  else if (scenario.startsWith("rap-")) {
    const kind =
      scenario === "rap-material" ? "MATERIAL" : scenario === "rap-tukang" ? "TUKANG" : "SUBCON";
    content = (
      <RapDesktopTable
        kind={kind}
        active
        rows={
          kind === "MATERIAL"
            ? materialDesktopRows(rap.items)
            : packageDesktopRows(
                planning.categoryPlanItems.filter((item) => item.expenseCategoryCode === kind),
                kind,
              )
        }
        onOpen={(): void => setModalOpen(true)}
      />
    );
  } else if (scenario === "rab")
    content = (
      <RabDesktopPanel
        rabEstimate={{ ...estimate, status: "DRAFT" }}
        isRevisionDraft={false}
        approvedBaseline={null}
        visibleRabValue={Number(estimate.approvedValue)}
        staleSourceLabels={[]}
        isPending={pending}
        handleRefreshRabSources={command}
        canManageRab
        canCreateRab={false}
        rap={rap}
        setSourcePickerOpen={command}
        setManualLineOpen={command}
        openEditBundle={(): void => setModalOpen(true)}
        setRabItemEditorId={(): void => setModalOpen(true)}
        openCreateBundle={command}
        onOpenExport={command}
      />
    );
  else if (scenario === "stock" || scenario === "movements")
    content = (
      <ProjectStockDesktop
        rap={stock.rap}
        source={stock.source}
        stockMovements={data.stockMovements}
        onActivityOpen={command}
      />
    );
  else
    content = (
      <ProjectPaymentsDesktop
        invoices={[invoice]}
        contractValue={1000}
        canCreateInvoice={false}
        canRecordPayment={false}
        locked={false}
        schedulePending={false}
        createError={null}
        createSuccess={null}
        onCreateInvoice={command}
        onGenerateSchedule={command}
        onRecordPayment={command}
        onOpenInvoice={command}
        onOpenReceipt={command}
      />
    );
  return (
    <WorkspacePresentationProvider presentation="desktop">
      <DesktopUIProvider>
        {content}
        <FormSheet
          open={modalOpen}
          title="Rincian perencanaan"
          dismissal={{ mode: "discard" }}
          onClose={(): void => setModalOpen(false)}
        >
          <input aria-label="Catatan perencanaan" />
          <Button onClick={(): void => setModalOpen(false)}>Tutup rincian perencanaan</Button>
        </FormSheet>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
async function settle(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
  });
}
async function render(scenario: Scenario, pending = false): Promise<void> {
  await act(async (): Promise<void> =>
    root.render(<Owner key={scenario} scenario={scenario} pending={pending} />),
  );
  await settle();
}
async function width(value: number): Promise<void> {
  await act(async (): Promise<void> => {
    browserWindow.happyDOM.setWindowSize({ width: value, height: 976 });
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
async function space(element: HTMLElement): Promise<void> {
  await keyboard(element, " ");
}
async function keyboard(element: HTMLElement, key: "Enter" | " "): Promise<void> {
  await act(async (): Promise<void> => {
    element.focus();
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    element.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }));
  });
  await settle();
}
function visible(element: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement)
    if (current.hasAttribute("hidden") || getComputedStyle(current).display === "none")
      return false;
  return true;
}
function table(): HTMLTableElement {
  const element = [...host.querySelectorAll<HTMLTableElement>("table")].find(visible);
  assert(element, "Active collection has a visible table");
  return element;
}
function first(): HTMLElement {
  const row = table().querySelector<HTMLElement>("tbody tr");
  assert(row, "Fixture collection contains a selectable row");
  return row;
}
function details(): readonly Element[] {
  return [...host.querySelectorAll('[aria-label^="Rincian "]')].filter(visible);
}
function selectedCount(): number {
  return table().querySelectorAll('tbody tr[aria-selected="true"]').length;
}
function backButton(): HTMLButtonElement {
  const button = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) => visible(candidate) && candidate.textContent?.trim() === "Kembali ke daftar",
  );
  assert(button, "Narrow planning detail has a visible Back button");
  return button;
}
async function searchFor(value: string): Promise<HTMLInputElement> {
  const input = [...host.querySelectorAll<HTMLInputElement>('input[type="search"]')].find(visible);
  assert(input, "Planning collection exposes its search field");
  await act(async (): Promise<void> => {
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    assert(setter);
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
  return input;
}
const scenarios: readonly Scenario[] = [
  "overview",
  "margin",
  "rap-material",
  "rap-tukang",
  "rap-subcon",
  "rab",
  "stock",
  "movements",
  "invoices",
  "receipts",
];
try {
  for (const scenario of scenarios) {
    await width(1440);
    window.history.replaceState(
      {},
      "",
      `/projects/fixture?stock-view=${scenario === "movements" ? "activity" : "materials"}&payments-view=${scenario === "receipts" ? "receipts" : "invoices"}`,
    );
    await render(scenario);
    assert.equal(selectedCount(), 0, `${scenario}: starts without an active row`);
    assert.equal(details().length, 0, `${scenario}: starts without a detail panel`);
    await press(first());
    assert.equal(selectedCount(), 1, `${scenario}: clicking selects one row`);
    assert(details().length > 0, `${scenario}: explicit selection opens detail`);
    assert.equal(document.querySelector('[role="dialog"]'), null, "Selection opens no editor");
    await press(first());
    assert.equal(selectedCount(), 0, `${scenario}: clicking the selected row deselects it`);
    assert.equal(details().length, 0, `${scenario}: deselection closes detail`);
    await space(first());
    assert.equal(selectedCount(), 1, `${scenario}: keyboard Space selects`);
    await space(first());
    assert.equal(selectedCount(), 0, `${scenario}: keyboard Space deselects`);
    await press(first());
    await width(1093);
    assert(details().length > 0, `${scenario}: resize retains explicit detail`);
    const back = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) =>
        visible(button) && /^Kembali ke (daftar|kategori)$/.test(button.textContent?.trim() ?? ""),
    );
    assert(back, `${scenario}: narrow detail retains Back`);
    await press(back);
    assert.equal(selectedCount(), 0, `${scenario}: narrow Back returns to unselected list`);
    await width(1440);
    assert.equal(selectedCount(), 0, `${scenario}: widening does not invent an active row`);
    assert.equal(details().length, 0, `${scenario}: widening does not reopen detail`);
    if (scenario === "overview" || scenario === "rab") {
      await press(first());
      await render(scenario, true);
      await press(first());
      assert.equal(selectedCount(), 1, `${scenario}: pending guards preserve selection`);
      await render(scenario);
      await press(first());
      assert.equal(selectedCount(), 0, `${scenario}: selection can clear after pending settles`);
    }
  }
  for (const scenario of [
    "rap-material",
    "rap-tukang",
    "rap-subcon",
    "rab",
    "stock",
    "movements",
  ] as const) {
    await width(1024);
    window.history.replaceState(
      {},
      "",
      `/projects/fixture?stock-view=${scenario === "movements" ? "activity" : "materials"}`,
    );
    await render(scenario);
    for (const method of ["pointer", "Enter", " "] as const) {
      const invoking = first();
      if (method === "pointer") {
        await act(async (): Promise<void> => invoking.focus());
        await press(invoking);
      } else await keyboard(invoking, method);
      assert.ok(
        document.activeElement === backButton(),
        `${scenario} ${method}: hidden table focus moves to visible Back`,
      );
      await press(backButton());
      assert.ok(
        document.activeElement === invoking,
        `${scenario} ${method}: Back restores the exact invoking native row`,
      );
    }
    await width(1440);
    const invoking = first();
    await keyboard(invoking, "Enter");
    assert.ok(document.activeElement === invoking, `${scenario}: wide row retains focus`);
    await width(1024);
    assert.ok(document.activeElement === backButton(), `${scenario}: narrowing repairs focus`);
    await width(1280);
    assert.ok(
      document.activeElement instanceof HTMLElement &&
        visible(document.activeElement) &&
        details().some((detail) => detail.contains(document.activeElement)),
      `${scenario}: widening repairs removed/hidden Back focus inside the visible detail`,
    );
    const search = await searchFor("no-such-planning-record");
    assert.equal(details().length, 0, `${scenario}: search removes context from current page`);
    assert.ok(document.activeElement === search, `${scenario}: filtering preserves search focus`);
    await searchFor("");
    if (details().length === 0) await keyboard(first(), " ");
    if (scenario === "stock" || scenario === "movements") {
      await width(1024);
      await press(backButton());
      continue;
    }
    const open = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) =>
        visible(button) &&
        /^(Buka detail|Edit paket|Edit item)/.test(button.textContent?.trim() ?? ""),
    );
    assert(open, `${scenario}: selected context exposes its editor command`);
    await press(open);
    const modalInput = document.querySelector<HTMLInputElement>(
      'input[aria-label="Catatan perencanaan"]',
    );
    assert(modalInput, `${scenario}: shared form sheet opens from the context command`);
    await act(async (): Promise<void> => modalInput.focus());
    await width(1024);
    assert.ok(document.activeElement === modalInput, `${scenario}: resize preserves modal focus`);
    const close = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "Tutup rincian perencanaan",
    );
    assert(close);
    await press(close);
    await act(async (): Promise<void> => {
      await new Promise<void>((resolve) => setTimeout(resolve, 400));
    });
    await press(backButton());
  }
  for (const scenario of ["manager-rap", "manager-rab"] as const) {
    await width(1024);
    window.history.replaceState({}, "", "/projects/fixture");
    await render(scenario);
    for (const method of ["Enter", " "] as const) {
      const invoking = first();
      await keyboard(invoking, method);
      assert.ok(
        document.activeElement === backButton(),
        `${scenario} ${method}: actual manager hands focus into visible detail`,
      );
      await press(backButton());
      assert.ok(
        document.activeElement === invoking,
        `${scenario}: actual manager restores invoking row`,
      );
    }
  }
  console.log("Project desktop optional selection matrix passed");
} finally {
  await act(async (): Promise<void> => root.unmount());
  await browserWindow.happyDOM.close();
}
