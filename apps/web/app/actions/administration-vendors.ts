"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/administration-vendors";

export async function saveVendor(
  ...args: WebRpcArgs<"app/actions/administration-vendors.saveVendor">
): Promise<WebRpcResult<"app/actions/administration-vendors.saveVendor">> {
  return callBackendAction("app/actions/administration-vendors.saveVendor", args, {
    allowCookieWrites: true,
  });
}

export async function setVendorActive(
  ...args: WebRpcArgs<"app/actions/administration-vendors.setVendorActive">
): Promise<WebRpcResult<"app/actions/administration-vendors.setVendorActive">> {
  return callBackendAction("app/actions/administration-vendors.setVendorActive", args, {
    allowCookieWrites: true,
  });
}
