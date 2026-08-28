import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import SettingsLoading from "@/app/settings/loading";
import { SettingsFilterBar } from "./settings-filter-bar";
import { SettingsHub } from "../navigation/settings-hub";
import { SettingsNavigation } from "../navigation/settings-navigation";
import {
  parseSettingsTab,
  settingsTabFromPathname,
  settingsTabUrl,
} from "../../utils/settings-tabs-config";

const filterBarPath = new URL("./settings-filter-bar.tsx", import.meta.url);
const materialManagerPath = new URL("../materials/material-settings-manager.tsx", import.meta.url);
const libraryManagerPath = new URL("../library/library-settings-manager.tsx", import.meta.url);

describe("Settings presentation", () => {
  test("keeps query and legacy settings routes compatible", () => {
    expect(parseSettingsTab("materials")).toBe("catalog");
    expect(parseSettingsTab("unknown")).toBe("financial");
    expect(settingsTabFromPathname("/settings/library")).toBe("catalog");
    expect(settingsTabUrl("financial")).toBe("/settings");
    expect(settingsTabUrl("catalog")).toBe("/settings?tab=catalog");
  });

  test("renders a default-project posture and role-aware grouped modules", () => {
    const html = renderToStaticMarkup(
      <SettingsHub
        data={{
          roleName: "OWNER",
          permissions: {
            canManageBudgetSettings: true,
            canManageExpenseCategories: true,
            canManageItemLibrary: true,
            canManageMaterialSettings: true,
            canManageUsers: false,
            canManageVendors: false,
          },
          budgetCapRatio: 0.9,
          categoryAllocationRatio: 0.545,
          unallocatedBufferRatio: 0.455,
          activeCategoryCount: 5,
          activeItemCount: 14,
          activeMaterialCount: 8,
        }}
        onSelectTab={() => undefined}
      />,
    );

    expect(html).toContain("Default proyek baru");
    expect(html).toContain("90%");
    expect(html).toContain("54,5%");
    expect(html).toContain("Dapat dikelola");
    expect(html).toContain("Hanya baca");
    expect(html).toContain("divide-y");
  });

  test("keeps consolidated core modules in navigation", () => {
    const html = renderToStaticMarkup(
      <SettingsNavigation value="financial" onChange={() => undefined} />,
    );
    expect(html).not.toContain("data-sticky");
    expect(html).toContain("Finansial");
    expect(html).toContain("Katalog");
    expect(html).toContain("Organisasi");
    expect(html).toContain('role="tablist"');
  });

  test("renders exclusive search with a structured-filter trigger and count", () => {
    const html = renderToStaticMarkup(
      <SettingsFilterBar
        status="ACTIVE"
        statusOptions={[
          { value: "ACTIVE", label: "Aktif" },
          { value: "INACTIVE", label: "Arsip" },
          { value: "ALL", label: "Semua" },
        ]}
        search=""
        filterCount={2}
        searchPlaceholder="Cari data"
        searchAriaLabel="Cari data pengaturan"
        layoutPrefix="settings-test"
        filterTitle="Filter data"
        onStatusChange={() => undefined}
        onSearchChange={() => undefined}
        onEnterSearch={() => undefined}
        onExitSearch={() => undefined}
        onOpenFilters={() => undefined}
        onApplyFilters={() => undefined}
        onResetFilterDraft={() => undefined}
      >
        <span>Isi filter</span>
      </SettingsFilterBar>,
    );
    expect(html).toContain('data-control-mode="filter"');
    expect(html).toContain("Buka filter data");
    expect(html).toContain(">2<");
  });

  test("keeps secondary filter changes as a local draft until apply", async () => {
    const [bar, materials, library] = await Promise.all([
      Bun.file(filterBarPath).text(),
      Bun.file(materialManagerPath).text(),
      Bun.file(libraryManagerPath).text(),
    ]);

    expect(bar).toContain("onResetFilterDraft");
    expect(bar).toContain("onApplyFilters();");
    expect(bar).toContain("onEnterSearch();");
    expect(bar).toContain("onExitSearch();");
    expect(bar).toContain("<AnchoredFilterPanel");
    expect(bar).not.toContain("<BottomSheet");
    expect(materials).toContain("categoryFilterDraft");
    expect(materials).toContain("setCategoryFilter(categoryFilterDraft)");
    expect(library).toContain("typeDraft");
    expect(library).toContain("setType(typeDraft)");
    expect(materials).toContain("suspendedFiltersRef.current");
    expect(library).toContain("suspendedFiltersRef.current");
  });

  test("uses a route-specific structural skeleton", () => {
    const html = renderToStaticMarkup(<SettingsLoading />);
    expect(html).toContain("Memuat Pengaturan ERP");
    expect(html).toContain("bg-surface-inverse");
    expect(html).toContain("Default finansial dan master data sedang disiapkan");
  });
});
