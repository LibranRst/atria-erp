import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { ActionResponse } from "@atria/core/types/action-response";

const browserWindow = new Window({
  url: "https://atria.test/projects/project-scope?tab=expenses&view=vendor-bills&unrelated=keep#notes",
  width: 1093,
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
let currentPath = "/ledger";
const nextNavigation = await import("next/navigation");
mock.module("next/navigation", (): typeof nextNavigation => ({
  ...nextNavigation,
  usePathname: (): string => currentPath,
  useSearchParams: (): ReturnType<typeof nextNavigation.useSearchParams> =>
    new nextNavigation.ReadonlyURLSearchParams(window.location.search),
  useRouter: (): ReturnType<typeof nextNavigation.useRouter> => ({
    bfcacheId: "expense-selection-fixture",
    back: (): void => {},
    forward: (): void => {},
    refresh: (): void => {},
    push: (): void => {},
    replace: (): void => {},
    prefetch: (): void => {},
  }),
}));
mock.module("@/app/actions/activity-detail", () => ({
  getActivityDetail: async (): Promise<ActionResponse<never>> => {
    throw new Error("Viewport selection regression must not request backend details");
  },
}));

// Use the actual Tailwind visibility utility rules rather than asserting class strings.
const visibility = document.createElement("style");
const visibilityRules =
  ".hidden{display:none}@media (min-width: 1280px){.xl\\:block{display:block}.xl\\:hidden{display:none}}";
visibility.textContent = visibilityRules;
document.head.append(visibility);

const actions = await import("../../../../.storybook/expenses-actions.fixture");
const fixtureData = await import("../../../../.storybook/expenses-data.fixture");
const projects = fixtureData.expensesFixtureData("complete").projects;
const targetProject = projects[1]!;
let draftWrites = 0;
type ProjectBootstrap = Awaited<ReturnType<typeof actions.getActiveProjectsForExpense>>;
type VendorBootstrap = Awaited<ReturnType<typeof actions.getVendorBillFormData>>;
let resolveProjects: ((value: ProjectBootstrap) => void) | undefined;
let resolveVendor: ((value: VendorBootstrap) => void) | undefined;
mock.module("@/app/actions/project/budget", () => ({
  getActiveProjectsForExpense: async (): Promise<ProjectBootstrap> =>
    new Promise((resolve) => {
      resolveProjects = resolve;
    }),
}));
mock.module("@/app/actions/finance/submit-vendor-bill", () => ({
  ...actions,
  getVendorBillFormData: async (): Promise<VendorBootstrap> =>
    new Promise((resolve) => {
      resolveVendor = resolve;
    }),
}));
mock.module("@/app/actions/finance/expense-drafts", () => ({
  ...actions,
  saveExpenseDraft: async (): ReturnType<typeof actions.saveExpenseDraft> => {
    draftWrites += 1;
    return actions.saveExpenseDraft();
  },
  listExpenseDrafts: async (): Promise<Awaited<ReturnType<typeof actions.listExpenseDrafts>>> => ({
    success: true,
    data: [],
  }),
}));
mock.module("@/app/actions/finance/vendor-bill-drafts", () => ({
  ...actions,
  saveVendorBillDraft: async (): ReturnType<typeof actions.saveVendorBillDraft> => {
    draftWrites += 1;
    return actions.saveVendorBillDraft();
  },
}));
const { createRoot } = await import("react-dom/client");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { DesktopUIProvider } = await import("@/components/ui");
const { GlobalExpenseDrawer } = await import("../sheets/global-drawer");
const { GlobalVendorBillDrawer } = await import("../sheets/global-vendor-bill-drawer");
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
function Fixture(): React.JSX.Element {
  return (
    <WorkspacePresentationProvider presentation="desktop">
      <DesktopUIProvider responsive>
        <GlobalExpenseDrawer />
        <GlobalVendorBillDrawer />
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
async function settle(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 60));
  });
}
async function render(): Promise<void> {
  await act(async (): Promise<void> => root.render(<Fixture />));
  await settle();
}
async function intent(name: string): Promise<void> {
  await act(async (): Promise<void> => {
    window.history.replaceState({}, "", `${currentPath}?tab=expenses&${name}=true`);
  });
  await render();
}
function projectSelect(): HTMLButtonElement {
  const controls = [
    ...document.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="listbox"]'),
  ];
  const control = controls.find((button) => {
    const ids = button.getAttribute("aria-labelledby")?.split(" ") ?? [];
    return ids.some((id) => document.getElementById(id)?.textContent?.trim() === "Proyek");
  });
  assert.ok(control, "Actual shared project select is mounted");
  return control;
}
await render();
currentPath = `/projects/${targetProject.id}`;
await intent("new-expense");
assert.ok(resolveProjects, "Global expense bootstrap pending");
await act(async (): Promise<void> => resolveProjects?.({ success: true, data: projects }));
await settle();
let select = projectSelect();
assert.ok(select.disabled, "Expense project cannot escape canonical route");
assert.ok(
  select.textContent?.includes(targetProject.name),
  "Delayed project data labels the prefilled route project",
);
await act(async (): Promise<void> => {
  browserWindow.happyDOM.setWindowSize({ width: 1440, height: 976 });
  window.dispatchEvent(new Event("resize"));
});
await settle();
assert.equal(projectSelect(), select, "Expense project control DOM remains stable across resize");
await act(async (): Promise<void> =>
  window.history.replaceState({}, "", `${currentPath}?tab=expenses`),
);
await settle();
await intent("new-vendor-bill");
assert.ok(resolveVendor, "Global vendor bootstrap pending");
await act(async (): Promise<void> =>
  resolveVendor?.({
    success: true,
    data: {
      projects,
      vendors: fixtureData.expensesFixtureData("complete").vendors,
      userRole: "Fixture",
    },
  }),
);
await settle();
select = projectSelect();
assert.ok(select.disabled, "Vendor project is locked to the canonical project");
assert.ok(
  select.textContent?.includes(targetProject.name),
  "Vendor default survives initial closed mount + delayed bootstrap",
);
await act(async (): Promise<void> => root.unmount());

// A recovered draft for another project stays intact and cannot be submitted from this route.
const { VendorBillForm } = await import("./vendor-bill-form");
const { ExpenseForm } = await import("./expense-form");
const foreignProject = projects[0]!;
const foreignCategory = foreignProject.canonicalBudgets?.[0]?.categories?.[0];
assert.ok(foreignCategory);
const vendorRecovery = {
  schemaVersion: 1,
  payload: {
    draftId: null,
    revision: null,
    form: {
      vendorId: fixtureData.expensesFixtureData("complete").vendors[0]!.id,
      projectId: foreignProject.id,
      projectBudgetCategoryId: foreignCategory.id,
      projectBudgetItemId: "",
      projectCategoryPlanItemId: "",
      billNumber: "INV-foreign",
      amount: 100.25,
      dueDate: "2026-10-20",
      notes: "Draft tersimpan proyek lain",
    },
  },
};
window.localStorage.setItem("atria:vendor-bill-draft:active", JSON.stringify(vendorRecovery));
const recoveryHost = document.createElement("div");
document.body.append(recoveryHost);
const recoveryRoot = createRoot(recoveryHost);
await act(async (): Promise<void> =>
  recoveryRoot.render(
    <WorkspacePresentationProvider presentation="desktop">
      <DesktopUIProvider responsive>
        <VendorBillForm
          projects={projects}
          vendors={fixtureData.expensesFixtureData("complete").vendors}
        />
      </DesktopUIProvider>
    </WorkspacePresentationProvider>,
  ),
);
await settle();
assert.ok(
  document.body.textContent?.includes("Draft proyek lain tetap tersimpan"),
  "Foreign vendor recovery is explicitly explained",
);
assert.ok(
  [...document.querySelectorAll<HTMLButtonElement>("button")].some(
    (button) =>
      (button.disabled || button.getAttribute("aria-disabled") === "true") &&
      button.textContent?.includes("Tinjau"),
  ),
  "Foreign vendor draft cannot enter review",
);
assert.ok(
  window.localStorage
    .getItem("atria:vendor-bill-draft:active")
    ?.includes(`"projectId":"${foreignProject.id}"`),
  "Foreign vendor recovery is never reassigned",
);
const expenseRecovery = fixtureData.expensesFixtureDraft(fixtureData.expensesFixtureId(7999));
window.localStorage.setItem(
  "atria:expense-draft:new",
  JSON.stringify({
    payload: { ...expenseRecovery.payload, projectId: foreignProject.id },
    draftId: null,
    revision: null,
    changedAt: new Date().toISOString(),
  }),
);
await act(async (): Promise<void> =>
  recoveryRoot.render(
    <WorkspacePresentationProvider presentation="desktop">
      <DesktopUIProvider responsive>
        <ExpenseForm projects={projects} />
      </DesktopUIProvider>
    </WorkspacePresentationProvider>,
  ),
);
await settle();
assert.ok(
  document.body.textContent?.includes("Draft proyek lain tetap tersimpan"),
  "Foreign expense recovery is explained",
);
assert.ok(
  [...document.querySelectorAll<HTMLButtonElement>("button")].some(
    (button) =>
      (button.disabled || button.getAttribute("aria-disabled") === "true") &&
      button.textContent?.includes("Tinjau"),
  ),
  "Foreign expense draft cannot enter review",
);
assert.ok(
  window.localStorage
    .getItem("atria:expense-draft:new")
    ?.includes(`"projectId":"${foreignProject.id}"`),
  "Foreign expense recovery is never reassigned",
);
await act(async (): Promise<void> => recoveryRoot.unmount());

const { useHybridExpenseDraft } = await import("../../hooks/use-hybrid-expense-draft");
const { useHybridVendorBillDraft } = await import("../../hooks/use-hybrid-vendor-bill-draft");
const { createBlankExpenseDraft } = await import("../../utils/expense-form-utils");
function HookHarness({ scope }: { readonly scope?: string }): React.JSX.Element {
  const expense = useHybridExpenseDraft(createBlankExpenseDraft(targetProject.id), true, scope);
  const vendor = useHybridVendorBillDraft(
    { ...vendorRecovery.payload.form, projectId: targetProject.id },
    scope,
  );
  return (
    <button
      type="button"
      onClick={async (): Promise<void> => {
        await expense.saveNow();
        await vendor.saveAsCopy();
      }}
    >
      Test draft saves
    </button>
  );
}
const hookHost = document.createElement("div");
document.body.append(hookHost);
const hookRoot = createRoot(hookHost);
const previousWrites = draftWrites;
await act(async (): Promise<void> => hookRoot.render(<HookHarness scope={targetProject.id} />));
await act(async (): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, 1350));
});
assert.equal(
  draftWrites,
  previousWrites,
  "Foreign recovered drafts do not auto-save after the actual debounce interval",
);
const saveButton = hookHost.querySelector("button");
assert.ok(saveButton);
await act(async (): Promise<void> => saveButton.click());
await settle();
assert.equal(
  draftWrites,
  previousWrites,
  "Manual save and save-as-copy refuse foreign project context",
);
await act(async (): Promise<void> => hookRoot.render(<HookHarness />));
await act(async (): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, 1350));
});
assert.equal(
  draftWrites,
  previousWrites + 2,
  "Standalone route resumes ordinary expense and vendor draft autosaves",
);
await act(async (): Promise<void> => hookRoot.unmount());
await browserWindow.happyDOM.close();
console.log(
  "Global project expense and vendor forms keep route context through delayed bootstrap and resize",
);
