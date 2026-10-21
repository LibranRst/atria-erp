import { getDeveloperAccountSimulationState } from "@backend/app/actions/developer-account-simulation";
import type { InventoryOpeningBatchView } from "@backend/app/actions/material/opening-inventory";
import { getOnboardingReviewState } from "@backend/app/actions/onboarding-review";

export type OnboardingReviewPageData =
  | {
      readonly status: "unavailable";
    }
  | {
      readonly status: "ready";
      readonly pendingBatches: readonly InventoryOpeningBatchView[];
      readonly simulated: boolean;
    };

export async function getOnboardingReviewPageData(): Promise<OnboardingReviewPageData> {
  const [review, simulation] = await Promise.all([
    getOnboardingReviewState(),
    getDeveloperAccountSimulationState(),
  ]);

  if (!review.success) {
    return { status: "unavailable" };
  }

  return {
    status: "ready",
    pendingBatches: review.data.pendingBatches,
    simulated: simulation.success && simulation.data.isSimulating,
  };
}
