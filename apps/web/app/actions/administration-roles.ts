"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/administration-roles";

export async function listManagedRoles(
  ...args: WebRpcArgs<"app/actions/administration-roles.listManagedRoles">
): Promise<WebRpcResult<"app/actions/administration-roles.listManagedRoles">> {
  return callBackendAction("app/actions/administration-roles.listManagedRoles", args, {
    allowCookieWrites: true,
  });
}

export async function createRole(
  ...args: WebRpcArgs<"app/actions/administration-roles.createRole">
): Promise<WebRpcResult<"app/actions/administration-roles.createRole">> {
  return callBackendAction("app/actions/administration-roles.createRole", args, {
    allowCookieWrites: true,
  });
}

export async function updateRolePermissions(
  ...args: WebRpcArgs<"app/actions/administration-roles.updateRolePermissions">
): Promise<WebRpcResult<"app/actions/administration-roles.updateRolePermissions">> {
  return callBackendAction("app/actions/administration-roles.updateRolePermissions", args, {
    allowCookieWrites: true,
  });
}

export async function updateRoleDetails(
  ...args: WebRpcArgs<"app/actions/administration-roles.updateRoleDetails">
): Promise<WebRpcResult<"app/actions/administration-roles.updateRoleDetails">> {
  return callBackendAction("app/actions/administration-roles.updateRoleDetails", args, {
    allowCookieWrites: true,
  });
}

export async function deleteRole(
  ...args: WebRpcArgs<"app/actions/administration-roles.deleteRole">
): Promise<WebRpcResult<"app/actions/administration-roles.deleteRole">> {
  return callBackendAction("app/actions/administration-roles.deleteRole", args, {
    allowCookieWrites: true,
  });
}
