"use client";

import type { PricingTemplateRow } from "@/app/actions/settings/pricing-library";
import type { SettingsOverview } from "@/app/actions/settings/system";
import { LibrarySettingsManager } from "@/features/settings/components/library-settings-manager";
import { OnboardingNotice, OnboardingStage } from "./onboarding-primitives";

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
        Library adalah template harga untuk RAP/RAB. Ia bukan Material Master dan tidak memiliki stok.
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
        roleName={settings.roleName}
        canManage={settings.permissions.canManageItemLibrary}
        presentation="onboarding"
        hideHeader
        onMutationComplete={onMutationComplete}
      />
    </OnboardingStage>
  );
}
