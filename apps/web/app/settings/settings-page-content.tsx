import { redirect } from "next/navigation";

import { PageState } from "@/components/ui";
import { SettingsDashboard } from "@/features/settings/components/navigation/settings-dashboard";
import { getSettingsPageData } from "@/features/settings/server/get-settings-page-data";
import type { SettingsTab } from "@/features/settings/utils/settings-tabs-config";

type SettingsPageContentProps = {
  readonly initialTab?: SettingsTab;
};

export async function SettingsPageContent({
  initialTab = "financial",
}: SettingsPageContentProps): Promise<React.JSX.Element> {
  const data = await getSettingsPageData();

  if (data.status !== "ready") {
    if (data.status === "unauthorized") redirect("/login");
    const isRestricted = data.status === "restricted";
    return (
      <PageState
        kind={isRestricted ? "restricted" : "error"}
        title={
          isRestricted
            ? "Akses pengaturan dibatasi"
            : data.source === "library"
              ? "Library harga belum dapat dimuat"
              : "Pengaturan belum dapat dimuat"
        }
        description={data.message}
        compact
      />
    );
  }

  return (
    <SettingsDashboard
      initialTab={initialTab}
      overview={data.overview}
      pricingTemplates={data.pricingTemplates}
      administration={data.administration}
      readiness={data.readiness}
      onboarding={data.onboarding}
      initialStock={data.initialStock}
      openingBatches={data.openingBatches}
      approvalThresholds={data.approvalThresholds}
    />
  );
}
