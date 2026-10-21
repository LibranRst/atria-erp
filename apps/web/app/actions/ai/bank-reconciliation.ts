"use server";
import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export async function getAiReconciliationProposal(
  ...args: WebRpcArgs<"app/actions/ai/bank-reconciliation.getAiReconciliationProposal">
): Promise<WebRpcResult<"app/actions/ai/bank-reconciliation.getAiReconciliationProposal">> {
  return callBackendAction("app/actions/ai/bank-reconciliation.getAiReconciliationProposal", args, {
    allowCookieWrites: true,
  });
}
export async function patchAiReconciliationProposal(
  ...args: WebRpcArgs<"app/actions/ai/bank-reconciliation.patchAiReconciliationProposal">
): Promise<WebRpcResult<"app/actions/ai/bank-reconciliation.patchAiReconciliationProposal">> {
  return callBackendAction(
    "app/actions/ai/bank-reconciliation.patchAiReconciliationProposal",
    args,
    { allowCookieWrites: true },
  );
}
export async function discardAiReconciliationProposal(
  ...args: WebRpcArgs<"app/actions/ai/bank-reconciliation.discardAiReconciliationProposal">
): Promise<WebRpcResult<"app/actions/ai/bank-reconciliation.discardAiReconciliationProposal">> {
  return callBackendAction(
    "app/actions/ai/bank-reconciliation.discardAiReconciliationProposal",
    args,
    { allowCookieWrites: true },
  );
}
export async function confirmAiReconciliationProposal(
  ...args: WebRpcArgs<"app/actions/ai/bank-reconciliation.confirmAiReconciliationProposal">
): Promise<WebRpcResult<"app/actions/ai/bank-reconciliation.confirmAiReconciliationProposal">> {
  return callBackendAction(
    "app/actions/ai/bank-reconciliation.confirmAiReconciliationProposal",
    args,
    { allowCookieWrites: true },
  );
}
