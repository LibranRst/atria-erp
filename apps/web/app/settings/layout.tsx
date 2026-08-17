import { SettingsShell } from "@/features/settings/components/navigation/settings-shell";

export default function SettingsLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return <SettingsShell>{children}</SettingsShell>;
}
