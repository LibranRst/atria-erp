"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/project/rap-setup";

export async function advanceProjectRapSetup(
  ...args: WebRpcArgs<"app/actions/project/rap-setup.advanceProjectRapSetup">
): Promise<WebRpcResult<"app/actions/project/rap-setup.advanceProjectRapSetup">> {
  return callBackendAction("app/actions/project/rap-setup.advanceProjectRapSetup", args, {
    allowCookieWrites: true,
  });
}

export async function setProjectRapScopeSkipped(
  ...args: WebRpcArgs<"app/actions/project/rap-setup.setProjectRapScopeSkipped">
): Promise<WebRpcResult<"app/actions/project/rap-setup.setProjectRapScopeSkipped">> {
  return callBackendAction("app/actions/project/rap-setup.setProjectRapScopeSkipped", args, {
    allowCookieWrites: true,
  });
}

export async function markProjectCategoryPlanItemDraft(
  ...args: WebRpcArgs<"app/actions/project/rap-setup.markProjectCategoryPlanItemDraft">
): Promise<WebRpcResult<"app/actions/project/rap-setup.markProjectCategoryPlanItemDraft">> {
  return callBackendAction("app/actions/project/rap-setup.markProjectCategoryPlanItemDraft", args, {
    allowCookieWrites: true,
  });
}

export async function finalizeProjectInternalPlan(
  ...args: WebRpcArgs<"app/actions/project/rap-setup.finalizeProjectInternalPlan">
): Promise<WebRpcResult<"app/actions/project/rap-setup.finalizeProjectInternalPlan">> {
  return callBackendAction("app/actions/project/rap-setup.finalizeProjectInternalPlan", args, {
    allowCookieWrites: true,
  });
}
