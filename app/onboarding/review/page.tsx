import { redirect } from "next/navigation";

import { getDeveloperAccountSimulationState } from "@/app/actions/developer-account-simulation";
import { getOnboardingReviewState } from "@/app/actions/onboarding-review";
import { OnboardingFinanceReview } from "@/features/onboarding/onboarding-finance-review";

export const dynamic = "force-dynamic";

export default async function OnboardingReviewPage(): Promise<React.JSX.Element> {
  const [review, simulation] = await Promise.all([
    getOnboardingReviewState(),
    getDeveloperAccountSimulationState(),
  ]);
  if (!review.success) redirect("/");
  return (
    <OnboardingFinanceReview
      pendingBatches={review.data.pendingBatches}
      simulated={simulation.success && simulation.data.isSimulating}
    />
  );
}
