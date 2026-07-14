import { SettingsPageContent } from "../settings-page-content";

export default async function MaterialSettingsPage(): Promise<React.JSX.Element> {
  return <SettingsPageContent initialTab="materials" />;
}
