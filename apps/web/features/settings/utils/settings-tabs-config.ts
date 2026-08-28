import type { AppIconName } from "@/components/ui";

export type SettingsTab = "financial" | "catalog" | "organization";

export const SETTINGS_TABS: ReadonlyArray<{
  readonly value: SettingsTab;
  readonly label: string;
  readonly shortLabel: string;
  readonly icon: AppIconName;
}> = [
  { value: "financial", label: "Finansial & Budget", shortLabel: "Finansial", icon: "trending_up" },
  { value: "catalog", label: "Katalog Master Data", shortLabel: "Katalog", icon: "inventory_2" },
  { value: "organization", label: "Tim, Vendor & Peran", shortLabel: "Organisasi", icon: "group" },
];

export function parseSettingsTab(value: string | null): SettingsTab {
  if (value === "catalog" || value === "library" || value === "materials") {
    return "catalog";
  }
  if (
    value === "organization" ||
    value === "administration" ||
    value === "team" ||
    value === "vendor"
  ) {
    return "organization";
  }
  return "financial";
}

export function settingsTabFromPathname(pathname: string): SettingsTab | null {
  if (
    pathname === "/settings/catalog" ||
    pathname === "/settings/library" ||
    pathname === "/settings/materials"
  ) {
    return "catalog";
  }
  if (pathname === "/settings/organization" || pathname === "/settings/administration") {
    return "organization";
  }
  if (
    pathname === "/settings/financial" ||
    pathname === "/settings/budget" ||
    pathname === "/settings/categories" ||
    pathname === "/settings"
  ) {
    return "financial";
  }
  return null;
}

export function settingsTabUrl(value: SettingsTab): string {
  return value === "financial" ? "/settings" : `/settings?tab=${value}`;
}
