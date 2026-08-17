import { SettingsPageContent } from "./settings-page-content";

export const dynamic = "force-dynamic";

export default async function SettingsPage(): Promise<React.JSX.Element> {
  return <SettingsPageContent />;
}
