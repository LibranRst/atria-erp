import type {
  ExpenseDraftPayload,
  ExpenseLine,
  ProjectBudgetCategoryOption,
} from "@/features/expenses/types/expense-form-types";
import { createBlankExpenseLine } from "@/features/expenses/utils/expense-form-utils";
import { createClientId } from "@/lib/utils/client-id";

interface UseExpenseLineMutationsProps {
  readonly budgetCategories: readonly ProjectBudgetCategoryOption[];
  readonly updatePayload: (change: (payload: ExpenseDraftPayload) => ExpenseDraftPayload) => void;
}

interface ExpenseLineMutations {
  readonly updateLine: (line: ExpenseLine) => void;
  readonly addLine: () => void;
  readonly duplicateLine: (key: string) => void;
  readonly removeLine: (key: string) => void;
  readonly restoreLine: (line: ExpenseLine, index: number) => void;
  readonly moveLine: (key: string, direction: -1 | 1) => void;
}

export function useExpenseLineMutations({
  budgetCategories,
  updatePayload,
}: UseExpenseLineMutationsProps): ExpenseLineMutations {
  function updateLine(nextLine: ExpenseLine): void {
    updatePayload((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.key === nextLine.key ? nextLine : line)),
    }));
  }

  function addLine(): void {
    const nextLine = createBlankExpenseLine();
    const firstCategory = budgetCategories[0];
    if (firstCategory) nextLine.projectBudgetCategoryId = firstCategory.id;
    updatePayload((current) => ({ ...current, lines: [...current.lines, nextLine] }));
  }

  function duplicateLine(key: string): void {
    updatePayload((current) => {
      const index = current.lines.findIndex((line) => line.key === key);
      if (index < 0) return current;
      const source = current.lines[index];
      const copy = { ...source, key: createClientId("expense-line") };
      const lines = [...current.lines];
      lines.splice(index + 1, 0, copy);
      return { ...current, lines };
    });
  }

  function removeLine(key: string): void {
    updatePayload((current) => ({
      ...current,
      lines: current.lines.filter((line) => line.key !== key),
    }));
  }

  function restoreLine(line: ExpenseLine, index: number): void {
    updatePayload((current) => {
      const lines = [...current.lines];
      lines.splice(Math.min(index, lines.length), 0, line);
      return { ...current, lines };
    });
  }

  function moveLine(key: string, direction: -1 | 1): void {
    updatePayload((current) => {
      const from = current.lines.findIndex((line) => line.key === key);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= current.lines.length) return current;
      const lines = [...current.lines];
      const [moved] = lines.splice(from, 1);
      lines.splice(to, 0, moved);
      return { ...current, lines };
    });
  }

  return {
    updateLine,
    addLine,
    duplicateLine,
    removeLine,
    restoreLine,
    moveLine,
  };
}
