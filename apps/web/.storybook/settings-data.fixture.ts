import type { AdministrationOverview } from "@/app/actions/administration";
import type { PricingTemplateRow } from "@/app/actions/settings/pricing-library";
import type {
  SettingsOverview,
  ExpenseCategorySettingRow,
  ItemPriceLibraryRow,
  MaterialSettingRow,
} from "@/app/actions/settings/system";
import type { ManagedRole } from "@/server/usecases/administration/roles";
import type {
  InitialStockCandidate,
  InventoryOpeningBatchView,
} from "@/app/actions/material/opening-inventory";
import { ROLE_PERMISSIONS, type PermissionKey } from "@atria/core/auth/permissions";
import {
  createDefaultOwnerQuickStartState,
  getQuickStartProgress,
  type OrganizationSetupOverview,
  type OperationalReadinessItem,
} from "@atria/core/onboarding/organization-setup";

export type SettingsFixtureScenario =
  | "complete"
  | "empty"
  | "read-only"
  | "readiness-pending"
  | "roles-error"
  | "roles-loading"
  | "roles-only";
export const fixtureId = (value: number): string =>
  `00000000-0000-0000-0000-${String(value).padStart(12, "0")}`;
const fixtureDate = new Date("2026-10-14T02:00:00.000Z");
export const SETTINGS_FIXTURE_PERMISSIONS: readonly PermissionKey[] = ROLE_PERMISSIONS.OWNER ?? [];
export const SETTINGS_FIXTURE_READ_PERMISSIONS: readonly PermissionKey[] = [
  "view:settings",
  "view:material",
  "view:inventory",
];
export const SETTINGS_FIXTURE_ROLE_PERMISSIONS: readonly PermissionKey[] = [
  "view:settings",
  "manage:roles",
];
export const SETTINGS_FIXTURE_CATEGORIES: readonly ExpenseCategorySettingRow[] = [
  {
    id: fixtureId(101),
    code: "MATERIAL",
    name: "Material",
    description: "Bahan, finishing dan perlengkapan instalasi.",
    defaultRatio: 0.4,
    sortOrder: 1,
    isActive: true,
    isCore: true,
  },
  {
    id: fixtureId(102),
    code: "TUKANG",
    name: "Tukang",
    description: "Tenaga kerja untuk pelaksanaan di lapangan.",
    defaultRatio: 0.2,
    sortOrder: 2,
    isActive: true,
    isCore: true,
  },
  {
    id: fixtureId(103),
    code: "OPERASIONAL",
    name: "Operasional",
    description: "Transportasi, pengiriman dan kebutuhan kerja harian.",
    defaultRatio: 0.1,
    sortOrder: 3,
    isActive: true,
    isCore: true,
  },
  {
    id: fixtureId(104),
    code: "LAIN_LAIN",
    name: "Lain-lain",
    description: "Biaya proyek di luar kategori utama.",
    defaultRatio: 0.05,
    sortOrder: 4,
    isActive: true,
    isCore: true,
  },
  {
    id: fixtureId(105),
    code: "SUBCON",
    name: "Subcon",
    description: "Pekerjaan vendor spesialis dan subkontraktor.",
    defaultRatio: 0.15,
    sortOrder: 5,
    isActive: true,
    isCore: true,
  },
];
const locations = [
  { id: fixtureId(201), name: "Gudang pusat" },
  { id: fixtureId(202), name: "Workshop produksi" },
  { id: fixtureId(203), name: "Gudang finishing" },
];
const materialCategories = [
  { id: fixtureId(301), name: "Panel dan kayu" },
  { id: fixtureId(302), name: "Finishing" },
  { id: fixtureId(303), name: "Hardware" },
];
const materialNames = [
  "Multipleks 18 mm",
  "HPL finishing natural",
  "Engsel soft close",
  "Cat dinding interior",
  "Lem kuning",
  "Rel laci tandem",
  "Veneer kayu oak",
  "List aluminium",
  "Sekrup kabinet",
];
export const SETTINGS_FIXTURE_ROLES: readonly ManagedRole[] = Array.from(
  { length: 12 },
  (_, index): ManagedRole => ({
    id: fixtureId(index + 1),
    name:
      ["OWNER", "FINANCE_ADMIN", "PROJECT_MANAGER", "PURCHASING"][index] ??
      `Pengawas proyek ${index - 3}`,
    description:
      index === 0
        ? "Pemilik dengan akses keputusan dan pengaturan perusahaan."
        : index < 4
          ? "Peran sistem untuk alur operasional Atria."
          : "Peran contoh dengan akses proyek yang ditugaskan.",
    dataScope: index < 2 ? "GLOBAL" : index === 3 ? "NONE" : "ASSIGNED",
    isSystem: index < 4,
    isOwnerRole: index === 0,
    userCount: index === 0 ? 1 : index + 1,
    permissions:
      index === 0
        ? SETTINGS_FIXTURE_PERMISSIONS
        : index === 1
          ? (ROLE_PERMISSIONS.FINANCE_ADMIN ?? [])
          : index === 3
            ? (ROLE_PERMISSIONS.PURCHASING ?? [])
            : ["view:project", "view:cost", "create:cost"],
  }),
);
export const SETTINGS_FIXTURE_ADMINISTRATION: AdministrationOverview = {
  capabilities: {
    canViewUsers: true,
    canManageUsers: true,
    canViewVendors: true,
    canManageVendors: true,
    canManageRoles: true,
  },
  roles: SETTINGS_FIXTURE_ROLES.map(({ id, name }) => ({ id, name })),
  users: Array.from({ length: 27 }, (_, index) => {
    const role = SETTINGS_FIXTURE_ROLES[index % SETTINGS_FIXTURE_ROLES.length];
    return {
      id: fixtureId(1000 + index),
      name:
        [
          "Karin Putri",
          "Budi Santoso",
          "Agus Pratama",
          "Dewi Ananda",
          "Raka Wijaya",
          "Sinta Maharani",
          "Dimas Saputra",
          "Nadia Laras",
          "Arif Nugraha",
        ][index % 9] + (index < 9 ? "" : ` ${Math.floor(index / 9) + 1}`),
      email: `staf${index + 1}@fixture.atria.invalid`,
      roleId: role?.id ?? fixtureId(3),
      roleName: role?.name ?? "PROJECT_MANAGER",
      isActive: index % 7 !== 6,
      mustChangePassword: index % 5 === 3,
    };
  }),
  vendors: Array.from({ length: 27 }, (_, index) => ({
    id: fixtureId(2000 + index),
    tenantId: fixtureId(99),
    name:
      [
        "CV Panel Nusantara",
        "PT Finishing Prima",
        "CV Hardware Karya",
        "UD Sumber Kayu",
        "CV Interior Jaya",
        "PT Cahaya Material",
        "CV Batu Kreasi",
        "UD Mitra Workshop",
        "CV Konstruksi Mandiri",
      ][index % 9] + (index < 9 ? "" : ` ${Math.floor(index / 9) + 1}`),
    email: `vendor${index + 1}@fixture.atria.invalid`,
    phone: `0812000${String(index + 1).padStart(5, "0")}`,
    address: "Alamat contoh untuk verifikasi tampilan",
    bankName: index % 3 === 0 ? "BCA" : "Mandiri",
    bankAccountNumber: `000${String(index + 1).padStart(7, "0")}`,
    bankAccountHolder: "Perusahaan contoh",
    isActive: index % 8 !== 7,
    createdAt: fixtureDate,
    updatedAt: fixtureDate,
  })),
};
export const SETTINGS_FIXTURE_MATERIALS: readonly MaterialSettingRow[] = Array.from(
  { length: 27 },
  (_, index): MaterialSettingRow => {
    const category = materialCategories[index % materialCategories.length];
    const vendor = SETTINGS_FIXTURE_ADMINISTRATION.vendors[index];
    const location = locations[index % locations.length];
    return {
      id: fixtureId(3000 + index),
      categoryId: category?.id ?? fixtureId(301),
      categoryName: category?.name ?? "Panel dan kayu",
      defaultVendorId: vendor?.id ?? null,
      defaultVendorName: vendor?.name ?? null,
      name: `${materialNames[index % materialNames.length]}${index < 9 ? "" : ` — seri ${Math.floor(index / 9) + 1}`}`,
      specification: "Material contoh. Cocokkan spesifikasi dengan kebutuhan proyek.",
      brand: "Referensi workshop",
      code: `MAT-${String(index + 1).padStart(3, "0")}`,
      color: index % 3 === 0 ? "Natural" : null,
      unit: index % 3 === 0 ? "lembar" : index % 3 === 1 ? "liter" : "buah",
      isActive: index % 7 !== 6,
      inventory: [
        {
          id: fixtureId(4000 + index),
          locationId: location?.id ?? fixtureId(201),
          locationName: location?.name ?? "Gudang pusat",
          currentStock: index % 6 === 0 ? 0 : 12 + index,
          reservedStock: index % 4,
          minimumStock: 5,
          averageCost: 125_000 + index * 10_000,
          lastPurchasePrice: 130_000 + index * 10_000,
        },
      ],
    };
  },
);
export const SETTINGS_FIXTURE_PRICING: readonly PricingTemplateRow[] = Array.from(
  { length: 27 },
  (_, index): PricingTemplateRow => {
    const category = SETTINGS_FIXTURE_CATEGORIES[index % SETTINGS_FIXTURE_CATEGORIES.length];
    const material = SETTINGS_FIXTURE_MATERIALS[index];
    const cost = 175_000 + index * 25_000;
    return {
      id: fixtureId(5000 + index),
      expenseCategoryId: category?.id ?? fixtureId(101),
      expenseCategoryCode: category?.code ?? "MATERIAL",
      materialId: index % 5 === 0 ? (material?.id ?? null) : null,
      defaultVendorId: fixtureId(2000 + index),
      code: `LIB-${String(index + 1).padStart(3, "0")}`,
      itemType:
        index % 5 === 0
          ? "MATERIAL_ITEM"
          : index % 5 === 1
            ? "WORK_PACKAGE"
            : index % 5 === 4
              ? "SUBCON_PACKAGE"
              : "CLIENT_LINE",
      itemCategory: category?.name ?? "Material",
      name: `${["Panel kabinet dapur", "Pemasangan kabinet", "Pengiriman material", "Perlengkapan proyek", "Pekerjaan countertop"][index % 5]} — tipe ${index + 1}`,
      description: "Template contoh dengan rincian biaya dan harga jual.",
      unit: index % 5 === 0 ? "m²" : "paket",
      defaultClientPrice: Math.round((cost / 0.7) * 100) / 100,
      defaultInternalCost: cost,
      pricingMode: index % 3 === 0 ? "FIXED_CLIENT_PRICE" : "MARGIN_BASED",
      targetGrossPercentage: 0.3,
      priceSourceType: index % 2 === 0 ? "COST_BREAKDOWN" : "VENDOR_QUOTE",
      sourceNote: "Harga contoh untuk tinjauan visual.",
      effectiveFrom: fixtureDate,
      isActive: index % 8 !== 7,
      components: [
        {
          id: fixtureId(6000 + index),
          vendorId: fixtureId(2000 + index),
          componentType: index % 5 === 1 ? "LABOR" : "MATERIAL",
          label: "Komponen biaya utama",
          quantity: 1,
          unit: "paket",
          unitCost: cost,
          totalCost: cost,
          note: null,
          displayOrder: 0,
        },
      ],
    };
  },
);
export const SETTINGS_FIXTURE_OVERVIEW: SettingsOverview = {
  roleName: "OWNER",
  permissions: {
    canManageBudgetSettings: true,
    canManageExpenseCategories: true,
    canManageItemLibrary: true,
    canManageMaterialSettings: true,
    canManageUsers: true,
    canManageVendors: true,
  },
  budgetAllocationSetting: {
    id: fixtureId(701),
    name: "Standar proyek interior",
    budgetCapRatio: 0.8,
    notes: "Alokasi awal proyek baru. Tinjau kebutuhan setiap proyek sebelum disetujui.",
    isActive: true,
    categories: SETTINGS_FIXTURE_CATEGORIES.map((category, index) => ({
      id: fixtureId(710 + index),
      expenseCategoryId: category.id,
      code: category.code,
      name: category.name,
      ratioPercentage: category.defaultRatio,
      isEnabled: category.isActive,
      sortOrder: category.sortOrder,
    })),
  },
  expenseCategories: SETTINGS_FIXTURE_CATEGORIES,
  itemLibrary: SETTINGS_FIXTURE_PRICING.map((item: PricingTemplateRow): ItemPriceLibraryRow => ({
    ...item,
    materialName:
      SETTINGS_FIXTURE_MATERIALS.find((material) => material.id === item.materialId)?.name ?? null,
  })),
  materialCategories,
  vendors: SETTINGS_FIXTURE_ADMINISTRATION.vendors.map(({ id, name }) => ({ id, name })),
  inventoryLocations: locations,
  materials: SETTINGS_FIXTURE_MATERIALS,
};
const readiness: readonly OperationalReadinessItem[] = [
  {
    id: "core_team",
    label: "Tim inti",
    detail: "Peran keuangan dan pelaksana proyek tersedia.",
    ready: true,
    status: "READY",
    action: { href: "/settings?tab=organization", label: "Tinjau tim" },
  },
  {
    id: "bank_account",
    label: "Rekening operasional",
    detail: "Rekening aktif siap dipakai untuk pencatatan kas.",
    ready: true,
    status: "READY",
    action: { href: "/ledger?tab=accounts", label: "Tinjau rekening" },
  },
  {
    id: "material_foundation",
    label: "Fondasi material",
    detail: "Material dan lokasi inventory telah disiapkan.",
    ready: true,
    status: "READY",
    action: { href: "/settings?tab=catalog", label: "Tinjau material" },
  },
  {
    id: "initial_stock",
    label: "Saldo awal stok",
    detail: "Keputusan stok awal telah ditinjau.",
    ready: true,
    status: "NOT_APPLICABLE",
    action: { href: "/settings?tab=readiness&flow=initial-stock", label: "Tinjau saldo awal" },
  },
];
export function settingsFixtureSetup(scenario: SettingsFixtureScenario): OrganizationSetupOverview {
  const empty = scenario === "empty";
  const required = readiness.map((item): OperationalReadinessItem =>
    empty
      ? {
          ...item,
          ready: false,
          status: "INCOMPLETE",
          detail: "Belum ada data yang memenuhi kebutuhan operasional.",
        }
      : scenario === "readiness-pending" && item.id === "initial_stock"
        ? {
            ...item,
            ready: false,
            status: "PENDING_APPROVAL",
            detail: "Pengajuan saldo awal menunggu keputusan Finance Admin.",
          }
        : item,
  );
  return {
    canManageQuickStart: scenario !== "read-only",
    hasPersistedState: true,
    freshInstall: empty,
    shouldAutoOpen: false,
    quickStart: {
      state: {
        ...createDefaultOwnerQuickStartState(fixtureDate.toISOString()),
        status: "COMPLETED",
        currentStep: "success",
        reviewedSteps: ["welcome", "financial_defaults", "first_project", "success"],
        completedAt: fixtureDate.toISOString(),
        initialStockDecision:
          scenario === "readiness-pending" ? "HAS_LEGACY_STOCK" : "NO_LEGACY_STOCK",
      },
      progress: getQuickStartProgress("success"),
    },
    requiredReadiness: required,
    recommendedReadiness: [
      {
        id: "vendor",
        label: "Vendor",
        detail: empty
          ? "Vendor belum ditambahkan."
          : "Referensi vendor siap untuk tagihan dan procurement.",
        ready: !empty,
        status: empty ? "INCOMPLETE" : "READY",
        action: { href: "/settings?tab=organization", label: "Tinjau vendor" },
      },
      {
        id: "item_library",
        label: "Item & harga",
        detail: empty
          ? "Template harga belum ditambahkan."
          : "Template harga memiliki rincian biaya dan sumber harga.",
        ready: !empty,
        status: empty ? "INCOMPLETE" : "READY",
        action: { href: "/settings?tab=catalog&section=library", label: "Tinjau library" },
      },
    ],
    requiredReadyCount: required.filter((item) => item.ready).length,
    requiredTotal: required.length,
    allRequiredReady: required.every((item) => item.ready),
  };
}
export function settingsFixtureOverview(scenario: SettingsFixtureScenario): SettingsOverview {
  if (scenario === "empty")
    return {
      ...SETTINGS_FIXTURE_OVERVIEW,
      budgetAllocationSetting: null,
      expenseCategories: [],
      itemLibrary: [],
      materialCategories: [],
      vendors: [],
      inventoryLocations: [],
      materials: [],
    };
  if (scenario === "read-only" || scenario === "roles-only")
    return {
      ...SETTINGS_FIXTURE_OVERVIEW,
      roleName: scenario === "roles-only" ? "Pengelola peran" : "Pemeriksa proyek",
      permissions: {
        canManageBudgetSettings: false,
        canManageExpenseCategories: false,
        canManageItemLibrary: false,
        canManageMaterialSettings: false,
        canManageUsers: false,
        canManageVendors: false,
      },
    };
  return SETTINGS_FIXTURE_OVERVIEW;
}
export function settingsFixtureAdministration(
  scenario: SettingsFixtureScenario,
): AdministrationOverview {
  if (scenario === "empty") return { ...SETTINGS_FIXTURE_ADMINISTRATION, users: [], vendors: [] };
  if (scenario === "roles-only")
    return {
      ...SETTINGS_FIXTURE_ADMINISTRATION,
      users: [],
      vendors: [],
      capabilities: {
        canViewUsers: false,
        canManageUsers: false,
        canViewVendors: false,
        canManageVendors: false,
        canManageRoles: true,
      },
    };
  if (scenario === "read-only")
    return {
      ...SETTINGS_FIXTURE_ADMINISTRATION,
      capabilities: {
        canViewUsers: true,
        canManageUsers: false,
        canViewVendors: true,
        canManageVendors: false,
        canManageRoles: false,
      },
    };
  return SETTINGS_FIXTURE_ADMINISTRATION;
}

export function settingsFixtureInitialStock(
  scenario: SettingsFixtureScenario,
): readonly InitialStockCandidate[] {
  if (scenario === "empty") return [];
  return SETTINGS_FIXTURE_MATERIALS.flatMap((material): InitialStockCandidate[] =>
    material.inventory.map((inventory): InitialStockCandidate => {
      const pending = scenario === "readiness-pending" && material.id === fixtureId(3000);
      const eligible = !pending && inventory.currentStock === 0 && inventory.reservedStock === 0;
      return {
        inventoryId: inventory.id,
        materialId: material.id,
        materialName: material.name,
        categoryName: material.categoryName,
        specification: material.specification,
        brand: material.brand,
        code: material.code,
        color: material.color,
        unit: material.unit,
        locationId: inventory.locationId,
        locationName: inventory.locationName,
        currentStock: inventory.currentStock,
        reservedStock: inventory.reservedStock,
        availableStock: inventory.currentStock - inventory.reservedStock,
        minimumStock: inventory.minimumStock,
        averageCost: inventory.averageCost,
        lastPurchasePrice: inventory.lastPurchasePrice,
        status: inventory.currentStock === 0 ? "OUT_OF_STOCK" : "AVAILABLE",
        eligible,
        ineligibleReason: pending
          ? "Sudah ada pengajuan saldo awal yang menunggu persetujuan."
          : eligible
            ? null
            : "Inventory sudah memiliki saldo atau reservasi.",
      };
    }),
  );
}
export function settingsFixtureOpeningBatches(
  scenario: SettingsFixtureScenario,
): readonly InventoryOpeningBatchView[] {
  if (scenario !== "readiness-pending") return [];
  return [
    {
      id: fixtureId(8000),
      tenantId: fixtureId(99),
      batchNumber: "Stok awal workshop contoh",
      cutoverDate: fixtureDate,
      status: "PENDING_APPROVAL",
      note: "Hasil pengecekan fisik gudang sebelum pencatatan dimulai.",
      referenceNumber: "Pemeriksaan stok workshop",
      requestedById: fixtureId(1001),
      approvedById: null,
      approvedAt: null,
      postedAt: null,
      decisionReason: null,
      rejectedReason: null,
      reversedById: null,
      reversedAt: null,
      reversalReason: null,
      createdAt: fixtureDate,
      updatedAt: fixtureDate,
      itemCount: 1,
      totalValue: 1_375_000,
      canReverse: false,
      requestedByName: "Budi Santoso",
      approvedByName: null,
      reversedByName: null,
      items: [
        {
          id: fixtureId(8100),
          materialInventoryId: fixtureId(4000),
          materialName: "Multipleks 18 mm",
          locationName: "Gudang pusat",
          unit: "lembar",
          quantity: 5,
          unitCost: 275_000,
          totalValue: 1_375_000,
          currentStock: 0,
          reservedStock: 0,
          availableStock: 0,
          averageCost: 0,
          stockMovementId: null,
        },
      ],
    },
  ];
}
