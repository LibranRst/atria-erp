"use server";

import { callBackend, callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/onboarding-review";

export async function hasPendingOnboardingSetupApproval(
  ...args: WebRpcArgs<"app/actions/onboarding-review.hasPendingOnboardingSetupApproval">
): Promise<WebRpcResult<"app/actions/onboarding-review.hasPendingOnboardingSetupApproval">> {
  return callBackend("app/actions/onboarding-review.hasPendingOnboardingSetupApproval", args, {
    allowCookieWrites: true,
  });
}

export async function getOnboardingReviewState(
  ...args: WebRpcArgs<"app/actions/onboarding-review.getOnboardingReviewState">
): Promise<WebRpcResult<"app/actions/onboarding-review.getOnboardingReviewState">> {
  return callBackendAction("app/actions/onboarding-review.getOnboardingReviewState", args, {
    allowCookieWrites: true,
  });
}
