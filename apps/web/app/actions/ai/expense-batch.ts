"use server";
import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export async function startAiExpenseBatchReview(
  ...args: WebRpcArgs<"app/actions/ai/expense-batch.startAiExpenseBatchReview">
): Promise<WebRpcResult<"app/actions/ai/expense-batch.startAiExpenseBatchReview">> {
  return callBackendAction("app/actions/ai/expense-batch.startAiExpenseBatchReview", args, {
    allowCookieWrites: true,
  });
}
export async function getAiExpenseBatchReview(
  ...args: WebRpcArgs<"app/actions/ai/expense-batch.getAiExpenseBatchReview">
): Promise<WebRpcResult<"app/actions/ai/expense-batch.getAiExpenseBatchReview">> {
  return callBackendAction("app/actions/ai/expense-batch.getAiExpenseBatchReview", args, {
    allowCookieWrites: true,
  });
}
export async function patchAiExpenseBatchReview(
  ...args: WebRpcArgs<"app/actions/ai/expense-batch.patchAiExpenseBatchReview">
): Promise<WebRpcResult<"app/actions/ai/expense-batch.patchAiExpenseBatchReview">> {
  return callBackendAction("app/actions/ai/expense-batch.patchAiExpenseBatchReview", args, {
    allowCookieWrites: true,
  });
}
export async function submitAiExpenseBatchReview(
  ...args: WebRpcArgs<"app/actions/ai/expense-batch.submitAiExpenseBatchReview">
): Promise<WebRpcResult<"app/actions/ai/expense-batch.submitAiExpenseBatchReview">> {
  return callBackendAction("app/actions/ai/expense-batch.submitAiExpenseBatchReview", args, {
    allowCookieWrites: true,
  });
}
export async function discardAiExpenseBatchReview(
  ...args: WebRpcArgs<"app/actions/ai/expense-batch.discardAiExpenseBatchReview">
): Promise<WebRpcResult<"app/actions/ai/expense-batch.discardAiExpenseBatchReview">> {
  return callBackendAction("app/actions/ai/expense-batch.discardAiExpenseBatchReview", args, {
    allowCookieWrites: true,
  });
}
