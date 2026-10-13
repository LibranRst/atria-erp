"use server";
import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export async function createRabRevision(
  ...args: WebRpcArgs<"app/actions/project/rab-workflow.createRabRevision">
): Promise<WebRpcResult<"app/actions/project/rab-workflow.createRabRevision">> {
  return callBackendAction("app/actions/project/rab-workflow.createRabRevision", args, {
    allowCookieWrites: true,
  });
}
export async function rejectChangeOrder(
  ...args: WebRpcArgs<"app/actions/project/rab-workflow.rejectChangeOrder">
): Promise<WebRpcResult<"app/actions/project/rab-workflow.rejectChangeOrder">> {
  return callBackendAction("app/actions/project/rab-workflow.rejectChangeOrder", args, {
    allowCookieWrites: true,
  });
}
export async function updateRabEstimateHeader(
  ...args: WebRpcArgs<"app/actions/project/rab-workflow.updateRabEstimateHeader">
): Promise<WebRpcResult<"app/actions/project/rab-workflow.updateRabEstimateHeader">> {
  return callBackendAction("app/actions/project/rab-workflow.updateRabEstimateHeader", args, {
    allowCookieWrites: true,
  });
}
