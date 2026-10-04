"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/project/excel-budget";

export async function createProjectBudgetFromRatios(
  ...args: WebRpcArgs<"app/actions/project/excel-budget.createProjectBudgetFromRatios">
): Promise<WebRpcResult<"app/actions/project/excel-budget.createProjectBudgetFromRatios">> {
  return callBackendAction("app/actions/project/excel-budget.createProjectBudgetFromRatios", args, {
    allowCookieWrites: true,
  });
}

export async function updateProjectBudgetCategoryAllocation(
  ...args: WebRpcArgs<"app/actions/project/excel-budget.updateProjectBudgetCategoryAllocation">
): Promise<WebRpcResult<"app/actions/project/excel-budget.updateProjectBudgetCategoryAllocation">> {
  return callBackendAction(
    "app/actions/project/excel-budget.updateProjectBudgetCategoryAllocation",
    args,
    { allowCookieWrites: true },
  );
}

export async function submitProjectBudget(
  ...args: WebRpcArgs<"app/actions/project/excel-budget.submitProjectBudget">
): Promise<WebRpcResult<"app/actions/project/excel-budget.submitProjectBudget">> {
  return callBackendAction("app/actions/project/excel-budget.submitProjectBudget", args, {
    allowCookieWrites: true,
  });
}

export async function approveProjectBudget(
  ...args: WebRpcArgs<"app/actions/project/excel-budget.approveProjectBudget">
): Promise<WebRpcResult<"app/actions/project/excel-budget.approveProjectBudget">> {
  return callBackendAction("app/actions/project/excel-budget.approveProjectBudget", args, {
    allowCookieWrites: true,
  });
}

export async function rejectProjectBudget(
  ...args: WebRpcArgs<"app/actions/project/excel-budget.rejectProjectBudget">
): Promise<WebRpcResult<"app/actions/project/excel-budget.rejectProjectBudget">> {
  return callBackendAction("app/actions/project/excel-budget.rejectProjectBudget", args, {
    allowCookieWrites: true,
  });
}

export async function recalculateProjectBudgetCategories(
  ...args: WebRpcArgs<"app/actions/project/excel-budget.recalculateProjectBudgetCategories">
): Promise<WebRpcResult<"app/actions/project/excel-budget.recalculateProjectBudgetCategories">> {
  return callBackendAction(
    "app/actions/project/excel-budget.recalculateProjectBudgetCategories",
    args,
    { allowCookieWrites: true },
  );
}

export async function getProjectBudgetDashboard(
  ...args: WebRpcArgs<"app/actions/project/excel-budget.getProjectBudgetDashboard">
): Promise<WebRpcResult<"app/actions/project/excel-budget.getProjectBudgetDashboard">> {
  return callBackendAction("app/actions/project/excel-budget.getProjectBudgetDashboard", args, {
    allowCookieWrites: true,
  });
}

export async function getOwnerBudgetDashboard(
  ...args: WebRpcArgs<"app/actions/project/excel-budget.getOwnerBudgetDashboard">
): Promise<WebRpcResult<"app/actions/project/excel-budget.getOwnerBudgetDashboard">> {
  return callBackendAction("app/actions/project/excel-budget.getOwnerBudgetDashboard", args, {
    allowCookieWrites: true,
  });
}
