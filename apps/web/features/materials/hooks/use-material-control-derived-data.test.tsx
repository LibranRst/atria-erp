import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { MaterialOperationsDashboard } from "@/app/actions/material/operations-dashboard";
import { MaterialInventoryTab } from "@/features/materials/components/tabs/material-inventory-tab";
import { useMaterialControlDerivedData } from "./use-material-control-derived-data";

type Derived = ReturnType<typeof useMaterialControlDerivedData>;

function dashboard(): MaterialOperationsDashboard {
  return {
    roleName: "OWNER",
    capabilities: {
      canReceive: true,
      canOperate: true,
      canTransfer: true,
      canCount: true,
      canApproveCount: true,
      canRequestReversal: true,
      canApproveReversal: true,
      canEmergencyAdjust: true,
    },
    locations: [{ id: "utama", name: "Gudang UTAMA" }],
    inventory: [],
    shortages: [],
    movements: [],
    movementsHasMore: false,
    receipts: [],
    counts: [],
    transfers: [],
    projects: [],
    bills: [],
  };
}

function inventoryRow(
  locationId: string,
  locationName: string,
): MaterialOperationsDashboard["inventory"][number] {
  return {
    inventoryId: `inventory-${locationId}`,
    materialId: `material-${locationId}`,
    materialName: `Material ${locationName}`,
    categoryName: "Kayu",
    specification: null,
    brand: null,
    code: null,
    color: null,
    unit: "lembar",
    locationId,
    locationName,
    currentStock: 0,
    reservedStock: 0,
    availableStock: 0,
    minimumStock: 0,
    averageCost: 0,
    lastPurchasePrice: 0,
    status: "OUT_OF_STOCK",
  };
}

function Probe({
  data,
  location,
  search,
  status,
  capture,
}: {
  readonly data: MaterialOperationsDashboard;
  readonly location: string;
  readonly search: string;
  readonly status: string;
  readonly capture: (result: Derived) => void;
}): React.JSX.Element {
  const derived = useMaterialControlDerivedData({
    data,
    movements: data.movements,
    filters: {
      search,
      location,
      status,
      activityType: "ALL",
      activityProject: "ALL",
      activityLocation: "ALL",
      activityPeriod: "ALL",
    },
    activityNow: 0,
    projectId: "",
    rapItemId: "",
  });
  capture(derived);
  return (
    <MaterialInventoryTab
      search={search}
      location={location}
      status={status}
      locations={derived.inventoryLocations}
      visibleMaterials={derived.visibleMaterials}
      onSearchChange={(): void => undefined}
      onLocationChange={(): void => undefined}
      onStatusChange={(): void => undefined}
      onOpenMaterial={(): void => undefined}
    />
  );
}

function renderInventory(
  data: MaterialOperationsDashboard,
  location = "ALL",
  search = "",
  status = "ALL",
): { readonly html: string; readonly derived: Derived } {
  const captured: { result?: Derived } = {};
  const html = renderToStaticMarkup(
    <Probe
      data={data}
      location={location}
      search={search}
      status={status}
      capture={(result: Derived): void => {
        captured.result = result;
      }}
    />,
  );
  if (!captured.result) throw new Error("Inventory probe did not render");
  return { html, derived: captured.result };
}

describe("configured warehouse inventory filters", (): void => {
  test("shows a configured warehouse before its first material", (): void => {
    const result = renderInventory(dashboard());
    expect(result.derived.inventoryLocations).toEqual([{ id: "utama", name: "Gudang UTAMA" }]);
    expect(result.html).toContain('aria-label="Filter lokasi stok"');
    expect(result.html).toContain("Gudang UTAMA");
    expect(result.html).toContain("Belum ada inventori");
    expect(result.html).not.toContain("Material tidak ditemukan");
  });

  test("filters an empty configured warehouse beside an inventory-backed warehouse", (): void => {
    const data = dashboard();
    data.inventory.push(inventoryRow("workshop", "Workshop"));
    const all = renderInventory(data);
    const empty = renderInventory(data, "utama");
    const workshop = renderInventory(data, "workshop");
    expect(all.derived.inventoryLocations.map((row) => row.id)).toEqual(["workshop", "utama"]);
    expect(all.derived.visibleMaterials).toHaveLength(1);
    expect(empty.derived.visibleMaterials).toHaveLength(0);
    expect(empty.html).toContain("Belum ada inventori di lokasi ini");
    expect(workshop.derived.visibleMaterials).toHaveLength(1);
    expect(workshop.html).not.toContain("Belum ada inventori");
  });

  test("deduplicates IDs and uses the configured warehouse name", (): void => {
    const data = dashboard();
    data.inventory.push(inventoryRow("utama", "Nama lama"));
    const result = renderInventory(data);
    expect(result.derived.inventoryLocations).toEqual([{ id: "utama", name: "Gudang UTAMA" }]);
    expect(result.derived.locations).toEqual([{ id: "utama", name: "Nama lama" }]);
  });

  test("preserves inventory-backed read filters and operational selectors", (): void => {
    const data = dashboard();
    data.inventory.push(inventoryRow("arsip", "Gudang Lama"));
    const result = renderInventory(data, "arsip");
    expect(result.derived.inventoryLocations.map((row) => row.id)).toEqual(["arsip", "utama"]);
    expect(result.derived.visibleMaterials).toHaveLength(1);
    expect(result.derived.locationOptions).toEqual([{ value: "arsip", label: "Gudang Lama" }]);
    expect(result.derived.activityLocationOptions).toEqual([
      { value: "ALL", label: "Semua lokasi" },
      { value: "arsip", label: "Gudang Lama" },
    ]);
  });

  test("keeps older API responses usable during rollout", (): void => {
    const data = dashboard();
    data.inventory.push(inventoryRow("workshop", "Workshop"));
    Reflect.deleteProperty(data, "locations");
    expect(renderInventory(data).derived.inventoryLocations).toEqual([
      { id: "workshop", name: "Workshop" },
    ]);
  });

  test("distinguishes unmatched searches and status filters from first setup", (): void => {
    expect(renderInventory(dashboard(), "utama", "semen").html).toContain(
      "Material tidak ditemukan",
    );
    expect(renderInventory(dashboard(), "ALL", "", "LOW_STOCK").html).toContain(
      "Material tidak ditemukan",
    );
  });
});
