import { redirect } from "next/navigation";

import { QuickStartWorkspace } from "@/features/onboarding/components/quick-start/quick-start-workspace";
import { getQuickStartWorkspaceData } from "@/features/onboarding/server/get-quick-start-workspace-data";
import {
  quickStartStepIdSchema,
  type QuickStartStepId,
} from "@atria/core/onboarding/organization-setup";

export const dynamic = "force-dynamic";

export default async function OwnerOnboardingPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly step?: string }>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const parsedStep = quickStartStepIdSchema.safeParse(params.step);
  const requestedStep: QuickStartStepId | undefined = parsedStep.success
    ? parsedStep.data
    : undefined;
  const result = await getQuickStartWorkspaceData(requestedStep);
  if (!result.success) {
    if (result.error.code === "UNAUTHORIZED") redirect("/login");
    if (result.error.code === "FORBIDDEN") redirect("/settings?tab=readiness");
    throw new Error(result.error.message);
  }
  if (result.data.overview.quickStart.state.status === "COMPLETED") {
    redirect("/settings?tab=readiness");
  }
  if (requestedStep && requestedStep !== result.data.activeStep) {
    redirect(`/onboarding?step=${result.data.activeStep}`);
  }
  return <QuickStartWorkspace initialData={result.data} />;
}
