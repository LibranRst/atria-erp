import "server-only";

import { callBackend } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/features/onboarding/server/get-onboarding-review-page-data";

export async function getOnboardingReviewPageData(
  ...args: WebRpcArgs<"features/onboarding/server/get-onboarding-review-page-data.getOnboardingReviewPageData">
): Promise<
  WebRpcResult<"features/onboarding/server/get-onboarding-review-page-data.getOnboardingReviewPageData">
> {
  return callBackend(
    "features/onboarding/server/get-onboarding-review-page-data.getOnboardingReviewPageData",
    args,
  );
}
