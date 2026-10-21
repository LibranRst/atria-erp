"use server";
import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export async function getAiOwnProfileProposal(
  ...args: WebRpcArgs<"app/actions/ai/own-profile.getAiOwnProfileProposal">
): Promise<WebRpcResult<"app/actions/ai/own-profile.getAiOwnProfileProposal">> {
  return callBackendAction("app/actions/ai/own-profile.getAiOwnProfileProposal", args);
}
export async function confirmAiOwnProfileProposal(
  ...args: WebRpcArgs<"app/actions/ai/own-profile.confirmAiOwnProfileProposal">
): Promise<WebRpcResult<"app/actions/ai/own-profile.confirmAiOwnProfileProposal">> {
  return callBackendAction("app/actions/ai/own-profile.confirmAiOwnProfileProposal", args);
}
