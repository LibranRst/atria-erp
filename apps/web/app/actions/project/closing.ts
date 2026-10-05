"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/project/closing";

export async function getProjectClosingChecklist(
  ...args: WebRpcArgs<"app/actions/project/closing.getProjectClosingChecklist">
): Promise<WebRpcResult<"app/actions/project/closing.getProjectClosingChecklist">> {
  return callBackendAction("app/actions/project/closing.getProjectClosingChecklist", args, {
    allowCookieWrites: true,
  });
}

export async function completeProject(
  ...args: WebRpcArgs<"app/actions/project/closing.completeProject">
): Promise<WebRpcResult<"app/actions/project/closing.completeProject">> {
  return callBackendAction("app/actions/project/closing.completeProject", args, {
    allowCookieWrites: true,
  });
}
