"use client";

import React from "react";

import { AppIcon, SegmentedTabs } from "@/components/ui";
import { SETTINGS_TABS, type SettingsTab } from "../../utils/settings-tabs-config";

export function SettingsNavigation({
  value,
  onChange,
  showAdministration = true,
}: {
  readonly value: SettingsTab;
  readonly onChange: (value: SettingsTab) => void;
  readonly showAdministration?: boolean;
}): React.JSX.Element {
  return (
    <SegmentedTabs
      value={value}
      onChange={onChange}
      ariaLabel="Modul Pengaturan ERP"
      layoutId="settings-main-tabs"
      density="compact"
      scrollable
      options={SETTINGS_TABS.filter(
        (module) => module.value !== "organization" || showAdministration,
      ).map((module) => ({
        value: module.value,
        label: module.shortLabel,
        icon: <AppIcon name={module.icon} className="h-3.75 w-3.75" aria-hidden="true" />,
      }))}
    />
  );
}
