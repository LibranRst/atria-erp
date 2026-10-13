"use server";
import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export async function getAiRapLifecycleProposal(
  ...args: WebRpcArgs<"app/actions/ai/rap-lifecycle.getAiRapLifecycleProposal">
): Promise<WebRpcResult<"app/actions/ai/rap-lifecycle.getAiRapLifecycleProposal">> {
  return callBackendAction("app/actions/ai/rap-lifecycle.getAiRapLifecycleProposal", args, {
    allowCookieWrites: true,
  });
}
export async function confirmAiRapLifecycleProposal(
  ...args: WebRpcArgs<"app/actions/ai/rap-lifecycle.confirmAiRapLifecycleProposal">
): Promise<WebRpcResult<"app/actions/ai/rap-lifecycle.confirmAiRapLifecycleProposal">> {
  return callBackendAction("app/actions/ai/rap-lifecycle.confirmAiRapLifecycleProposal", args, {
    allowCookieWrites: true,
  });
}
