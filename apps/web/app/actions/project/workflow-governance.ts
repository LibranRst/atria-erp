"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/project/workflow-governance";

export async function copyPricingTemplateToRap(
  ...args: WebRpcArgs<"app/actions/project/workflow-governance.copyPricingTemplateToRap">
): Promise<WebRpcResult<"app/actions/project/workflow-governance.copyPricingTemplateToRap">> {
  return callBackendAction(
    "app/actions/project/workflow-governance.copyPricingTemplateToRap",
    args,
    { allowCookieWrites: true },
  );
}

export async function copyPricingTemplateToCategoryPlan(
  ...args: WebRpcArgs<"app/actions/project/workflow-governance.copyPricingTemplateToCategoryPlan">
): Promise<
  WebRpcResult<"app/actions/project/workflow-governance.copyPricingTemplateToCategoryPlan">
> {
  return callBackendAction(
    "app/actions/project/workflow-governance.copyPricingTemplateToCategoryPlan",
    args,
    { allowCookieWrites: true },
  );
}

export async function reallocateProjectBudget(
  ...args: WebRpcArgs<"app/actions/project/workflow-governance.reallocateProjectBudget">
): Promise<WebRpcResult<"app/actions/project/workflow-governance.reallocateProjectBudget">> {
  return callBackendAction(
    "app/actions/project/workflow-governance.reallocateProjectBudget",
    args,
    { allowCookieWrites: true },
  );
}
