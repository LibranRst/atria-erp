"use server";
import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export async function getAiBudgetSyncProposal(
  ...args: WebRpcArgs<"app/actions/ai/budget-sync.getAiBudgetSyncProposal">
): Promise<WebRpcResult<"app/actions/ai/budget-sync.getAiBudgetSyncProposal">> {
  return callBackendAction("app/actions/ai/budget-sync.getAiBudgetSyncProposal", args);
}
export async function confirmAiBudgetSyncProposal(
  ...args: WebRpcArgs<"app/actions/ai/budget-sync.confirmAiBudgetSyncProposal">
): Promise<WebRpcResult<"app/actions/ai/budget-sync.confirmAiBudgetSyncProposal">> {
  return callBackendAction("app/actions/ai/budget-sync.confirmAiBudgetSyncProposal", args);
}
