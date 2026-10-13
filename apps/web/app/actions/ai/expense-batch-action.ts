"use server";
import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export async function getAiExpenseBatchAction(
  ...args: WebRpcArgs<"app/actions/ai/expense-batch-action.getAiExpenseBatchAction">
): Promise<WebRpcResult<"app/actions/ai/expense-batch-action.getAiExpenseBatchAction">> {
  return callBackendAction("app/actions/ai/expense-batch-action.getAiExpenseBatchAction", args, {
    allowCookieWrites: true,
  });
}
export async function confirmAiExpenseBatchAction(
  ...args: WebRpcArgs<"app/actions/ai/expense-batch-action.confirmAiExpenseBatchAction">
): Promise<WebRpcResult<"app/actions/ai/expense-batch-action.confirmAiExpenseBatchAction">> {
  return callBackendAction(
    "app/actions/ai/expense-batch-action.confirmAiExpenseBatchAction",
    args,
    { allowCookieWrites: true },
  );
}
