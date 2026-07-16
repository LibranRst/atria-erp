import { redirect } from "next/navigation";

import { getPricingTemplates } from "@/app/actions/settings/pricing-library";
import { getSettingsOverview } from "@/app/actions/settings/system";
import { SettingsDashboard } from "@/features/settings/components/settings-dashboard";
import type { SettingsTab } from "@/features/settings/components/settings-tabs-config";
import { PageState } from "@/components/ui";

type SettingsPageContentProps = {
  readonly initialTab?: SettingsTab;
};

export async function SettingsPageContent({
  initialTab = "overview",
}: SettingsPageContentProps): Promise<React.JSX.Element> {
  const [result, templates] = await Promise.all([
    getSettingsOverview(),
    getPricingTemplates(true),
  ]);

  if (!result.success) {
    if (result.error.code === "UNAUTHORIZED") redirect("/login");
    return <PageState kind={result.error.code === "FORBIDDEN" ? "restricted" : "error"} title={result.error.code === "FORBIDDEN" ? "Akses pengaturan dibatasi" : "Pengaturan belum dapat dimuat"} description={result.error.message} compact />;
  }

  if (!templates.success) {
    return <PageState kind="error" title="Library harga belum dapat dimuat" description={templates.error.message} compact />;
  }

  return (
    <SettingsDashboard
      initialTab={initialTab}
      overview={result.data}
      pricingTemplates={templates.data}
    />
  );
}
