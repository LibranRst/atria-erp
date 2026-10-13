"use server";
import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export async function getAiCategoryPlanProposal(
  ...args: WebRpcArgs<"app/actions/ai/category-plan.getAiCategoryPlanProposal">
): Promise<WebRpcResult<"app/actions/ai/category-plan.getAiCategoryPlanProposal">> {
  return callBackendAction("app/actions/ai/category-plan.getAiCategoryPlanProposal", args, {
    allowCookieWrites: true,
  });
}
export async function confirmAiCategoryPlanProposal(
  ...args: WebRpcArgs<"app/actions/ai/category-plan.confirmAiCategoryPlanProposal">
): Promise<WebRpcResult<"app/actions/ai/category-plan.confirmAiCategoryPlanProposal">> {
  return callBackendAction("app/actions/ai/category-plan.confirmAiCategoryPlanProposal", args, {
    allowCookieWrites: true,
  });
}
