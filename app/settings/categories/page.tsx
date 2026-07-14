import { SettingsPageContent } from "../settings-page-content";

export default async function CategorySettingsPage(): Promise<React.JSX.Element> {
  return <SettingsPageContent initialTab="categories" />;
}
