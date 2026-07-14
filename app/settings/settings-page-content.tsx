import { redirect } from "next/navigation";

import { getPricingTemplates } from "@/app/actions/settings/pricing-library";
import { getSettingsOverview } from "@/app/actions/settings/system";
import { SettingsDashboard } from "@/features/settings/components/settings-dashboard";
import type { SettingsTab } from "@/features/settings/components/settings-tabs-config";

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
    return (
      <p className="rounded-2xl border border-error/30 bg-error-container/10 p-4 text-sm text-error">
        {result.error.message}
      </p>
    );
  }

  if (!templates.success) {
    return (
      <p className="rounded-2xl border border-error/30 bg-error-container/10 p-4 text-sm text-error">
        {templates.error.message}
      </p>
    );
  }

  return (
    <SettingsDashboard
      initialTab={initialTab}
      overview={result.data}
      pricingTemplates={templates.data}
    />
  );
}
