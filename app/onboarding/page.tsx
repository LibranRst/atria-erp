import { redirect } from "next/navigation";

import { OwnerOnboardingWorkspace } from "@/features/onboarding/owner-onboarding-workspace";
import { getOwnerOnboardingWorkspaceData } from "@/features/onboarding/server/get-owner-onboarding-workspace-data";
import {
  onboardingStepIdSchema,
  type OnboardingStepId,
} from "@/lib/onboarding/owner-onboarding";

export const dynamic = "force-dynamic";

export default async function OwnerOnboardingPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly step?: string }>;
}): Promise<React.JSX.Element> {
  const result = await getOwnerOnboardingWorkspaceData();
  if (!result.success) {
    if (result.error.code === "UNAUTHORIZED") redirect("/login");
    redirect("/");
  }
  if (!result.data.overview.canManageOnboarding) redirect("/settings?tab=setup");
  const params = await searchParams;
  const parsedStep = onboardingStepIdSchema.safeParse(params.step);
  const activeStep: OnboardingStepId = parsedStep.success
    ? parsedStep.data
    : result.data.overview.state.currentStep;
  return (
    <OwnerOnboardingWorkspace
      key={`${activeStep}-${result.data.overview.state.status}`}
      initialData={result.data}
      initialStep={activeStep}
    />
  );
}
