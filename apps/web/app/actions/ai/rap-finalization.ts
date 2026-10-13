"use server";
import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export async function getAiRapSetupProposal(
  ...args: WebRpcArgs<"app/actions/ai/rap-finalization.getAiRapSetupProposal">
): Promise<WebRpcResult<"app/actions/ai/rap-finalization.getAiRapSetupProposal">> {
  return callBackendAction("app/actions/ai/rap-finalization.getAiRapSetupProposal", args, {
    allowCookieWrites: true,
  });
}
export async function confirmAiRapSetupProposal(
  ...args: WebRpcArgs<"app/actions/ai/rap-finalization.confirmAiRapSetupProposal">
): Promise<WebRpcResult<"app/actions/ai/rap-finalization.confirmAiRapSetupProposal">> {
  return callBackendAction("app/actions/ai/rap-finalization.confirmAiRapSetupProposal", args, {
    allowCookieWrites: true,
  });
}
