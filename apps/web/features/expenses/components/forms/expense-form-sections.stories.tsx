import type { Meta, StoryObj } from "@storybook/nextjs";
import React from "react";
import { AdaptiveSelect, Button, DesktopUIProvider, FormSection, FormSheet } from "@/components/ui";
import type {
  ExpenseFormProject,
  ExpenseLine,
  ProjectBudgetCategoryOption,
} from "@/features/expenses/types/expense-form-types";
import { createBlankExpenseLine } from "@/features/expenses/utils/expense-form-utils";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { useWorkspaceViewportPresentation } from "@/lib/navigation/workspace-viewport";
import { ExpenseItemsSection } from "./expense-form-sections";

const categories: ProjectBudgetCategoryOption[] = [
  { code: "MATERIAL", name: "Material" },
  { code: "TUKANG", name: "Tukang" },
  { code: "OPERASIONAL", name: "Operasional" },
  { code: "LAIN_LAIN", name: "Lain-lain" },
  { code: "SUBCON", name: "Subcon" },
].map((category, index) => ({
  ...category,
  id: `category-example-${index + 1}`,
  allocatedAmount: "20000000",
  pendingAmount: "0",
  actualAmount: "5000000",
  remainingAmount: "15000000",
  usedPercentage: "25",
  status: "HEALTHY",
  sortOrder: index,
}));

const projects: ExpenseFormProject[] = [
  {
    id: "project-example-ready",
    name: "Proyek contoh dengan budget",
    canonicalBudgets: [{ id: "budget-example", status: "APPROVED", categories }],
  },
  {
    id: "project-example-empty",
    name: "Proyek contoh tanpa kategori budget",
    canonicalBudgets: [{ id: "budget-example-empty", status: "DRAFT", categories: [] }],
  },
];

function ResponsiveExpenseItems({
  initialProjectId = "",
  nativeFallback = false,
}: {
  readonly initialProjectId?: string;
  readonly nativeFallback?: boolean;
}): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation(nativeFallback);
  const [projectId, setProjectId] = React.useState(initialProjectId);
  const [lines, setLines] = React.useState<ExpenseLine[]>(() => [createBlankExpenseLine()]);
  const [open, setOpen] = React.useState(true);
  const selectedProject = projects.find((project) => project.id === projectId);
  const budgetCategories = selectedProject?.canonicalBudgets?.[0]?.categories ?? [];

  function moveLine(key: string, direction: -1 | 1): void {
    setLines((current) => {
      const index = current.findIndex((line) => line.key === key);
      const nextIndex = index + direction;
      const line = current[index];
      if (!line || nextIndex < 0 || nextIndex >= current.length) return current;
      const updated = [...current];
      updated.splice(index, 1);
      updated.splice(nextIndex, 0, line);
      return updated;
    });
  }

  return (
    <WorkspacePresentationProvider presentation={presentation} nativeBridge={nativeFallback}>
      <DesktopUIProvider responsive>
        <div className="min-h-screen bg-background p-6">
          <Button onClick={() => setOpen(true)}>Buka pengeluaran contoh</Button>
          <FormSheet
            open={open}
            title="Pengeluaran contoh"
            dismissal={{ mode: "preserve" }}
            desktopSize="wide"
            desktopFooterPlacement="aside"
            desktopAsideSummary={
              <p className="text-sm text-on-surface-variant">
                Fixture visual: seluruh perubahan hanya ada di memori browser. Pilih proyek, buka
                rincian item, lalu pilih kategori pengeluaran.
              </p>
            }
            footer={<Button onClick={() => setOpen(false)}>Tutup contoh</Button>}
            onClose={() => setOpen(false)}
          >
            <div className="space-y-md">
              <FormSection title="Proyek">
                <AdaptiveSelect
                  id="expense-example-project"
                  label="Proyek"
                  value={projectId}
                  options={projects.map((project) => ({ value: project.id, label: project.name }))}
                  onChange={setProjectId}
                  placeholder="Pilih proyek"
                  required
                />
              </FormSection>
              <ExpenseItemsSection
                disabled={false}
                selectedProjectId={projectId}
                lines={lines}
                budgetCategories={budgetCategories}
                materialOptions={[]}
                rapItems={[]}
                categoryPlanItems={[]}
                defaultInventoryLocationId=""
                inventoryLocations={[]}
                onAdd={() => setLines((current) => [...current, createBlankExpenseLine()])}
                onDuplicate={(key) =>
                  setLines((current) => {
                    const line = current.find((item) => item.key === key);
                    return line
                      ? [...current, { ...line, key: createBlankExpenseLine().key }]
                      : current;
                  })
                }
                onRemove={(key) =>
                  setLines((current) => current.filter((line) => line.key !== key))
                }
                onMove={moveLine}
                onRestore={(line, index) =>
                  setLines((current) => {
                    const updated = [...current];
                    updated.splice(index, 0, line);
                    return updated;
                  })
                }
                onUpdate={(line) =>
                  setLines((current) =>
                    current.map((item) => (item.key === line.key ? line : item)),
                  )
                }
              />
            </div>
          </FormSheet>
        </div>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}

const meta = {
  title: "Features/Expenses/Manual item categories",
  component: ResponsiveExpenseItems,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ResponsiveExpenseItems>;
export default meta;
type Story = StoryObj<typeof meta>;
export const NoProject: Story = {};
export const WithBudget: Story = { args: { initialProjectId: "project-example-ready" } };
export const EmptyBudget: Story = { args: { initialProjectId: "project-example-empty" } };
export const NativeFallback: Story = { args: { nativeFallback: true } };
