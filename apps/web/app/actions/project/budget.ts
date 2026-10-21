"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/project/budget";

export async function createProjectBudget(
  ...args: WebRpcArgs<"app/actions/project/budget.createProjectBudget">
): Promise<WebRpcResult<"app/actions/project/budget.createProjectBudget">> {
  return callBackendAction("app/actions/project/budget.createProjectBudget", args, {
    allowCookieWrites: true,
  });
}

export async function createBudgetItem(
  ...args: WebRpcArgs<"app/actions/project/budget.createBudgetItem">
): Promise<WebRpcResult<"app/actions/project/budget.createBudgetItem">> {
  return callBackendAction("app/actions/project/budget.createBudgetItem", args, {
    allowCookieWrites: true,
  });
}

export async function submitBudgetForApproval(
  ...args: WebRpcArgs<"app/actions/project/budget.submitBudgetForApproval">
): Promise<WebRpcResult<"app/actions/project/budget.submitBudgetForApproval">> {
  return callBackendAction("app/actions/project/budget.submitBudgetForApproval", args, {
    allowCookieWrites: true,
  });
}

export async function approveBudget(
  ...args: WebRpcArgs<"app/actions/project/budget.approveBudget">
): Promise<WebRpcResult<"app/actions/project/budget.approveBudget">> {
  return callBackendAction("app/actions/project/budget.approveBudget", args, {
    allowCookieWrites: true,
  });
}

export async function rejectBudget(
  ...args: WebRpcArgs<"app/actions/project/budget.rejectBudget">
): Promise<WebRpcResult<"app/actions/project/budget.rejectBudget">> {
  return callBackendAction("app/actions/project/budget.rejectBudget", args, {
    allowCookieWrites: true,
  });
}

export async function getActiveProjectsForExpense(
  ...args: WebRpcArgs<"app/actions/project/budget.getActiveProjectsForExpense">
): Promise<WebRpcResult<"app/actions/project/budget.getActiveProjectsForExpense">> {
  return callBackendAction("app/actions/project/budget.getActiveProjectsForExpense", args, {
    allowCookieWrites: true,
  });
}
