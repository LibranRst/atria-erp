"use client";

import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";

export function SettingsShell({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  return (
    <div className={`mx-auto w-full min-w-0 ${desktop ? "max-w-none" : "max-w-md"}`}>
      {children}
    </div>
  );
}
