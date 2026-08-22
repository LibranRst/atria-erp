"use client";

import type { ToolResultRenderer } from "./types";

import { BankBalancesResult } from "./bank-balances-result";
import {
  ClientsResult,
  MaterialCatalogResult,
  PendingExpenseApprovalsResult,
  UnpaidClientInvoicesResult,
  VendorsResult,
} from "./lookup-results";
import {
  ExpenseCategoriesResult,
  MaterialShortageResult,
  PendingApprovalsResult,
  RecentExpensesResult,
} from "./operations-result";
import { ProjectBudgetResult } from "./project-budget-result";
import { ProjectsAtRiskResult } from "./projects-at-risk-result";
import { ProjectHealthResult, ProjectsResult } from "./projects-result";
import { UpcomingBillsResult } from "./upcoming-bills-result";

const TOOL_RESULT_RENDERERS: Readonly<Record<string, ToolResultRenderer>> = {
  listProjects: ProjectsResult,
  getProjectsAtRisk: ProjectsAtRiskResult,
  getProjectBudget: ProjectBudgetResult,
  getProjectHealth: ProjectHealthResult,
  getBankBalances: BankBalancesResult,
  getPendingApprovals: PendingApprovalsResult,
  getUpcomingBills: UpcomingBillsResult,
  getMaterialShortage: MaterialShortageResult,
  getRecentExpenses: RecentExpensesResult,
  getExpenseCategories: ExpenseCategoriesResult,
  listVendors: VendorsResult,
  listClients: ClientsResult,
  getMaterialCatalog: MaterialCatalogResult,
  getUnpaidVendorBills: UpcomingBillsResult,
  getUnpaidClientInvoices: UnpaidClientInvoicesResult,
  getPendingExpenseApprovals: PendingExpenseApprovalsResult,
};

const SUPPORTING_RESULT_TOOLS = new Set([
  "listProjects",
  "getExpenseCategories",
  "listVendors",
  "listClients",
  "getMaterialCatalog",
]);

export function isSupportingResultTool(toolName: string): boolean {
  return SUPPORTING_RESULT_TOOLS.has(toolName);
}

export function selectVisibleCards<T extends { readonly toolName: string }>(
  cards: readonly T[],
): readonly T[] {
  const specific = cards.filter((card) => !isSupportingResultTool(card.toolName));
  return specific.length > 0 ? specific : cards;
}

export function resolveToolResultRenderer(toolName: string): ToolResultRenderer | null {
  return TOOL_RESULT_RENDERERS[toolName] ?? null;
}

export function registeredToolNames(): readonly string[] {
  return Object.keys(TOOL_RESULT_RENDERERS);
}

export function hasToolResultRenderer(toolName: string): boolean {
  return toolName in TOOL_RESULT_RENDERERS;
}

export type { ToolResultContext, ToolResultProps, ToolResultRenderer } from "./types";
export { resolveProjectName } from "./types";
