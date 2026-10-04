"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/project/crud";

export async function createProjectAction(
  ...args: WebRpcArgs<"app/actions/project/crud.createProjectAction">
): Promise<WebRpcResult<"app/actions/project/crud.createProjectAction">> {
  return callBackendAction("app/actions/project/crud.createProjectAction", args, {
    allowCookieWrites: true,
  });
}

export async function updateProjectAction(
  ...args: WebRpcArgs<"app/actions/project/crud.updateProjectAction">
): Promise<WebRpcResult<"app/actions/project/crud.updateProjectAction">> {
  return callBackendAction("app/actions/project/crud.updateProjectAction", args, {
    allowCookieWrites: true,
  });
}

export async function assignProjectManagerAction(
  ...args: WebRpcArgs<"app/actions/project/crud.assignProjectManagerAction">
): Promise<WebRpcResult<"app/actions/project/crud.assignProjectManagerAction">> {
  return callBackendAction("app/actions/project/crud.assignProjectManagerAction", args, {
    allowCookieWrites: true,
  });
}

export async function getProjectFormData(
  ...args: WebRpcArgs<"app/actions/project/crud.getProjectFormData">
): Promise<WebRpcResult<"app/actions/project/crud.getProjectFormData">> {
  return callBackendAction("app/actions/project/crud.getProjectFormData", args, {
    allowCookieWrites: true,
  });
}
