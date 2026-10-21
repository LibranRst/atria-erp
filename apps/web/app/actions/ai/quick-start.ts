"use server";
import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export async function getAiQuickStartProposal(
  ...args: WebRpcArgs<"app/actions/ai/quick-start.getAiQuickStartProposal">
): Promise<WebRpcResult<"app/actions/ai/quick-start.getAiQuickStartProposal">> {
  return callBackendAction("app/actions/ai/quick-start.getAiQuickStartProposal", args);
}
export async function confirmAiQuickStartProposal(
  ...args: WebRpcArgs<"app/actions/ai/quick-start.confirmAiQuickStartProposal">
): Promise<WebRpcResult<"app/actions/ai/quick-start.confirmAiQuickStartProposal">> {
  return callBackendAction("app/actions/ai/quick-start.confirmAiQuickStartProposal", args);
}
