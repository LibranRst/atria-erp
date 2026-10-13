"use server";
import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export async function getAiProjectStockProposal(
  ...args: WebRpcArgs<"app/actions/ai/project-stock.getAiProjectStockProposal">
): Promise<WebRpcResult<"app/actions/ai/project-stock.getAiProjectStockProposal">> {
  return callBackendAction("app/actions/ai/project-stock.getAiProjectStockProposal", args, {
    allowCookieWrites: true,
  });
}
export async function confirmAiProjectStockProposal(
  ...args: WebRpcArgs<"app/actions/ai/project-stock.confirmAiProjectStockProposal">
): Promise<WebRpcResult<"app/actions/ai/project-stock.confirmAiProjectStockProposal">> {
  return callBackendAction("app/actions/ai/project-stock.confirmAiProjectStockProposal", args, {
    allowCookieWrites: true,
  });
}
