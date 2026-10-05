"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/project/project-rap-actions";

export async function createProjectRap(
  ...args: WebRpcArgs<"app/actions/project/project-rap-actions.createProjectRap">
): Promise<WebRpcResult<"app/actions/project/project-rap-actions.createProjectRap">> {
  return callBackendAction("app/actions/project/project-rap-actions.createProjectRap", args, {
    allowCookieWrites: true,
  });
}

export async function addProjectRapItem(
  ...args: WebRpcArgs<"app/actions/project/project-rap-actions.addProjectRapItem">
): Promise<WebRpcResult<"app/actions/project/project-rap-actions.addProjectRapItem">> {
  return callBackendAction("app/actions/project/project-rap-actions.addProjectRapItem", args, {
    allowCookieWrites: true,
  });
}

export async function updateProjectRapItem(
  ...args: WebRpcArgs<"app/actions/project/project-rap-actions.updateProjectRapItem">
): Promise<WebRpcResult<"app/actions/project/project-rap-actions.updateProjectRapItem">> {
  return callBackendAction("app/actions/project/project-rap-actions.updateProjectRapItem", args, {
    allowCookieWrites: true,
  });
}

export async function deleteProjectRapItem(
  ...args: WebRpcArgs<"app/actions/project/project-rap-actions.deleteProjectRapItem">
): Promise<WebRpcResult<"app/actions/project/project-rap-actions.deleteProjectRapItem">> {
  return callBackendAction("app/actions/project/project-rap-actions.deleteProjectRapItem", args, {
    allowCookieWrites: true,
  });
}

export async function lockProjectRap(
  ...args: WebRpcArgs<"app/actions/project/project-rap-actions.lockProjectRap">
): Promise<WebRpcResult<"app/actions/project/project-rap-actions.lockProjectRap">> {
  return callBackendAction("app/actions/project/project-rap-actions.lockProjectRap", args, {
    allowCookieWrites: true,
  });
}
