import type { PermissionKey } from "@atria/core/auth/permissions";
import { resolveStockMovementDirection } from "@atria/core/material/stock-movement-direction";
import type { MaterialInventoryRow, MaterialShortageRow } from "@/app/actions/material/inventory";
import type {
  CountView,
  MaterialMovementView,
  MaterialOperationsDashboard,
  ReceiptView,
  TransferView,
} from "@/app/actions/material/operations-dashboard";

export type MaterialsFixtureScenario =
  | "complete"
  | "empty"
  | "read-only"
  | "assigned"
  | "partial-error"
  | "restricted"
  | "activity-error"
  | "pending";
export const MATERIALS_FIXTURE_REFERENCE = "2026-10-15T05:30:00.000Z";
export function materialsFixtureId(value: number): string {
  return `77000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;
}
const locations = [
  { id: materialsFixtureId(9000), name: "Gudang Cilandak" },
  { id: materialsFixtureId(9001), name: "Workshop Bintaro" },
  { id: materialsFixtureId(9002), name: "Site Menteng" },
];
const catalog = [
  { name: "Multipleks meranti 18 mm", category: "Kayu & panel", unit: "lembar", cost: 324500.25 },
  {
    name: "HPL oak natural — tekstur matte",
    category: "Finishing",
    unit: "lembar",
    cost: 185750.5,
  },
  { name: "Cat interior putih satin", category: "Cat & pelapis", unit: "liter", cost: 98750.25 },
  { name: "Profil aluminium hitam 30 × 30", category: "Logam", unit: "meter", cost: 74250.5 },
  { name: "Engsel soft close 110°", category: "Hardware", unit: "buah", cost: 46500.25 },
  { name: "Lem kontak serbaguna", category: "Perekat", unit: "kg", cost: 68750.5 },
];

function inventoryRows(): MaterialInventoryRow[] {
  return Array.from({ length: 34 }, (_, index): MaterialInventoryRow[] => {
    const item = catalog[index % catalog.length];
    const quantity = index % 7 === 0 ? 0 : index % 5 === 0 ? 2.5 : 24.5 + index;
    const reserved = index % 6 === 0 ? quantity : index % 3 === 0 ? 7.25 : 0;
    return Array.from(
      { length: index % 4 === 0 ? 2 : 1 },
      (_, locationIndex): MaterialInventoryRow => {
        const currentStock = locationIndex === 1 ? 14.75 : quantity;
        const reservedStock = Math.min(currentStock, locationIndex === 1 ? 2.5 : reserved);
        const availableStock = currentStock - reservedStock;
        return {
          inventoryId: materialsFixtureId(1000 + index * 3 + locationIndex),
          materialId: materialsFixtureId(100 + index),
          materialName: `${item.name}${index >= catalog.length ? ` · varian ${index + 1}` : ""}`,
          categoryName: item.category,
          specification:
            index % 2 === 0
              ? "Kualitas A, simpan pada area kering"
              : "Sesuai sampel material yang disetujui",
          brand: index % 2 === 0 ? "Dekoria Supply" : null,
          code: `MAT-${String(index + 1).padStart(3, "0")}`,
          color: index % 2 === 0 ? "Natural" : null,
          unit: item.unit,
          locationId: locations[(index + locationIndex) % locations.length].id,
          locationName: locations[(index + locationIndex) % locations.length].name,
          currentStock,
          reservedStock,
          availableStock,
          minimumStock: 8.5,
          averageCost: item.cost,
          lastPurchasePrice: item.cost + 1250,
          status:
            currentStock === 0
              ? "OUT_OF_STOCK"
              : availableStock === 0
                ? "RESERVED"
                : availableStock < 8.5
                  ? "LOW_STOCK"
                  : "AVAILABLE",
        };
      },
    );
  }).flat();
}

const inventory = inventoryRows();
const projects: MaterialOperationsDashboard["projects"] = Array.from({ length: 4 }, (_, index) => ({
  id: materialsFixtureId(8000 + index),
  name: [
    "Menteng Villa · Kitchen & Living",
    "Cipete House · Fit-out",
    "Bintaro Office · Lantai 2",
    "Kemang Residence · Interior",
  ][index],
  rapItems: Array.from({ length: 9 }, (_, itemIndex) => {
    const item =
      inventory.find((row) => row.materialId === materialsFixtureId(100 + index * 6 + itemIndex)) ??
      inventory[0];
    return {
      id: materialsFixtureId(6000 + index * 10 + itemIndex),
      materialId: itemIndex === 8 ? null : item.materialId,
      name: itemIndex === 8 ? "Solid surface custom countertop" : item.materialName,
      area: ["Kitchen", "Living room", "Kamar utama"][itemIndex % 3],
      unit: itemIndex === 8 ? "m²" : item.unit,
      quantity: 18.75 + itemIndex,
      unitCost: item.averageCost,
    };
  }),
}));
const shortages: MaterialShortageRow[] = projects.flatMap((project, projectIndex) =>
  project.rapItems.map((item, itemIndex) => {
    const total = Number(item.quantity ?? 0) + 1.25;
    const need = itemIndex % 3 === 0 ? 0 : itemIndex % 2 === 0 ? 4.5 : 12.25;
    return {
      projectRapItemId: item.id,
      projectRapId: materialsFixtureId(7000 + projectIndex),
      materialId: item.materialId,
      materialName: item.name,
      area: item.area,
      requiredQuantity: Number(item.quantity ?? 0),
      bufferQuantity: 1.25,
      totalQuantity: total,
      availableStock: Math.max(0, total - need),
      needToBuy: need,
      estimatedTotalCost: total * Number(item.unitCost ?? 0),
      status: itemIndex === 8 ? "DRAFT" : need > 0 ? "SHORTAGE" : "READY",
    };
  }),
);

export function materialsFixtureMovements(): MaterialMovementView[] {
  return Array.from({ length: 67 }, (_, index) => {
    const item = inventory[index % inventory.length];
    const project = projects[index % projects.length];
    const movementType = [
      "GOODS_RECEIPT",
      "RESERVE",
      "USE",
      "RETURN",
      "TRANSFER_OUT",
      "WASTE",
      "ADJUSTMENT",
    ][index % 7];
    return {
      id: materialsFixtureId(2000 + index),
      movementType,
      movementDirection:
        movementType === "ADJUSTMENT" ? "IN" : resolveStockMovementDirection(movementType),
      quantity: index % 3 === 0 ? 1.25 : 4.5 + index,
      unitCost: item.averageCost,
      note: index % 4 === 0 ? "Material sesuai bukti penerimaan dan pemeriksaan lokasi." : null,
      createdAt: new Date(Date.parse(MATERIALS_FIXTURE_REFERENCE) - index * 21600000),
      materialId: item.materialId,
      materialName: item.materialName,
      unit: item.unit,
      locationId: item.locationId,
      locationName: item.locationName,
      projectId: index % 5 === 0 ? null : project.id,
      projectName: index % 5 === 0 ? null : project.name,
      createdByName: ["Karin Putri", "Agus Pratama", "Budi Santoso"][index % 3],
    };
  });
}

export function materialsFixtureReceipts(): ReceiptView[] {
  return Array.from({ length: 54 }, (_, index) => {
    const item = inventory[index % inventory.length];
    const project = projects[index % projects.length];
    return {
      id: materialsFixtureId(3000 + index),
      receiptNumber: `GR-2026-${String(index + 1).padStart(4, "0")}`,
      status: index === 0 ? "REVERSAL_REQUESTED" : index === 7 ? "REVERSED" : "POSTED",
      projectId: project.id,
      projectName: project.name,
      locationId: item.locationId,
      locationName: item.locationName,
      vendorBillNumber: index % 4 === 0 ? null : `INV-OCT-${index + 1}`,
      receivedAt: new Date(Date.parse(MATERIALS_FIXTURE_REFERENCE) - index * 86400000),
      receivedByName: "Agus Pratama",
      reversalReason:
        index === 0 || index === 7
          ? "Penerimaan ganda ditemukan pada pemeriksaan bukti fisik."
          : null,
      total: 2.5 * item.averageCost,
      items: [
        {
          materialName: item.materialName,
          quantity: 2.5,
          unitCost: item.averageCost,
          unit: item.unit,
        },
      ],
    };
  });
}
export function materialsFixtureCounts(): CountView[] {
  return Array.from({ length: 53 }, (_, index) => {
    const item = inventory[index % inventory.length];
    return {
      id: materialsFixtureId(4000 + index),
      countNumber: `SO-2026-${String(index + 1).padStart(4, "0")}`,
      status:
        index < 2
          ? "PENDING_APPROVAL"
          : index === 2 || index === 52
            ? "DRAFT"
            : index === 4
              ? "REJECTED"
              : "POSTED",
      canEdit: index === 2 || index === 52,
      locationId: item.locationId,
      locationName: item.locationName,
      countedAt: new Date(Date.parse(MATERIALS_FIXTURE_REFERENCE) - index * 86400000),
      createdByName: index < 2 ? "Agus Pratama" : "Karin Putri",
      note: "Hitung fisik mingguan; selisih diperiksa bersama penanggung jawab gudang.",
      items: [
        {
          materialId: item.materialId,
          materialName: item.materialName,
          systemQuantity: 12.5,
          countedQuantity: 11.25,
          varianceQuantity: -1.25,
          unit: item.unit,
        },
      ],
    };
  });
}
export function materialsFixtureTransfers(): TransferView[] {
  return Array.from({ length: 52 }, (_, index) => {
    const item = inventory[index % inventory.length];
    return {
      id: materialsFixtureId(5000 + index),
      transferNumber: `TRF-2026-${String(index + 1).padStart(4, "0")}`,
      fromLocationName: locations[index % locations.length].name,
      toLocationName: locations[(index + 1) % locations.length].name,
      transferredAt: new Date(Date.parse(MATERIALS_FIXTURE_REFERENCE) - index * 86400000),
      note: "Material dipindahkan untuk pekerjaan area kitchen.",
      items: [
        {
          materialName: item.materialName,
          quantity: 6.75,
          unitCost: item.averageCost,
          unit: item.unit,
        },
      ],
    };
  });
}

export function materialsFixturePermissions(
  scenario: MaterialsFixtureScenario,
): readonly PermissionKey[] {
  const read: readonly PermissionKey[] = [
    "view:material",
    "view:inventory",
    "view:rap",
    "view:project",
  ];
  if (scenario === "read-only" || scenario === "assigned") return read;
  if (scenario === "restricted") return ["view:material", "view:inventory"];
  return [
    ...read,
    "create:stock_movement",
    "manage:material_settings",
    "reserve:stock",
    "use:stock",
    "waste:stock",
    "adjust:stock",
    "transfer:stock",
    "create:stock_count",
    "approve:stock_count",
    "request:goods_receipt_reversal",
    "approve:goods_receipt_reversal",
    "override:self_approval",
  ];
}

export function materialsFixtureData(
  scenario: MaterialsFixtureScenario = "complete",
): MaterialOperationsDashboard {
  const empty = scenario === "empty";
  const limited = scenario === "read-only" || scenario === "assigned";
  const visibleProjects = scenario === "assigned" ? projects.slice(0, 1) : projects;
  return {
    roleName: limited ? "Inventory Reader" : "OWNER",
    capabilities: {
      canReceive: !limited,
      canOperate: !limited,
      canTransfer: !limited,
      canCount: !limited,
      canApproveCount: !limited,
      canRequestReversal: !limited,
      canApproveReversal: !limited,
      canEmergencyAdjust: !limited,
    },
    inventory: empty ? [] : inventory,
    locations,
    shortages:
      empty || scenario === "partial-error" || scenario === "restricted"
        ? []
        : shortages.filter((row) =>
            visibleProjects.some((project) =>
              project.rapItems.some((item) => item.id === row.projectRapItemId),
            ),
          ),
    shortagesSource: {
      status:
        scenario === "partial-error"
          ? "unavailable"
          : scenario === "restricted"
            ? "restricted"
            : "ready",
      message:
        scenario === "partial-error"
          ? "Kebutuhan RAP belum dapat dimuat. Stok tetap dapat diperiksa."
          : scenario === "restricted"
            ? "Peran Anda dapat membaca stok; kebutuhan RAP memerlukan izin tambahan."
            : undefined,
    },
    activitySummary: empty
      ? {
          movements: 0,
          receipts: 0,
          transfers: 0,
          counts: 0,
          pendingCounts: 0,
          pendingReversals: 0,
        }
      : {
          movements: 67,
          receipts: 54,
          transfers: 52,
          counts: 53,
          pendingCounts: 2,
          pendingReversals: 1,
        },
    movements: empty ? [] : materialsFixtureMovements().slice(0, 50),
    movementsHasMore: !empty,
    receipts: empty ? [] : materialsFixtureReceipts().slice(0, 20),
    counts: empty ? [] : materialsFixtureCounts().slice(0, 30),
    transfers: empty ? [] : materialsFixtureTransfers().slice(0, 20),
    projects: empty ? [] : [...visibleProjects],
    bills: empty
      ? []
      : [
          {
            id: materialsFixtureId(9500),
            projectId: projects[0].id,
            projectName: projects[0].name,
            vendorName: "CV Dekoria Supply",
            name: "INV-OCT-015",
            amount: 811250.63,
            status: "UNPAID",
            notes: "Multipleks untuk kabinet kitchen",
            materialId: inventory[0].materialId,
            projectRapItemId: projects[0].rapItems[0].id,
            rapItemQuantity: 2.5,
            rapItemUnitCost: inventory[0].averageCost,
            remainingQuantity: 2.5,
            remainingAmount: 811250.63,
          },
        ],
  };
}
