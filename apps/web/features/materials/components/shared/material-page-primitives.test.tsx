import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import OpeningInventoryLoading from "@/app/materials/opening/loading";
import MaterialsLoading from "@/app/materials/loading";
import type { MaterialOperationsDashboard } from "@/app/actions/material/operations-dashboard";
import { GroupedSurface, SectionHeader } from "@/components/ui";
import { MaterialStatusLabel } from "@/features/materials/components/shared/material-page-primitives";
import { MaterialActivityTab } from "@/features/materials/components/tabs/material-activity-tab";
import { MaterialInventoryTab } from "@/features/materials/components/tabs/material-inventory-tab";
import { MaterialLocationStockRow } from "@/features/materials/components/sheets/material-detail-sheet";
import { MaterialOverviewTab } from "@/features/materials/components/tabs/material-overview-tab";

const overviewPath = new URL("../tabs/material-overview-tab.tsx", import.meta.url);

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
  movementsHasMore: false,
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
        <SectionHeader title="Daftar material" count={8} countLabel="Material" />
        <GroupedSurface>
          <div>Baris inventori</div>
        </GroupedSurface>
        <MaterialStatusLabel label="Menipis" tone="warning" />
      </>,
    );

    expect(html).toContain("Daftar material");
    expect(html).toContain('aria-label="8 material"');
    expect(html).toContain(">Material</span>");
    expect(html).toContain("min-h-8");
    expect(html).toContain("rounded-owner");
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
    expect(html).not.toContain("shadow-floating");
  });

  test("only offers older activity when the server confirms another page exists", () => {
    const renderActivity = (movementsHasMore: boolean): string =>
      renderToStaticMarkup(
        <MaterialActivityTab
          activityType="ALL"
          activityPeriod="ALL"
          activityProject="ALL"
          activityLocation="ALL"
          movementTypes={[]}
          activityProjectOptions={[{ value: "ALL", label: "Semua project" }]}
          activityLocationOptions={[{ value: "ALL", label: "Semua lokasi" }]}
          visibleReceipts={[]}
          visibleMovements={[]}
          movementsHasMore={movementsHasMore}
          transfers={[]}
          counts={[]}
          pending={false}
          onActivityTypeChange={() => undefined}
          onActivityPeriodChange={() => undefined}
          onActivityProjectChange={() => undefined}
          onActivityLocationChange={() => undefined}
          onOpenReceipt={() => undefined}
          onLoadMore={() => undefined}
        />,
      );

    expect(renderActivity(true)).toContain("Muat aktivitas sebelumnya");
    expect(renderActivity(false)).not.toContain("Muat aktivitas sebelumnya");
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

  test("makes pending stock decisions openable as contextual detail cards", () => {
    const html = renderToStaticMarkup(
      <MaterialOverviewTab
        data={{
          ...dashboard,
          counts: [
            {
              id: "count-1",
              countNumber: "SO/2026/001",
              status: "PENDING_APPROVAL",
              canEdit: false,
              locationId: "location-1",
              locationName: "Gudang Utama",
              countedAt: new Date("2026-07-27T08:00:00.000Z"),
              createdByName: "Tim Gudang",
              note: "Hasil hitung fisik",
              items: [
                {
                  materialId: "material-1",
                  materialName: "Multipleks",
                  systemQuantity: 10,
                  countedQuantity: 8,
                  varianceQuantity: -2,
                },
              ],
            },
          ],
          receipts: [
            {
              id: "receipt-1",
              receiptNumber: "GR/2026/001",
              status: "REVERSAL_REQUESTED",
              projectId: "project-1",
              projectName: "Project A",
              locationId: "location-1",
              locationName: "Gudang Utama",
              vendorBillNumber: null,
              receivedAt: new Date("2026-07-27T07:00:00.000Z"),
              receivedByName: "Tim Gudang",
              reversalReason: "Barang penerimaan tidak sesuai",
              total: 500_000,
              items: [{ materialName: "Multipleks", quantity: 2, unitCost: 250_000 }],
            },
          ],
        }}
        totalStockValue={1_000_000}
        availableValue={750_000}
        lowCount={0}
        pendingApprovals={2}
        movements={[]}
        onDecision={() => undefined}
        onNavigate={() => undefined}
      />,
    );

    expect(html).toContain("Perlu keputusan");
    expect(html).toContain("Lihat detail keputusan stock opname SO/2026/001");
    expect(html).toContain("Lihat detail keputusan pembatalan GR/2026/001");
    expect(html).toContain("bg-surface-container-lowest");
    expect(html).not.toContain("bg-error-container/20");
  });

  test("waits for the detail sheet to exit before opening decision confirmation", async () => {
    const source = await Bun.file(overviewPath).text();

    expect(source).toContain("decisionAfterCloseRef.current = decision");
    expect(source).toContain("onExitComplete={finishDetailExit}");
    expect(source).toContain("if (nextDecision) onDecision(nextDecision)");
    expect(source).toContain('label: "Tolak"');
    expect(source).toContain('label: "Setujui"');
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
