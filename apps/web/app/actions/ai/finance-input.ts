"use server";
import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export async function getAiFinanceInputProposal(
  ...args: WebRpcArgs<"app/actions/ai/finance-input.getAiFinanceInputProposal">
): Promise<WebRpcResult<"app/actions/ai/finance-input.getAiFinanceInputProposal">> {
  return callBackendAction("app/actions/ai/finance-input.getAiFinanceInputProposal", args, {
    allowCookieWrites: true,
  });
}
export async function confirmAiFinanceInputProposal(
  ...args: WebRpcArgs<"app/actions/ai/finance-input.confirmAiFinanceInputProposal">
): Promise<WebRpcResult<"app/actions/ai/finance-input.confirmAiFinanceInputProposal">> {
  return callBackendAction("app/actions/ai/finance-input.confirmAiFinanceInputProposal", args, {
    allowCookieWrites: true,
  });
}
