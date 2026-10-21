"use server";
import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export async function getAiBankCashProposal(
  ...args: WebRpcArgs<"app/actions/ai/bank-cash.getAiBankCashProposal">
): Promise<WebRpcResult<"app/actions/ai/bank-cash.getAiBankCashProposal">> {
  return callBackendAction("app/actions/ai/bank-cash.getAiBankCashProposal", args, {
    allowCookieWrites: true,
  });
}
export async function confirmAiBankCashProposal(
  ...args: WebRpcArgs<"app/actions/ai/bank-cash.confirmAiBankCashProposal">
): Promise<WebRpcResult<"app/actions/ai/bank-cash.confirmAiBankCashProposal">> {
  return callBackendAction("app/actions/ai/bank-cash.confirmAiBankCashProposal", args, {
    allowCookieWrites: true,
  });
}
