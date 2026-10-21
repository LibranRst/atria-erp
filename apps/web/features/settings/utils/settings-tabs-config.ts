import type { AppIconName } from "@/components/ui";

export type SettingsTab = "readiness" | "financial" | "catalog" | "organization";

export const SETTINGS_TABS: ReadonlyArray<{
  readonly value: SettingsTab;
  readonly label: string;
  readonly shortLabel: string;
  readonly icon: AppIconName;
}> = [
  { value: "readiness", label: "Kesiapan Operasional", shortLabel: "Kesiapan", icon: "task_alt" },
  { value: "financial", label: "Finansial & Budget", shortLabel: "Finansial", icon: "trending_up" },
  { value: "catalog", label: "Katalog Master Data", shortLabel: "Katalog", icon: "inventory_2" },
  { value: "organization", label: "Tim, Vendor & Peran", shortLabel: "Organisasi", icon: "group" },
];

export function parseSettingsTab(value: string | null): SettingsTab {
  if (value === "readiness" || value === "setup") return "readiness";
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
  if (pathname === "/settings/readiness" || pathname === "/settings/setup") return "readiness";
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

/** A missing query honors its canonical/legacy route instead of overwriting the SSR tab. */
export function resolveSettingsTab(
  pathname: string,
  query: string | null,
  initial: SettingsTab = "financial",
): SettingsTab {
  return parseSettingsTab(query ?? settingsTabFromPathname(pathname) ?? initial);
}
