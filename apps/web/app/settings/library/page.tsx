import { SettingsPageContent } from "../settings-page-content";

export const dynamic = "force-dynamic";

export default async function LibrarySettingsPage(): Promise<React.JSX.Element> {
  return <SettingsPageContent initialTab="catalog" initialCatalogSubTab="library" />;
}
