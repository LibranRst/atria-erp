"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/settings/approval-thresholds";

export async function getApprovalThresholdSettings(
  ...args: WebRpcArgs<"app/actions/settings/approval-thresholds.getApprovalThresholdSettings">
): Promise<WebRpcResult<"app/actions/settings/approval-thresholds.getApprovalThresholdSettings">> {
  return callBackendAction(
    "app/actions/settings/approval-thresholds.getApprovalThresholdSettings",
    args,
    { allowCookieWrites: true },
  );
}

export async function updateApprovalThresholds(
  ...args: WebRpcArgs<"app/actions/settings/approval-thresholds.updateApprovalThresholds">
): Promise<WebRpcResult<"app/actions/settings/approval-thresholds.updateApprovalThresholds">> {
  return callBackendAction(
    "app/actions/settings/approval-thresholds.updateApprovalThresholds",
    args,
    { allowCookieWrites: true },
  );
}
