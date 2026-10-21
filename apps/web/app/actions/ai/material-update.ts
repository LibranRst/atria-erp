"use server";
import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";

export async function getAiMaterialUpdateProposal(
  ...args: WebRpcArgs<"app/actions/ai/material-update.getAiMaterialUpdateProposal">
): Promise<WebRpcResult<"app/actions/ai/material-update.getAiMaterialUpdateProposal">> {
  return callBackendAction("app/actions/ai/material-update.getAiMaterialUpdateProposal", args, {
    allowCookieWrites: true,
  });
}
export async function confirmAiMaterialUpdateProposal(
  ...args: WebRpcArgs<"app/actions/ai/material-update.confirmAiMaterialUpdateProposal">
): Promise<WebRpcResult<"app/actions/ai/material-update.confirmAiMaterialUpdateProposal">> {
  return callBackendAction("app/actions/ai/material-update.confirmAiMaterialUpdateProposal", args, {
    allowCookieWrites: true,
  });
}
