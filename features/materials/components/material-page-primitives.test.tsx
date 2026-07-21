import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import OpeningInventoryLoading from "@/app/materials/opening/loading";
import MaterialsLoading from "@/app/materials/loading";
import type { MaterialOperationsDashboard } from "@/app/actions/material/operations-dashboard";
import {
  MaterialGroupSurface,
  MaterialSectionHeader,
  MaterialStatusLabel,
} from "@/features/materials/components/material-page-primitives";
import { MaterialInventoryTab } from "@/features/materials/components/material-inventory-tab";
import { MaterialLocationStockRow } from "@/features/materials/components/material-detail-sheet";
import { MaterialOverviewTab } from "@/features/materials/components/material-overview-tab";

const dashboard: MaterialOperationsDashboard = {
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
  inventory: [],
  shortages: [
    {
      projectRapItemId: "item-1",
      projectRapId: "rap-1",
      materialId: "material-1",
      materialName: "Multipleks",
      area: "Kitchen",
      requiredQuantity: 10,
      bufferQuantity: 2,
      totalQuantity: 12,
      availableStock: 4,
      needToBuy: 8,
      estimatedTotalCost: 800_000,
      status: "SHORTAGE",
    },
  ],
  movements: [],
  receipts: [],
  counts: [],
  transfers: [],
  projects: [],
  bills: [],
};

describe("Material main surface visual language", () => {
  test("keeps grouped rows and calm status labels in the shared surface grammar", () => {
    const html = renderToStaticMarkup(
      <>
        <MaterialSectionHeader title="Daftar material" meta="8 material" />
        <MaterialGroupSurface>
          <div>Baris inventori</div>
        </MaterialGroupSurface>
        <MaterialStatusLabel label="Menipis" tone="warning" />
      </>,
    );

    expect(html).toContain("Daftar material");
    expect(html).toContain("8 material");
    expect(html).toContain("rounded-[24px]");
    expect(html).toContain("Menipis");
  });

  test("keeps inventory controls inline without a separate control-panel card", () => {
    const html = renderToStaticMarkup(
      <MaterialInventoryTab
        search=""
        location="ALL"
        status="ALL"
        locations={[]}
        visibleMaterials={[]}
        onSearchChange={() => undefined}
        onLocationChange={() => undefined}
        onStatusChange={() => undefined}
        onOpenMaterial={() => undefined}
      />,
    );

    expect(html).toContain('data-material-controls="inline"');
    expect(html).toContain('data-control-mode="filter"');
    expect(html).not.toContain("top-[124px]");
    expect(html).not.toContain("shadow-[0_1px_2px_rgba(17,17,17,0.03),0_12px_30px");
  });

  test("shows average cost and stock value for every inventory location", () => {
    const html = renderToStaticMarkup(
      <MaterialLocationStockRow
        row={{
          inventoryId: "inventory-1",
          materialId: "material-1",
          materialName: "Multipleks 18 mm",
          categoryName: "Kayu",
          specification: "18 mm",
          brand: null,
          code: "MPL-18",
          color: null,
          unit: "lembar",
          locationId: "location-1",
          locationName: "Gudang UAT Utama",
          currentStock: 10,
          reservedStock: 0,
          availableStock: 10,
          minimumStock: 2,
          averageCost: 250_000,
          lastPurchasePrice: 250_000,
          status: "AVAILABLE",
        }}
      />,
    );

    expect(html).toContain("Gudang UAT Utama");
    expect(html).toContain("Tersedia");
    expect(html).toContain("10 lembar");
    expect(html).toContain("Harga pokok rata-rata / lembar");
    expect(html).toContain("Rp 250.000");
    expect(html).toContain("Nilai stok lokasi");
    expect(html).toContain("Rp 2.500.000");
  });

  test("renders stock posture and sourced shortage attention without inventing values", () => {
    const html = renderToStaticMarkup(
      <MaterialOverviewTab
        data={dashboard}
        totalStockValue={1_000_000}
        availableValue={750_000}
        lowCount={0}
        pendingApprovals={0}
        movements={[]}
        onDecision={() => undefined}
        onNavigate={() => undefined}
      />,
    );

    expect(html).toContain("Nilai stok");
    expect(html).toContain("Rp 1.000.000");
    expect(html).toContain("75.0% dapat digunakan");
    expect(html).toContain("Kebutuhan RAP belum terpenuhi");
    expect(html).toContain("1 material perlu ditutup");
  });

  test("uses a route-specific skeleton matching stock posture and grouped rows", () => {
    const html = renderToStaticMarkup(<MaterialsLoading />);

    expect(html).toContain("Memuat Material dan Stok");
    expect(html).toContain("Posisi stok dan aktivitas material sedang disiapkan");
    expect(html).toContain("rounded-[30px]");
    expect(html).not.toContain("spinner");
  });

  test("uses a saldo-awal-stok skeleton matching the grouped setup form", () => {
    const html = renderToStaticMarkup(<OpeningInventoryLoading />);

    expect(html).toContain("Memuat saldo awal stok");
    expect(html).toContain("Form saldo awal dan riwayat pengajuan sedang disiapkan");
    expect(html).toContain("divide-y");
    expect(html).toContain("bg-primary");
  });
});
