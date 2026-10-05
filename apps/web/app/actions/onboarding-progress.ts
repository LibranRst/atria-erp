"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/onboarding-progress";

export async function advanceOwnerOnboardingStep(
  ...args: WebRpcArgs<"app/actions/onboarding-progress.advanceOwnerOnboardingStep">
): Promise<WebRpcResult<"app/actions/onboarding-progress.advanceOwnerOnboardingStep">> {
  return callBackendAction("app/actions/onboarding-progress.advanceOwnerOnboardingStep", args, {
    allowCookieWrites: true,
  });
}

export async function pauseOwnerOnboarding(
  ...args: WebRpcArgs<"app/actions/onboarding-progress.pauseOwnerOnboarding">
): Promise<WebRpcResult<"app/actions/onboarding-progress.pauseOwnerOnboarding">> {
  return callBackendAction("app/actions/onboarding-progress.pauseOwnerOnboarding", args, {
    allowCookieWrites: true,
  });
}

export async function completeOwnerOnboarding(
  ...args: WebRpcArgs<"app/actions/onboarding-progress.completeOwnerOnboarding">
): Promise<WebRpcResult<"app/actions/onboarding-progress.completeOwnerOnboarding">> {
  return callBackendAction("app/actions/onboarding-progress.completeOwnerOnboarding", args, {
    allowCookieWrites: true,
  });
}
