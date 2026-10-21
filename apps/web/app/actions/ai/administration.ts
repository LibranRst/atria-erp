"use server";
import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export async function getAiAdministrationProposal(
  ...args: WebRpcArgs<"app/actions/ai/administration.getAiAdministrationProposal">
): Promise<WebRpcResult<"app/actions/ai/administration.getAiAdministrationProposal">> {
  return callBackendAction("app/actions/ai/administration.getAiAdministrationProposal", args, {
    allowCookieWrites: true,
  });
}
export async function confirmAiAdministrationProposal(
  ...args: WebRpcArgs<"app/actions/ai/administration.confirmAiAdministrationProposal">
): Promise<WebRpcResult<"app/actions/ai/administration.confirmAiAdministrationProposal">> {
  return callBackendAction("app/actions/ai/administration.confirmAiAdministrationProposal", args, {
    allowCookieWrites: true,
  });
}
