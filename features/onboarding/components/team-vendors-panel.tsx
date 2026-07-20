"use client";

import type { AdministrationOverview } from "@/app/actions/administration";
import { AdministrationManager } from "@/features/administration/components/administration-manager";
import { OnboardingStage } from "./onboarding-primitives";

export function TeamVendorsPanel({
  data,
  onMutationComplete,
}: {
  readonly data: AdministrationOverview;
  readonly onMutationComplete: () => void;
}): React.JSX.Element {
  return (
    <OnboardingStage>
      <AdministrationManager
        initialData={data}
        presentation="onboarding"
        onMutationComplete={onMutationComplete}
      />
    </OnboardingStage>
  );
}
