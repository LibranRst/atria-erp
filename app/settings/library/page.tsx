import { SettingsPageContent } from "../settings-page-content";

export default async function LibrarySettingsPage(): Promise<React.JSX.Element> {
  return <SettingsPageContent initialTab="library" />;
}
