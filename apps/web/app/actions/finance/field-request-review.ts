"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/finance/field-request-review";

export async function verifyFieldRequest(
  ...args: WebRpcArgs<"app/actions/finance/field-request-review.verifyFieldRequest">
): Promise<WebRpcResult<"app/actions/finance/field-request-review.verifyFieldRequest">> {
  return callBackendAction("app/actions/finance/field-request-review.verifyFieldRequest", args, {
    allowCookieWrites: true,
  });
}

export async function approveFieldRequest(
  ...args: WebRpcArgs<"app/actions/finance/field-request-review.approveFieldRequest">
): Promise<WebRpcResult<"app/actions/finance/field-request-review.approveFieldRequest">> {
  return callBackendAction("app/actions/finance/field-request-review.approveFieldRequest", args, {
    allowCookieWrites: true,
  });
}

export async function approveVendorPayment(
  ...args: WebRpcArgs<"app/actions/finance/field-request-review.approveVendorPayment">
): Promise<WebRpcResult<"app/actions/finance/field-request-review.approveVendorPayment">> {
  return callBackendAction("app/actions/finance/field-request-review.approveVendorPayment", args, {
    allowCookieWrites: true,
  });
}
