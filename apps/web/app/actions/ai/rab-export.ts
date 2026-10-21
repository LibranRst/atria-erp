"use server";
import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export async function getAiRabExportPreview(
  ...args: WebRpcArgs<"app/actions/ai/rab-export.getAiRabExportPreview">
): Promise<WebRpcResult<"app/actions/ai/rab-export.getAiRabExportPreview">> {
  return callBackendAction("app/actions/ai/rab-export.getAiRabExportPreview", args);
}
