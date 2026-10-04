"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/project/category-plan";

export async function createProjectCategoryPlanItem(
  ...args: WebRpcArgs<"app/actions/project/category-plan.createProjectCategoryPlanItem">
): Promise<WebRpcResult<"app/actions/project/category-plan.createProjectCategoryPlanItem">> {
  return callBackendAction(
    "app/actions/project/category-plan.createProjectCategoryPlanItem",
    args,
    { allowCookieWrites: true },
  );
}

export async function updateProjectCategoryPlanItem(
  ...args: WebRpcArgs<"app/actions/project/category-plan.updateProjectCategoryPlanItem">
): Promise<WebRpcResult<"app/actions/project/category-plan.updateProjectCategoryPlanItem">> {
  return callBackendAction(
    "app/actions/project/category-plan.updateProjectCategoryPlanItem",
    args,
    { allowCookieWrites: true },
  );
}

export async function markProjectCategoryPlanItemActive(
  ...args: WebRpcArgs<"app/actions/project/category-plan.markProjectCategoryPlanItemActive">
): Promise<WebRpcResult<"app/actions/project/category-plan.markProjectCategoryPlanItemActive">> {
  return callBackendAction(
    "app/actions/project/category-plan.markProjectCategoryPlanItemActive",
    args,
    { allowCookieWrites: true },
  );
}

export async function deleteProjectCategoryPlanItem(
  ...args: WebRpcArgs<"app/actions/project/category-plan.deleteProjectCategoryPlanItem">
): Promise<WebRpcResult<"app/actions/project/category-plan.deleteProjectCategoryPlanItem">> {
  return callBackendAction(
    "app/actions/project/category-plan.deleteProjectCategoryPlanItem",
    args,
    { allowCookieWrites: true },
  );
}

export async function getProjectCategoryPlanItems(
  ...args: WebRpcArgs<"app/actions/project/category-plan.getProjectCategoryPlanItems">
): Promise<WebRpcResult<"app/actions/project/category-plan.getProjectCategoryPlanItems">> {
  return callBackendAction("app/actions/project/category-plan.getProjectCategoryPlanItems", args, {
    allowCookieWrites: true,
  });
}
