"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/finance/vendor-bill-drafts";

export async function listVendorBillDrafts(
  ...args: WebRpcArgs<"app/actions/finance/vendor-bill-drafts.listVendorBillDrafts">
): Promise<WebRpcResult<"app/actions/finance/vendor-bill-drafts.listVendorBillDrafts">> {
  return callBackendAction("app/actions/finance/vendor-bill-drafts.listVendorBillDrafts", args, {
    allowCookieWrites: true,
  });
}

export async function getVendorBillDraft(
  ...args: WebRpcArgs<"app/actions/finance/vendor-bill-drafts.getVendorBillDraft">
): Promise<WebRpcResult<"app/actions/finance/vendor-bill-drafts.getVendorBillDraft">> {
  return callBackendAction("app/actions/finance/vendor-bill-drafts.getVendorBillDraft", args, {
    allowCookieWrites: true,
  });
}

export async function saveVendorBillDraft(
  ...args: WebRpcArgs<"app/actions/finance/vendor-bill-drafts.saveVendorBillDraft">
): Promise<WebRpcResult<"app/actions/finance/vendor-bill-drafts.saveVendorBillDraft">> {
  return callBackendAction("app/actions/finance/vendor-bill-drafts.saveVendorBillDraft", args, {
    allowCookieWrites: true,
  });
}

export async function discardVendorBillDraft(
  ...args: WebRpcArgs<"app/actions/finance/vendor-bill-drafts.discardVendorBillDraft">
): Promise<WebRpcResult<"app/actions/finance/vendor-bill-drafts.discardVendorBillDraft">> {
  return callBackendAction("app/actions/finance/vendor-bill-drafts.discardVendorBillDraft", args, {
    allowCookieWrites: true,
  });
}

export async function submitVendorBillDraft(
  ...args: WebRpcArgs<"app/actions/finance/vendor-bill-drafts.submitVendorBillDraft">
): Promise<WebRpcResult<"app/actions/finance/vendor-bill-drafts.submitVendorBillDraft">> {
  return callBackendAction("app/actions/finance/vendor-bill-drafts.submitVendorBillDraft", args, {
    allowCookieWrites: true,
  });
}
