import {
  Boxes,
  ChartNoAxesCombined,
  Layers3,
  PackageSearch,
  Settings2,
} from "lucide-react";

export type SettingsTab = "overview" | "budget" | "categories" | "library" | "materials";

export const SETTINGS_TABS: ReadonlyArray<{
  readonly value: SettingsTab;
  readonly label: string;
  readonly icon: typeof Settings2;
}> = [
  { value: "overview", label: "Ringkasan", icon: Settings2 },
  { value: "budget", label: "Alokasi Budget", icon: ChartNoAxesCombined },
  { value: "categories", label: "Kategori Pengeluaran", icon: Layers3 },
  { value: "library", label: "Library Item & Harga", icon: PackageSearch },
  { value: "materials", label: "Material Master", icon: Boxes },
];

export function parseSettingsTab(value: string | null): SettingsTab {
  if (
    value === "budget" ||
    value === "categories" ||
    value === "library" ||
    value === "materials"
  ) {
    return value;
  }
  return "overview";
}

export function settingsTabFromPathname(pathname: string): SettingsTab | null {
  if (pathname === "/settings/budget") return "budget";
  if (pathname === "/settings/categories") return "categories";
  if (pathname === "/settings/library") return "library";
  if (pathname === "/settings/materials") return "materials";
  if (pathname === "/settings") return "overview";
  return null;
}

export function settingsTabUrl(value: SettingsTab): string {
  return value === "overview" ? "/settings" : `/settings?tab=${value}`;
}
