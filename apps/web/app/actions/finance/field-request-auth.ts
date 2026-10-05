"use server";

import { callBackend } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/finance/field-request-auth";

export async function authorizeFieldRequestAction(
  ...args: WebRpcArgs<"app/actions/finance/field-request-auth.authorizeFieldRequestAction">
): Promise<WebRpcResult<"app/actions/finance/field-request-auth.authorizeFieldRequestAction">> {
  return callBackend("app/actions/finance/field-request-auth.authorizeFieldRequestAction", args, {
    allowCookieWrites: true,
  });
}

export async function authorizeOwnerVendorApproval(
  ...args: WebRpcArgs<"app/actions/finance/field-request-auth.authorizeOwnerVendorApproval">
): Promise<WebRpcResult<"app/actions/finance/field-request-auth.authorizeOwnerVendorApproval">> {
  return callBackend("app/actions/finance/field-request-auth.authorizeOwnerVendorApproval", args, {
    allowCookieWrites: true,
  });
}
