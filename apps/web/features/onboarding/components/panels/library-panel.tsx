"use client";

import type { PricingTemplateRow } from "@/app/actions/settings/pricing-library";
import type { SettingsOverview } from "@/app/actions/settings/system";
import { LibrarySettingsManager } from "@/features/settings/components/library/library-settings-manager";
import { OnboardingNotice, OnboardingStage } from "../shared/onboarding-primitives";

export function LibraryPanel({
  settings,
  items,
  onMutationComplete,
}: {
  readonly settings: SettingsOverview;
  readonly items: readonly PricingTemplateRow[];
  readonly onMutationComplete: () => void;
}): React.JSX.Element {
  return (
    <OnboardingStage>
      <OnboardingNotice>
        Library adalah template harga untuk RAP/RAB. Ia bukan Material Master dan tidak memiliki
        stok.
      </OnboardingNotice>
      <LibrarySettingsManager
        initialItems={items}
        categories={settings.expenseCategories}
        materials={settings.materials.map((row) => ({
          id: row.id,
          name: row.name,
          isActive: row.isActive,
        }))}
        vendors={settings.vendors}
        canManage={settings.permissions.canManageItemLibrary}
        presentation="onboarding"
        onMutationComplete={onMutationComplete}
      />
    </OnboardingStage>
  );
}
