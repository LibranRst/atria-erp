import { SettingsPageContent } from "./settings-page-content";
import { parseSettingsTab } from "@/features/settings/utils/settings-tabs-config";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly tab?: string; readonly flow?: string }>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  return (
    <SettingsPageContent
      initialTab={parseSettingsTab(params.tab ?? null)}
      initialFlow={params.flow}
    />
  );
}
