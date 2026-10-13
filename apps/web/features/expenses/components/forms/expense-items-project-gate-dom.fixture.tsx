import assert from "node:assert/strict";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import type { ProjectBudgetCategoryOption } from "@/features/expenses/types/expense-form-types";

const browserWindow = new Window({ url: "https://atria.test/expenses", width: 1280 });
Reflect.set(browserWindow.Element.prototype, "animate", undefined);
for (const key of [
  "window",
  "document",
  "navigator",
  "performance",
  "CSS",
  "HTMLElement",
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
// This unrelated composer imports server actions. The category interaction never opens it.
mock.module("@/features/materials/components/sheets/inventory-location-sheet", () => ({
  InventoryLocationSheet: (): null => null,
}));
const { createRoot } = await import("react-dom/client");
const { WorkflowFormSheet } = await import("@/components/ui");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const { ExpenseItemsSection } = await import("./expense-form-sections");
const { ExpenseLineEditor } = await import("./expense-line-editor");
const { createBlankExpenseLine } = await import("@/features/expenses/utils/expense-form-utils");

const categories: ProjectBudgetCategoryOption[] = [
  ["material", "MATERIAL", "Material"],
  ["tukang", "TUKANG", "Tukang"],
  ["operasional", "OPERASIONAL", "Operasional"],
  ["lain", "LAIN_LAIN", "Lain-lain"],
  ["subcon", "SUBCON", "Subcon"],
].map(([id, code, name], sortOrder): ProjectBudgetCategoryOption => ({
  id,
  code,
  name,
  sortOrder,
  allocatedAmount: "10000000",
  pendingAmount: "0",
  actualAmount: "0",
  remainingAmount: "10000000",
  usedPercentage: "0",
  status: "SAFE",
}));
const line = createBlankExpenseLine();
let added = 0;
let saved = 0;
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);

function Fixture({
  projectId,
  budgetCategories,
  presentation = "desktop",
}: {
  readonly projectId: string;
  readonly budgetCategories: ProjectBudgetCategoryOption[];
  readonly presentation?: "desktop" | "mobile";
}): React.JSX.Element {
  return (
    <WorkspacePresentationProvider presentation={presentation}>
      <WorkflowFormSheet
        open
        title="Tambah Pengeluaran fixture"
        dismissal={{ mode: "preserve" }}
        primaryLabel="Tinjau"
        onPrimary={(): void => {}}
        onClose={(): void => {}}
      >
        <ExpenseItemsSection
          disabled={false}
          selectedProjectId={projectId}
          lines={[line]}
          budgetCategories={budgetCategories}
          materialOptions={[]}
          rapItems={[]}
          categoryPlanItems={[]}
          defaultInventoryLocationId=""
          inventoryLocations={[]}
          onAdd={(): void => {
            added += 1;
          }}
          onDuplicate={(): void => {}}
          onRemove={(): void => {}}
          onMove={(): void => {}}
          onRestore={(): void => {}}
          onUpdate={(): void => {
            saved += 1;
          }}
        />
      </WorkflowFormSheet>
    </WorkspacePresentationProvider>
  );
}
async function settle(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 750));
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
      new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        button: 0,
        buttons: 1,
      }),
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
      new MouseEvent("mouseup", {
        bubbles: true,
        cancelable: true,
        button: 0,
        buttons: 0,
      }),
    );
    element.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
        detail: 1,
      }),
    );
  });
}
function editButton(): HTMLButtonElement {
  const button = document.querySelector('[data-expense-incomplete="true"]');
  assert.ok(button instanceof HTMLButtonElement);
  return button;
}
function addButton(): HTMLButtonElement {
  const button = [...document.querySelectorAll("button")].find(
    (element): boolean => element.textContent === "Tambahkan Item",
  );
  assert.ok(button instanceof HTMLButtonElement);
  return button;
}
async function renderFixture(
  projectId: string,
  budgetCategories: ProjectBudgetCategoryOption[],
  presentation: "desktop" | "mobile" = "desktop",
): Promise<void> {
  await act(async (): Promise<void> => {
    root.render(
      <Fixture
        key={presentation}
        projectId={projectId}
        budgetCategories={budgetCategories}
        presentation={presentation}
      />,
    );
  });
  await settle();
}
try {
  for (const presentation of ["desktop", "mobile"] as const) {
    await renderFixture("", [], presentation);
    assert.equal(editButton().disabled, true, "initial Item 1 requires a selected project");
    assert.equal(addButton().disabled, true, "adding also requires a selected project");
    assert.ok(
      document.body.textContent?.includes("Pilih proyek dulu untuk mengisi item pengeluaran."),
      "the blocked item explains which prerequisite is missing",
    );
    await click(editButton());
    assert.equal(
      document.querySelectorAll('[role="dialog"]').length,
      1,
      "a blocked item must not open an unusable nested editor",
    );

    await renderFixture("project-without-budget", [], presentation);
    assert.equal(
      editButton().disabled,
      true,
      "a selected project without categories stays blocked",
    );
    assert.equal(
      addButton().disabled,
      true,
      "empty category data cannot create another unusable item",
    );
    assert.ok(
      document.body.textContent?.includes(
        "Kategori budget proyek belum tersedia. Lengkapi budget proyek sebelum mengisi item.",
      ),
      "missing categories are distinguished from a missing project",
    );
  }
  await renderFixture("project-ready", categories);
  assert.equal(editButton().disabled, false, "valid project categories unlock item editing");
  assert.equal(addButton().disabled, false);
  await click(editButton());
  await settle();
  assert.equal(
    document.querySelectorAll('[role="dialog"]').length,
    2,
    "the ready item opens the real nested editor",
  );
  const categoryTrigger = [...document.querySelectorAll("button")].find(
    (element): boolean =>
      element.getAttribute("aria-haspopup") === "listbox" &&
      element.textContent?.includes("Pilih kategori") === true,
  );
  assert.ok(categoryTrigger instanceof HTMLButtonElement, "category trigger is present");
  const nativeSelect = [...document.querySelectorAll("select")].find(
    (element): boolean => element.options.length === categories.length + 1,
  );
  assert.ok(
    nativeSelect instanceof HTMLSelectElement,
    "all project categories reach the real Select",
  );
  await click(categoryTrigger);
  await settle();
  assert.equal(categoryTrigger.getAttribute("aria-expanded"), "true");
  const option = [...document.querySelectorAll('[role="option"]')].find(
    (element): boolean => element.textContent?.includes("Operasional") === true,
  );
  assert.ok(option instanceof HTMLElement, "the category menu opens above the nested sheet");
  await click(option);
  await settle();
  assert.equal(categoryTrigger.getAttribute("aria-expanded"), "false");
  assert.ok(
    categoryTrigger.textContent?.includes("Operasional"),
    "the chosen category updates the local item",
  );
  assert.equal(added, 0);
  assert.equal(saved, 0, "selecting a category never saves or submits the item");
  await act(async (): Promise<void> => {
    root.render(
      <WorkspacePresentationProvider presentation="desktop">
        <ExpenseLineEditor
          open
          index={0}
          line={{
            ...line,
            projectBudgetCategoryId: "removed-category",
            description: "Biaya pengeluaran lengkap",
            quantity: 1,
            unitPrice: 25000,
            amount: 25000,
          }}
          budgetCategories={[]}
          materialOptions={[]}
          rapItems={[]}
          categoryPlanItems={[]}
          defaultInventoryLocationId=""
          inventoryLocations={[]}
          onClose={(): void => {}}
          onSave={(): void => {
            saved += 1;
          }}
        />
      </WorkspacePresentationProvider>,
    );
  });
  await settle();
  const saveButton = [...document.querySelectorAll("button")].find(
    (element): boolean => element.textContent === "Simpan",
  );
  assert.ok(saveButton instanceof HTMLButtonElement);
  assert.equal(
    saveButton.disabled || saveButton.getAttribute("aria-disabled") === "true",
    true,
    "otherwise complete recovered items cannot save a category that is no longer available",
  );
  await click(saveButton);
  assert.equal(saved, 0);
  assert.ok(document.body.textContent?.includes("Kategori budget proyek belum tersedia"));
  console.log("expense item project prerequisite and nested category selection regression passed");
} finally {
  await act(async (): Promise<void> => {
    root.unmount();
  });
  await browserWindow.happyDOM.close();
}
