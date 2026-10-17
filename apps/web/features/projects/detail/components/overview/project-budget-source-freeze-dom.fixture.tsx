import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { OperationalFormSheet } from "@/components/ui";
import type { ProjectTabsProps } from "../../types/project-tabs-types";
import type { reallocateProjectBudget } from "@/app/actions/project/workflow-governance";

const browser = new Window({
  url: "https://atria.test/projects/project?tab=overview",
  width: 1440,
  height: 978,
});
Reflect.set(browser.Element.prototype, "animate", undefined);
for (const key of [
  "window",
  "document",
  "navigator",
  "performance",
  "CSS",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLAnchorElement",
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

const ui = await import("@/components/ui");
// The real owners and form inputs remain under test; browser QA separately covers
// the shared sheet's focus trap, animated dismissal and responsive geometry.
function SheetProbe(
  props: React.ComponentProps<typeof OperationalFormSheet>,
): React.JSX.Element | null {
  if (!props.open) return null;
  return (
    <section aria-label={props.title}>
      <aside data-allocation-summary>{props.desktopAsideSummary}</aside>
      {props.children}
      <button
        type="button"
        data-submit
        disabled={props.disabled}
        onClick={() => props.onSubmit?.()}
      >
        Test submit
      </button>
      <button type="button" data-close onClick={props.onClose}>
        Test close
      </button>
    </section>
  );
}
mock.module("@/components/ui", () => ({ ...ui, OperationalFormSheet: SheetProbe }));
mock.module("next/navigation", () => ({
  useSearchParams: (): URLSearchParams => new URLSearchParams(browser.location.search),
}));
const navigation = await import("@/lib/navigation/workspace-navigation");
mock.module("@/lib/navigation/workspace-navigation", () => ({
  ...navigation,
  useRouter: () => ({ refresh: (): void => undefined }),
}));
mock.module("@/features/projects/detail/components/shared/rap-rab-manager", () => ({
  RapRabManager: (): React.JSX.Element => <p data-specialized-rap>Specialized RAP</p>,
}));

type ReallocationInput = Parameters<typeof reallocateProjectBudget>[0];
type ReallocationResult = Awaited<ReturnType<typeof reallocateProjectBudget>>;
let submitted: ReallocationInput | null = null;
let finish: ((result: ReallocationResult) => void) | null = null;
const governance = await import("@/app/actions/project/workflow-governance");
mock.module("@/app/actions/project/workflow-governance", () => ({
  ...governance,
  reallocateProjectBudget: (input: ReallocationInput): Promise<ReallocationResult> => {
    submitted = input;
    return new Promise<ReallocationResult>((resolve) => {
      finish = resolve;
    });
  },
}));
const { createRoot } = await import("react-dom/client");
const { PermissionsProvider } = await import("@/components/auth/permissions-provider");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { useWorkspaceViewportPresentation } = await import("@/lib/navigation/workspace-viewport");
const { ProjectStateProvider, useProjectState } = await import("../shared/project-state-context");
const { ProjectTabs } = await import("../shared/project-tabs");
const { projectsFixtureBudget } = await import("../../../../../.storybook/projects-data.fixture");
const { ProjectOverviewDesktopLoading } = await import("./project-overview-desktop-loading");
const { ProjectDesktopSkeleton } =
  await import("../../../list/components/views/project-desktop-skeleton");

const budget = projectsFixtureBudget("approved");
const initial: ProjectTabsProps = {
  project: {
    id: budget.projectId,
    name: "Fixture project",
    clientId: "client",
    projectManagerId: "pm",
    totalContractValue: String(budget.contractValue),
    financialHealth: "HEALTHY",
    location: "Jakarta",
    roomArea: null,
    projectType: null,
    coverImageUrl: null,
    notes: null,
    status: "ACTIVE",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    client: { name: "Fixture client", email: null, phone: null, address: null },
    projectManager: { name: "Fixture PM", email: null },
    budget: null,
    raps: [],
    rabEstimates: [],
    categoryPlanItems: [],
    changeOrders: [],
  },
  costCategories: [],
  userRole: "OWNER",
  vendorPaymentApprovalThreshold: 5000000,
  userId: "owner",
  bankAccounts: [],
  costs: [],
  vendorBills: [],
  vendorPayments: [],
  vendors: [],
  projectsForForms: [],
  stockMovements: [],
  invoices: [],
  projectBudgetDashboard: budget,
  projectBudgetSource: { status: "ready" },
  materialMasterCatalog: [],
  pricingTemplateCatalog: [],
};
function LockProbe(): React.JSX.Element {
  const projectState = useProjectState();
  return <output data-project-lock>{String(projectState.isLocked)}</output>;
}
function Owner({ data }: { readonly data: ProjectTabsProps }): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation();
  return (
    <WorkspacePresentationProvider presentation={presentation}>
      <ui.DesktopUIProvider responsive>
        <PermissionsProvider
          permissions={["view:budget", "view:rap", "update:budget", "approve:budget"]}
        >
          <ProjectStateProvider>
            <LockProbe />
            <ProjectTabs {...data} />
          </ProjectStateProvider>
        </PermissionsProvider>
      </ui.DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
function button(label: string): HTMLButtonElement {
  const element = [...document.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === label,
  );
  assert(element, `Missing button ${label}`);
  return element;
}
function reasonField(): HTMLTextAreaElement {
  const element = host.querySelector<HTMLTextAreaElement>("textarea");
  assert(element, "Allocation audit reason remains mounted");
  return element;
}
function focusedElement(): Element | null {
  return document.activeElement;
}
async function settle(milliseconds = 40): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
  });
}
async function width(value: number): Promise<void> {
  await act(async (): Promise<void> => {
    browser.happyDOM.setWindowSize({ width: value, height: 978 });
    window.dispatchEvent(new Event("resize"));
  });
  await settle();
}
async function keyboard(element: HTMLElement, key: "Enter" | " "): Promise<void> {
  await act(async (): Promise<void> => {
    element.focus();
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    focusedElement()?.dispatchEvent(
      new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }),
    );
  });
  await settle();
}
function categoryTable(): HTMLTableElement {
  const element = host.querySelector<HTMLTableElement>(
    'table[aria-label="Budget proyek per kategori"]',
  );
  assert(element, "The category table stays mounted");
  return element;
}
try {
  await act(async (): Promise<void> => {
    root.render(
      <>
        <ProjectDesktopSkeleton />
        <ProjectOverviewDesktopLoading />
      </>,
    );
  });
  assert.equal(
    host.querySelector('[class*="18rem"]'),
    null,
    "Initial portfolio and Budget skeletons reserve no unselected context column",
  );
  await act(async (): Promise<void> => {
    root.render(<ProjectOverviewDesktopLoading showDetail />);
  });
  assert.ok(
    host.querySelector('[class*="18rem"]'),
    "A caller with known context can explicitly reserve its refresh detail column",
  );
  const pending: ProjectTabsProps = {
    ...initial,
    projectBudgetDashboard: { ...budget, status: "PENDING_APPROVAL" },
  };
  await act(async (): Promise<void> => root.render(<Owner data={pending} />));
  await settle();
  await act(async (): Promise<void> => {
    button("Minta revisi").focus();
    button("Minta revisi").click();
  });
  await settle();
  const rejection = document.querySelector<HTMLTextAreaElement>("#project-budget-rejection");
  assert(rejection);
  assert.ok(
    focusedElement() === rejection,
    "The revision reason is auto-focused by the existing dialog",
  );
  const reasonSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  assert(reasonSetter);
  await act(async (): Promise<void> => {
    reasonSetter.call(rejection, "Keep the reviewed allocation and explanation");
    rejection.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await width(390);
  assert.ok(focusedElement() === rejection, "Resize preserves revision focus");
  assert.ok(document.querySelector("#project-budget-rejection") === rejection);
  assert.equal(rejection.value, "Keep the reviewed allocation and explanation");
  await width(1440);
  assert.ok(focusedElement() === rejection);
  await act(async (): Promise<void> => {
    rejection.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  await settle(700);
  assert.equal(document.querySelector('[role="dialog"], [role="alertdialog"]'), null);
  assert.ok(
    focusedElement() !== document.body,
    "Closing an auto-focused budget revision restores a visible logical target",
  );
  assert.equal(focusedElement()?.getAttribute("aria-label"), "Ringkasan budget proyek");
  const category = categoryTable().querySelector<HTMLElement>("tbody tr");
  assert(category);
  await width(1024);
  await keyboard(category, "Enter");
  assert.ok(
    focusedElement() === button("Kembali ke kategori"),
    "Budget category selection focuses visible Back",
  );
  await act(async (): Promise<void> => button("Kembali ke kategori").click());
  await settle();
  assert.ok(focusedElement() === category, "Category Back restores the invoking row");
  await keyboard(category, " ");
  assert.ok(focusedElement() === button("Kembali ke kategori"));
  await act(async (): Promise<void> => button("Kembali ke kategori").click());
  await settle();
  await width(1440);
  await keyboard(category, "Enter");
  await act(async (): Promise<void> => category.focus());
  await width(1024);
  assert.ok(
    focusedElement() === button("Kembali ke kategori"),
    "Shrinking a selected Budget row repairs hidden focus",
  );
  await act(async (): Promise<void> => button("Kembali ke kategori").click());
  await settle();
  assert.ok(focusedElement() === category);
  await width(1440);
  await act(async (): Promise<void> => {
    window.history.replaceState({}, "", `${window.location.pathname}?tab=overview&keep=1#budget`);
  });
  await settle();
  const sortHeader = categoryTable().querySelector<HTMLElement>('th[data-key="allocated"]');
  assert(sortHeader);
  await act(async (): Promise<void> => sortHeader.click());
  await settle();
  const sortedUrl = new URL(window.location.href);
  assert.equal(sortedUrl.searchParams.get("budget-category-sort"), "allocated");
  assert.equal(
    sortedUrl.searchParams.get("budget-category-direction"),
    sortHeader.getAttribute("aria-sort"),
  );
  assert.equal(sortedUrl.searchParams.get("keep"), "1");
  assert.equal(sortedUrl.hash, "#budget");
  await act(async (): Promise<void> => {
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?tab=rap&${new URLSearchParams({ "budget-category-sort": "allocated", "budget-category-direction": "descending" })}`,
    );
  });
  await settle();
  await act(async (): Promise<void> => {
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?tab=overview&budget-category-sort=allocated&budget-category-direction=descending`,
    );
  });
  await settle();
  assert.equal(
    categoryTable().querySelector('th[data-key="allocated"]')?.getAttribute("aria-sort"),
    "descending",
    "Returning to Budget restores category sort from the URL",
  );
  await act(async (): Promise<void> => {
    root.render(null);
    window.history.replaceState({}, "", window.location.pathname);
  });
  await act(async (): Promise<void> => {
    root.render(<Owner data={initial} />);
  });
  assert.equal(host.querySelector("[data-project-lock]")?.textContent, "false");
  await act(async (): Promise<void> => {
    button("Atur alokasi").click();
  });
  const originalReason = reasonField();
  const setter = Object.getOwnPropertyDescriptor(
    browser.HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  assert(setter);
  await act(async (): Promise<void> => {
    setter.call(originalReason, "Audit reason retains approved category baseline");
    originalReason.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.equal(reasonField().value, "Audit reason retains approved category baseline");
  const summary = host.querySelector("[data-allocation-summary]")?.textContent;
  const unavailable: ProjectTabsProps = {
    ...initial,
    projectBudgetDashboard: null,
    projectBudgetSource: { status: "unavailable", message: "Fixture read failed" },
  };
  await act(async (): Promise<void> => {
    root.render(<Owner data={unavailable} />);
  });
  assert.equal(
    host.querySelector("[data-project-lock]")?.textContent,
    "false",
    "Incoming missing budget must not change route/lock under an open allocation",
  );
  assert.equal(reasonField(), originalReason, "Incoming source change preserves exact input DOM");
  assert.equal(reasonField().value, "Audit reason retains approved category baseline");
  assert.equal(
    host.querySelector("[data-allocation-summary]")?.textContent,
    summary,
    "Audit draft remains attached to its initial budget snapshot",
  );
  assert.equal(
    host.querySelector("[data-specialized-rap]"),
    null,
    "Bare route does not switch to RAP while editing",
  );
  await act(async (): Promise<void> => {
    host.querySelector<HTMLButtonElement>("[data-submit]")?.click();
  });
  assert(submitted, "Audit reason makes the existing reallocation action available");
  assert.equal(
    Reflect.get(submitted, "projectBudgetId"),
    budget.budgetId,
    "Submission targets the reviewed budget, not the refreshed source",
  );
  assert.equal(Reflect.get(submitted, "reason"), "Audit reason retains approved category baseline");
  assert(finish);
  await act(async (): Promise<void> => {
    finish?.({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Safe fixture failure" },
    });
  });
  assert.equal(reasonField(), originalReason);
  assert.equal(
    reasonField().value,
    "Audit reason retains approved category baseline",
    "Failure retains the draft and reviewed snapshot",
  );
  await act(async (): Promise<void> => {
    host.querySelector<HTMLButtonElement>("[data-close]")?.click();
  });
  assert.equal(
    host.querySelector("[data-project-lock]")?.textContent,
    "true",
    "Deferred source is adopted only after workflow closes",
  );
  assert(
    host.querySelector("[data-specialized-rap]"),
    "Existing locked-route default resumes after draft closes",
  );
  console.log("Project budget source freeze DOM regressions passed");
} finally {
  await act(async (): Promise<void> => {
    root.unmount();
  });
  await browser.happyDOM.close();
}
