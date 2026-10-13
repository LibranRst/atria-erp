"use server";
import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export async function getAiRapChangeProposal(
  ...args: WebRpcArgs<"app/actions/ai/rap-change.getAiRapChangeProposal">
): Promise<WebRpcResult<"app/actions/ai/rap-change.getAiRapChangeProposal">> {
  return callBackendAction("app/actions/ai/rap-change.getAiRapChangeProposal", args, {
    allowCookieWrites: true,
  });
}
export async function confirmAiRapChangeProposal(
  ...args: WebRpcArgs<"app/actions/ai/rap-change.confirmAiRapChangeProposal">
): Promise<WebRpcResult<"app/actions/ai/rap-change.confirmAiRapChangeProposal">> {
  return callBackendAction("app/actions/ai/rap-change.confirmAiRapChangeProposal", args, {
    allowCookieWrites: true,
  });
}
