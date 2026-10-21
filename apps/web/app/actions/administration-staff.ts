"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/administration-staff";

export async function createStaffUser(
  ...args: WebRpcArgs<"app/actions/administration-staff.createStaffUser">
): Promise<WebRpcResult<"app/actions/administration-staff.createStaffUser">> {
  return callBackendAction("app/actions/administration-staff.createStaffUser", args, {
    allowCookieWrites: true,
  });
}

export async function updateStaffUser(
  ...args: WebRpcArgs<"app/actions/administration-staff.updateStaffUser">
): Promise<WebRpcResult<"app/actions/administration-staff.updateStaffUser">> {
  return callBackendAction("app/actions/administration-staff.updateStaffUser", args, {
    allowCookieWrites: true,
  });
}

export async function changeTemporaryPassword(
  ...args: WebRpcArgs<"app/actions/administration-staff.changeTemporaryPassword">
): Promise<WebRpcResult<"app/actions/administration-staff.changeTemporaryPassword">> {
  return callBackendAction("app/actions/administration-staff.changeTemporaryPassword", args, {
    allowCookieWrites: true,
  });
}
