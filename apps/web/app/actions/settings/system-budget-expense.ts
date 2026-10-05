"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/settings/system-budget-expense";

export async function updateBudgetAllocationDefaults(
  ...args: WebRpcArgs<"app/actions/settings/system-budget-expense.updateBudgetAllocationDefaults">
): Promise<
  WebRpcResult<"app/actions/settings/system-budget-expense.updateBudgetAllocationDefaults">
> {
  return callBackendAction(
    "app/actions/settings/system-budget-expense.updateBudgetAllocationDefaults",
    args,
    { allowCookieWrites: true },
  );
}

export async function updateBudgetAllocationSetting(
  ...args: WebRpcArgs<"app/actions/settings/system-budget-expense.updateBudgetAllocationSetting">
): Promise<
  WebRpcResult<"app/actions/settings/system-budget-expense.updateBudgetAllocationSetting">
> {
  return callBackendAction(
    "app/actions/settings/system-budget-expense.updateBudgetAllocationSetting",
    args,
    { allowCookieWrites: true },
  );
}

export async function updateBudgetAllocationCategoryRatio(
  ...args: WebRpcArgs<"app/actions/settings/system-budget-expense.updateBudgetAllocationCategoryRatio">
): Promise<
  WebRpcResult<"app/actions/settings/system-budget-expense.updateBudgetAllocationCategoryRatio">
> {
  return callBackendAction(
    "app/actions/settings/system-budget-expense.updateBudgetAllocationCategoryRatio",
    args,
    { allowCookieWrites: true },
  );
}

export async function updateExpenseCategorySetting(
  ...args: WebRpcArgs<"app/actions/settings/system-budget-expense.updateExpenseCategorySetting">
): Promise<
  WebRpcResult<"app/actions/settings/system-budget-expense.updateExpenseCategorySetting">
> {
  return callBackendAction(
    "app/actions/settings/system-budget-expense.updateExpenseCategorySetting",
    args,
    { allowCookieWrites: true },
  );
}

export async function updateExpenseCategoryDetails(
  ...args: WebRpcArgs<"app/actions/settings/system-budget-expense.updateExpenseCategoryDetails">
): Promise<
  WebRpcResult<"app/actions/settings/system-budget-expense.updateExpenseCategoryDetails">
> {
  return callBackendAction(
    "app/actions/settings/system-budget-expense.updateExpenseCategoryDetails",
    args,
    { allowCookieWrites: true },
  );
}
