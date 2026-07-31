import { redirect } from "next/navigation";

import { OnboardingFinanceReview } from "@/features/onboarding/components/workspaces/onboarding-finance-review";
import { getOnboardingReviewPageData } from "@/features/onboarding/server/get-onboarding-review-page-data";

export const dynamic = "force-dynamic";

export default async function OnboardingReviewPage(): Promise<React.JSX.Element> {
  const data = await getOnboardingReviewPageData();
  if (data.status === "unavailable") redirect("/");

  return (
    <OnboardingFinanceReview pendingBatches={data.pendingBatches} simulated={data.simulated} />
  );
}
