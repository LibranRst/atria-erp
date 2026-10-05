"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/finance/field-requests";

export async function submitFieldRequest(
  ...args: WebRpcArgs<"app/actions/finance/field-requests.submitFieldRequest">
): Promise<WebRpcResult<"app/actions/finance/field-requests.submitFieldRequest">> {
  return callBackendAction("app/actions/finance/field-requests.submitFieldRequest", args, {
    allowCookieWrites: true,
  });
}

export async function submitFieldRequests(
  ...args: WebRpcArgs<"app/actions/finance/field-requests.submitFieldRequests">
): Promise<WebRpcResult<"app/actions/finance/field-requests.submitFieldRequests">> {
  return callBackendAction("app/actions/finance/field-requests.submitFieldRequests", args, {
    allowCookieWrites: true,
  });
}

export async function verifyFieldRequest(
  ...args: WebRpcArgs<"app/actions/finance/field-requests.verifyFieldRequest">
): Promise<WebRpcResult<"app/actions/finance/field-requests.verifyFieldRequest">> {
  return callBackendAction("app/actions/finance/field-requests.verifyFieldRequest", args, {
    allowCookieWrites: true,
  });
}

export async function approveFieldRequest(
  ...args: WebRpcArgs<"app/actions/finance/field-requests.approveFieldRequest">
): Promise<WebRpcResult<"app/actions/finance/field-requests.approveFieldRequest">> {
  return callBackendAction("app/actions/finance/field-requests.approveFieldRequest", args, {
    allowCookieWrites: true,
  });
}

export async function payFieldRequest(
  ...args: WebRpcArgs<"app/actions/finance/field-requests.payFieldRequest">
): Promise<WebRpcResult<"app/actions/finance/field-requests.payFieldRequest">> {
  return callBackendAction("app/actions/finance/field-requests.payFieldRequest", args, {
    allowCookieWrites: true,
  });
}

export async function approveVendorPayment(
  ...args: WebRpcArgs<"app/actions/finance/field-requests.approveVendorPayment">
): Promise<WebRpcResult<"app/actions/finance/field-requests.approveVendorPayment">> {
  return callBackendAction("app/actions/finance/field-requests.approveVendorPayment", args, {
    allowCookieWrites: true,
  });
}
