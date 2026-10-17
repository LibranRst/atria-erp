import { redirect } from "next/navigation";

import { PageState } from "@/components/ui";
import { SettingsDashboard } from "@/features/settings/components/navigation/settings-dashboard";
import { getSettingsPageData } from "@/features/settings/server/get-settings-page-data";
import type { SettingsTab } from "@/features/settings/utils/settings-tabs-config";
import type { CatalogSubTab } from "@/features/settings/components/catalog/catalog-settings-manager";

type SettingsPageContentProps = {
  readonly initialTab?: SettingsTab;
  readonly initialFlow?: string;
  readonly initialCatalogSubTab?: CatalogSubTab;
};

export async function SettingsPageContent({
  initialTab = "financial",
  initialFlow,
  initialCatalogSubTab,
}: SettingsPageContentProps): Promise<React.JSX.Element> {
  const data = await getSettingsPageData({ activeTab: initialTab, flow: initialFlow });

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
      initialCatalogSubTab={initialCatalogSubTab}
      overview={data.overview}
      pricingTemplates={data.pricingTemplates}
      administration={data.administration}
      setup={data.setup}
      initialStock={data.initialStock}
      openingBatches={data.openingBatches}
      approvalThresholds={data.approvalThresholds}
      sources={data.sources}
    />
  );
}
