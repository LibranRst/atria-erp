"use client";

import React from "react";

import { AppIcon, SegmentedTabs } from "@/components/ui";
import { SETTINGS_TABS, type SettingsTab } from "../../utils/settings-tabs-config";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";

export function SettingsNavigation({
  value,
  onChange,
  showAdministration = true,
}: {
  readonly value: SettingsTab;
  readonly onChange: (value: SettingsTab) => void;
  readonly showAdministration?: boolean;
}): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  return (
    <SegmentedTabs
      value={value}
      onChange={onChange}
      ariaLabel="Bagian Pengaturan"
      layoutId="settings-main-tabs"
      density="compact"
      scrollable
      options={SETTINGS_TABS.filter(
        (module) => module.value !== "organization" || showAdministration,
      ).map((module) => ({
        value: module.value,
        label: desktop ? module.label : module.shortLabel,
        icon: <AppIcon name={module.icon} className="icon-sm" aria-hidden="true" />,
      }))}
    />
  );
}
