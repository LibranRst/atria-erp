"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/onboarding-overview";

export async function getOwnerOnboardingOverview(
  ...args: WebRpcArgs<"app/actions/onboarding-overview.getOwnerOnboardingOverview">
): Promise<WebRpcResult<"app/actions/onboarding-overview.getOwnerOnboardingOverview">> {
  return callBackendAction("app/actions/onboarding-overview.getOwnerOnboardingOverview", args, {
    allowCookieWrites: true,
  });
}
