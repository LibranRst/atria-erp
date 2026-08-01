import type { AppIconName } from "@/components/ui";

export type SettingsTab =
  "overview" | "setup" | "budget" | "categories" | "library" | "materials" | "administration";

export const SETTINGS_TABS: ReadonlyArray<{
  readonly value: SettingsTab;
  readonly label: string;
  readonly shortLabel: string;
  readonly icon: AppIconName;
}> = [
  { value: "overview", label: "Ringkasan", shortLabel: "Ringkasan", icon: "tune" },
  { value: "setup", label: "Kesiapan Setup", shortLabel: "Kesiapan", icon: "fact_check" },
  { value: "budget", label: "Alokasi Budget", shortLabel: "Budget", icon: "trending_up" },
  { value: "categories", label: "Kategori Pengeluaran", shortLabel: "Kategori", icon: "layers" },
  { value: "library", label: "Library Item & Harga", shortLabel: "Library", icon: "inventory" },
  { value: "materials", label: "Material Master", shortLabel: "Material", icon: "inventory_2" },
  { value: "administration", label: "Tim & Vendor", shortLabel: "Tim", icon: "group" },
];

export function parseSettingsTab(value: string | null): SettingsTab {
  if (
    value === "setup" ||
    value === "budget" ||
    value === "categories" ||
    value === "library" ||
    value === "materials" ||
    value === "administration"
  ) {
    return value;
  }
  return "overview";
}

export function settingsTabFromPathname(pathname: string): SettingsTab | null {
  if (pathname === "/settings/budget") return "budget";
  if (pathname === "/settings/setup") return "setup";
  if (pathname === "/settings/categories") return "categories";
  if (pathname === "/settings/library") return "library";
  if (pathname === "/settings/materials") return "materials";
  if (pathname === "/settings/administration") return "administration";
  if (pathname === "/settings") return "overview";
  return null;
}

export function settingsTabUrl(value: SettingsTab): string {
  return value === "overview" ? "/settings" : `/settings?tab=${value}`;
}
