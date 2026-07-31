import type { ExpenseLine } from "@/features/expenses/types/expense-form-types";

export function routeProjectId(pathname: string): string {
  const parts = pathname.split("/");
  const projectIndex = parts.indexOf("projects");
  return projectIndex >= 0 ? (parts[projectIndex + 1] ?? "") : "";
}

export function hasMeaningfulLine(line: ExpenseLine): boolean {
  return Boolean(
    line.projectBudgetCategoryId || line.description.trim() || Number(line.amount) > 0,
  );
}

export function subscribeLastExpenseProject(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener("atria:last-expense-project-changed", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("atria:last-expense-project-changed", onChange);
  };
}

export function getLastExpenseProject(): string {
  return window.localStorage.getItem("atria:last-expense-project") ?? "";
}

export function getServerLastExpenseProject(): string {
  return "";
}
