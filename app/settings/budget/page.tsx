import { SettingsPageContent } from "../settings-page-content";

export default async function BudgetSettingsPage(): Promise<React.JSX.Element> {
  return <SettingsPageContent initialTab="budget" />;
}
