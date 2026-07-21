import { redirect } from "next/navigation";

import { getPricingTemplates } from "@/app/actions/settings/pricing-library";
import { getSettingsOverview } from "@/app/actions/settings/system";
import { getAdministrationOverview, getProductionReadiness } from "@/app/actions/administration";
import { getOwnerOnboardingOverview } from "@/app/actions/onboarding";
import {
  getInitialStockCandidates,
  getInventoryOpeningBatches,
} from "@/app/actions/material/opening-inventory";
import { SettingsDashboard } from "@/features/settings/components/settings-dashboard";
import type { SettingsTab } from "@/features/settings/components/settings-tabs-config";
import { PageState } from "@/components/ui";

type SettingsPageContentProps = {
  readonly initialTab?: SettingsTab;
};

export async function SettingsPageContent({
  initialTab = "overview",
}: SettingsPageContentProps): Promise<React.JSX.Element> {
  const [result, templates, administration, readiness, onboarding, initialStock, openingBatches] =
    await Promise.all([
      getSettingsOverview(),
      getPricingTemplates(true),
      getAdministrationOverview(),
      getProductionReadiness(),
      getOwnerOnboardingOverview(),
      getInitialStockCandidates(),
      getInventoryOpeningBatches(),
    ]);

  if (!result.success) {
    if (result.error.code === "UNAUTHORIZED") redirect("/login");
    return (
      <PageState
        kind={result.error.code === "FORBIDDEN" ? "restricted" : "error"}
        title={
          result.error.code === "FORBIDDEN"
            ? "Akses pengaturan dibatasi"
            : "Pengaturan belum dapat dimuat"
        }
        description={result.error.message}
        compact
      />
    );
  }

  if (!templates.success) {
    return (
      <PageState
        kind="error"
        title="Library harga belum dapat dimuat"
        description={templates.error.message}
        compact
      />
    );
  }

  return (
    <SettingsDashboard
      initialTab={initialTab}
      overview={result.data}
      pricingTemplates={templates.data}
      administration={administration.success ? administration.data : null}
      readiness={readiness.success ? readiness.data : []}
      onboarding={onboarding.success ? onboarding.data : null}
      initialStock={initialStock.success ? initialStock.data : []}
      openingBatches={openingBatches.success ? openingBatches.data : []}
    />
  );
}
