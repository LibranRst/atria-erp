import type { PermissionKey } from "@atria/core/auth/permissions";
import {
  projectMaterialProjection,
  type ProjectMaterialMovement,
} from "@atria/core/material/project-material-projection";
import { calculateQuotationTotal } from "@atria/core/project/quotation-total";
import type {
  ChangeOrderHistoryView,
  MaterialOption,
  PricingTemplateOption,
  ProjectCategoryPlanItemView,
  ProjectPlanBudgetCategory,
  RabBundleView,
  RabEstimateView,
  RabItemView,
  RabRevisionHistoryView,
  RapItemView,
  RapSetupStage,
  RapView,
  VendorOption,
} from "@/features/projects/detail/types/rap-rab-types";
import type { RabExportMetadata } from "@/features/projects/detail/utils/rab-export-utils";

/** Synthetic, deterministic story data only; this module never contacts an API. */
export type RapRabFixtureKind =
  | "complete"
  | "empty"
  | "rab-empty"
  | "draft-material"
  | "draft-tukang"
  | "draft-subcon"
  | "draft-review"
  | "skipped-scope"
  | "rab-draft"
  | "rab-revision"
  | "stale-source";
export type RapRabFixtureAccess =
  "owner" | "read-only" | "editor" | "approver" | "rap-editor" | "restricted";

export function rapRabFixtureId(value: number): string {
  return `40000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
}

const materials: readonly { name: string; unit: string; price: string }[] = [
  {
    name: "Plywood meranti 18 mm — kabinet bawah dan island kitchen",
    unit: "lembar",
    price: "387500.25",
  },
  {
    name: "Veneer natural oak quarter cut — panel dinding ruang keluarga",
    unit: "m2",
    price: "295000.50",
  },
  { name: "LED strip warm white 3000K dengan profil aluminium", unit: "m", price: "85000.75" },
  { name: "Engsel kabinet soft close 110 derajat", unit: "set", price: "125000.00" },
  {
    name: "Solid surface putih 12 mm untuk countertop dan backsplash",
    unit: "m2",
    price: "1125000.25",
  },
  { name: "Cat duco water based putih doff", unit: "liter", price: "165000.50" },
];
const areas = ["Dapur & pantry", "Ruang keluarga", "Kamar utama", "Foyer"];

export const RAP_RAB_MATERIALS: readonly MaterialOption[] = materials.map((item, index) => ({
  id: rapRabFixtureId(100 + index),
  name: item.name,
  unit: item.unit,
  lastPurchasePrice: item.price,
  availableStock: index % 2 === 0 ? 12.5 : 0,
  categoryName: index % 2 === 0 ? "Panel & finishing" : "Fitting interior",
  inventories: [
    {
      inventoryId: rapRabFixtureId(200 + index),
      locationId: rapRabFixtureId(201),
      locationName: "Gudang Cipete",
      currentStock: index % 2 === 0 ? 15 : 2.5,
      reservedStock: 2.5,
      availableStock: index % 2 === 0 ? 12.5 : 0,
      averageCost: Number(item.price),
    },
  ],
}));

export const RAP_RAB_BUDGET_CATEGORIES: readonly ProjectPlanBudgetCategory[] = [
  { id: rapRabFixtureId(301), code: "TUKANG", name: "Tukang" },
  { id: rapRabFixtureId(302), code: "SUBCON", name: "Subcon" },
];
export const RAP_RAB_VENDORS: readonly VendorOption[] = [
  { id: rapRabFixtureId(401), name: "CV Batu Prima Countertop" },
  { id: rapRabFixtureId(402), name: "Studio Metal Jakarta" },
];
export const RAP_RAB_TEMPLATES: readonly PricingTemplateOption[] = [
  {
    id: rapRabFixtureId(501),
    itemType: "MATERIAL_ITEM",
    expenseCategoryId: rapRabFixtureId(300),
    materialId: rapRabFixtureId(100),
    defaultVendorId: null,
    name: "Kabinet plywood HPL 18 mm",
    description: "Panel kabinet dengan finishing HPL",
    unit: "lembar",
    internalCost: 387500.25,
    suggestedClientPrice: 600000.5,
  },
  {
    id: rapRabFixtureId(502),
    itemType: "WORK_PACKAGE",
    expenseCategoryId: rapRabFixtureId(301),
    materialId: null,
    defaultVendorId: null,
    name: "Pemasangan kabinet dan panel dinding",
    description: "Jasa pemasangan di lokasi proyek",
    unit: "ls",
    internalCost: 12500000.25,
    suggestedClientPrice: 16000000.5,
  },
];

export function rapRabFixtureMaterialMovements(
  index: number,
  draft: boolean,
): readonly ProjectMaterialMovement[] {
  if (draft) return [];
  const ready = index % 4 === 1;
  const quantity = ready ? (index % 3 === 0 ? 12.5 : 5) + 1 : 2;
  const source = {
    materialId: rapRabFixtureId(100 + (index % materials.length)),
    inventoryLocationId: rapRabFixtureId(201),
    projectRapItemId: rapRabFixtureId(1000 + index),
  };
  return [
    {
      ...source,
      id: rapRabFixtureId(5000 + index * 3),
      movementType: "GOODS_RECEIPT",
      quantity,
      createdAt: new Date("2026-10-05T03:00:00Z"),
    },
    {
      ...source,
      id: rapRabFixtureId(5001 + index * 3),
      movementType: "RESERVE",
      quantity,
      createdAt: new Date("2026-10-06T03:00:00Z"),
    },
    ...(ready
      ? [
          {
            ...source,
            id: rapRabFixtureId(5002 + index * 3),
            movementType: "USE",
            quantity: 1,
            createdAt: new Date("2026-10-07T03:00:00Z"),
          },
        ]
      : []),
  ];
}

function materialItem(index: number, draft: boolean): RapItemView {
  const item = materials[index % materials.length]!;
  const quantity = index % 3 === 0 ? 12.5 : 5;
  const total = quantity + 1;
  const ready = !draft && index % 4 === 1;
  const projection = projectMaterialProjection(rapRabFixtureMaterialMovements(index, draft), total);
  return {
    id: rapRabFixtureId(1000 + index),
    materialId: rapRabFixtureId(100 + (index % materials.length)),
    materialName: item.name,
    area: areas[index % areas.length]!,
    name:
      index < materials.length
        ? item.name
        : `${item.name} · Area ${Math.floor(index / materials.length) + 1}`,
    description: "Spesifikasi sintetis untuk penilaian tabel dan rincian desktop.",
    requiredQuantity: quantity.toFixed(2),
    bufferQuantity: "1.00",
    totalQuantity: total.toFixed(2),
    unit: item.unit,
    estimatedUnitCost: item.price,
    estimatedTotalCost: (Math.round(total * Number(item.price) * 100) / 100).toFixed(2),
    source: index % 3 === 0 ? "STOCK_AND_PURCHASE" : "PURCHASE",
    status: draft ? "PLANNED" : ready ? "READY" : "SHORTAGE",
    internalNote:
      "Catatan internal sintetis: periksa ukuran akhir setelah ukur lapangan. Tidak untuk dokumen klien.",
    availableStock: index % 2 === 0 ? 12.5 : 0,
    ...projection,
    actualMaterialCost: draft ? 0 : ready ? Number(item.price) + 0.25 : 0,
    costVariance:
      (draft ? 0 : ready ? Number(item.price) + 0.25 : 0) -
      Math.round(total * Number(item.price) * 100) / 100,
  };
}

function packageItem(
  index: number,
  code: "TUKANG" | "SUBCON",
  draft: boolean,
): ProjectCategoryPlanItemView {
  const quantity = index % 2 ? 2.5 : 1;
  const price = code === "TUKANG" ? 4500000.25 + index * 100000 : 9750000.5 + index * 150000;
  return {
    id: rapRabFixtureId((code === "TUKANG" ? 2000 : 2100) + index),
    projectBudgetCategoryId: rapRabFixtureId(code === "TUKANG" ? 301 : 302),
    expenseCategoryCode: code,
    expenseCategoryName: code === "TUKANG" ? "Tukang" : "Subcon",
    vendorId: code === "SUBCON" ? RAP_RAB_VENDORS[index % 2]!.id : null,
    vendorName: code === "SUBCON" ? RAP_RAB_VENDORS[index % 2]!.name : null,
    name: `${code === "TUKANG" ? "Pemasangan kabinet dan panel dinding" : "Fabrikasi countertop dan backsplash solid surface"} · ${areas[index % areas.length]}`,
    scopeDescription:
      "Lingkup sintetis termasuk pengukuran, fabrikasi, dan pemeriksaan akhir di lokasi.",
    area: areas[index % areas.length]!,
    quantity: quantity.toFixed(2),
    unit: index % 2 ? "m2" : "ls",
    estimatedUnitCost: price.toFixed(2),
    estimatedTotalCost: (quantity * price).toFixed(2),
    status: draft ? "DRAFT" : "ACTIVE",
    internalNote: "Catatan internal sintetis: konfirmasi jadwal tim sebelum mobilisasi.",
    displayOrder: index + 1,
    actualCost: draft ? 0 : index % 2 ? 2500000.25 : 0,
    variance: (draft ? 0 : index % 2 ? 2500000.25 : 0) - quantity * price,
  };
}

function rabItem(index: number, bundleId: string | null): RabItemView {
  const source = materialItem(index, false);
  const workPackage =
    index === 33
      ? packageItem(0, "TUKANG", false)
      : index === 34
        ? packageItem(0, "SUBCON", false)
        : null;
  const manual = index === 32 || index === 35;
  const quantity = manual ? 1 : Number(workPackage?.quantity ?? source.totalQuantity);
  const price = manual
    ? index === 35
      ? 12000000.5
      : 2500000.25
    : Math.round(Number(workPackage?.estimatedUnitCost ?? source.estimatedUnitCost) * 1.25 * 100) /
      100;
  return {
    id: rapRabFixtureId(3000 + index),
    sourceType: manual ? "MANUAL_CLIENT_LINE" : workPackage ? "CATEGORY_PLAN" : "RAP_MATERIAL",
    itemNature: index === 35 ? "SERVICE_FEE" : "PRODUCTION",
    sourceProjectRapItemId: manual || workPackage ? null : source.id,
    sourceProjectCategoryPlanItemId: workPackage?.id ?? null,
    clientLabel:
      index === 35
        ? "Jasa desain, gambar kerja dan supervisi proyek"
        : index === 32
          ? "Pembersihan akhir dan perlindungan furnitur"
          : (workPackage?.name ?? source.name.replace("Area", "Ruang")),
    description:
      "Termasuk pengiriman, pemasangan, dan pemeriksaan mutu sesuai spesifikasi penawaran.",
    quantity: quantity.toFixed(2),
    unit: manual ? "ls" : (workPackage?.unit ?? source.unit),
    unitPrice: price.toFixed(2),
    lineTotal: (Math.round(quantity * price * 100) / 100).toFixed(2),
    displayOrder: index + 1,
    isHidden: index === 10 || index === 25,
    isBundle: false,
    bundleId,
    sourceRevision: manual ? null : 2,
    sourceUpdatedAt: manual ? null : new Date("2026-10-12T03:00:00Z"),
  };
}

export interface RapRabFixtureData {
  readonly projectId: string;
  readonly rap: RapView | null;
  readonly rabEstimate: RabEstimateView | null;
  readonly materials: MaterialOption[];
  readonly budgetCategories: ProjectPlanBudgetCategory[];
  readonly categoryPlanItems: ProjectCategoryPlanItemView[];
  readonly vendors: VendorOption[];
  readonly pricingTemplates: PricingTemplateOption[];
  readonly baselineApprovedRabId: string | null;
  readonly changeOrders: readonly ChangeOrderHistoryView[];
  readonly revisionHistory: readonly RabRevisionHistoryView[];
  readonly staleSourceLabels: readonly string[];
  readonly exportMetadata: RabExportMetadata;
}

export function rapRabFixturePermissions(access: RapRabFixtureAccess): readonly PermissionKey[] {
  const view: readonly PermissionKey[] = ["view:budget", "view:rap", "view:rab"];
  if (access === "restricted") return ["view:budget"];
  if (access === "read-only") return view;
  if (access === "approver") return [...view, "approve:rab", "lock:rap"];
  if (access === "editor") return [...view, "update:rab", "create:rab"];
  if (access === "rap-editor") return [...view, "update:rap", "update:budget"];
  return [
    ...view,
    "create:rap",
    "update:rap",
    "lock:rap",
    "update:budget",
    "create:rab",
    "update:rab",
    "approve:rab",
  ];
}

export function rapRabFixtureData(kind: RapRabFixtureKind = "complete"): RapRabFixtureData {
  const draft = kind.startsWith("draft-") || kind === "skipped-scope";
  const stage: RapSetupStage =
    kind === "draft-tukang"
      ? "TUKANG"
      : kind === "draft-subcon"
        ? "SUBCON"
        : kind === "draft-review" || kind === "skipped-scope"
          ? "REVIEW"
          : "MATERIAL";
  const rap: RapView | null =
    kind === "empty"
      ? null
      : {
          id: rapRabFixtureId(601),
          status: draft ? "DRAFT" : "LOCKED",
          revision: 2,
          notes:
            "Data sintetis untuk tinjauan RAP. Rencana internal bukan pembayaran atau penerimaan barang.",
          setupStage: draft ? stage : "COMPLETE",
          tukangScopeSkipped: kind === "skipped-scope",
          subconScopeSkipped: kind === "skipped-scope",
          setupUpdatedById: rapRabFixtureId(701),
          items: Array.from({ length: 36 }, (_, index) => materialItem(index, draft)),
        };
  const categoryPlanItems =
    kind === "empty" || kind === "skipped-scope" || kind === "draft-material"
      ? []
      : [
          ...Array.from({ length: 15 }, (_, index) =>
            packageItem(index, "TUKANG", kind === "draft-tukang"),
          ),
          ...(kind === "draft-tukang"
            ? []
            : Array.from({ length: 12 }, (_, index) =>
                packageItem(index, "SUBCON", kind === "draft-subcon"),
              )),
        ];
  const bundles: RabBundleView[] = [
    {
      id: rapRabFixtureId(901),
      clientLabel: "Paket kitchen set dan island — dapur utama",
      description: "Kabinet atas dan bawah, island serta pemasangan terpadu.",
      quantity: "1.00",
      unit: "paket",
      unitPrice: "72500000.25",
      lineTotal: "72500000.25",
      displayOrder: 1,
      isHidden: false,
      itemIds: [0, 1, 2].map((index) => rapRabFixtureId(3000 + index)),
    },
    {
      id: rapRabFixtureId(902),
      clientLabel: "Alternatif finishing foyer — tidak termasuk penawaran",
      description: "Alternatif desain disimpan untuk diskusi berikutnya.",
      quantity: "1.00",
      unit: "paket",
      unitPrice: "9500000.50",
      lineTotal: "9500000.50",
      displayOrder: 2,
      isHidden: true,
      itemIds: [3, 4].map((index) => rapRabFixtureId(3000 + index)),
    },
  ];
  const items = Array.from({ length: 36 }, (_, index) =>
    rabItem(index, index < 3 ? bundles[0]!.id : index < 5 ? bundles[1]!.id : null),
  );
  const draftRab = kind === "rab-draft" || kind === "rab-revision" || kind === "stale-source";
  const rabEstimate: RabEstimateView | null =
    kind === "empty" || kind === "rab-empty" || draft
      ? null
      : {
          id: rapRabFixtureId(801),
          sourceProjectRapId: rap?.id ?? null,
          supersedesRabEstimateId:
            kind === "rab-revision" || kind === "stale-source" ? rapRabFixtureId(800) : null,
          status: draftRab ? "DRAFT" : "APPROVED",
          revision: draftRab ? 3 : 2,
          title: "Penawaran interior Menteng Villa — Kitchen & Living Room Fit-Out",
          clientNotes:
            "Harga berlaku 30 hari. Pelaksanaan mengikuti persetujuan gambar kerja dan kondisi lokasi.",
          approvedValue: draftRab ? "0.00" : calculateQuotationTotal(items, bundles).toFixed(2),
          items,
          bundles,
        };
  return {
    projectId: rapRabFixtureId(1),
    rap,
    rabEstimate,
    materials: [...RAP_RAB_MATERIALS],
    budgetCategories: [...RAP_RAB_BUDGET_CATEGORIES],
    categoryPlanItems,
    vendors: [...RAP_RAB_VENDORS],
    pricingTemplates: [...RAP_RAB_TEMPLATES],
    baselineApprovedRabId:
      kind === "rab-revision" || kind === "stale-source" ? rapRabFixtureId(800) : null,
    changeOrders: rabEstimate
      ? [
          {
            id: rapRabFixtureId(951),
            status: "APPROVED",
            reason: "Penambahan island dan revisi finishing kabinet sesuai persetujuan klien.",
            scopeSummary: "Island dapur dan panel veneer ruang keluarga.",
            previousContractValue: "250000000.25",
            valueDelta: "12500000.50",
            revisedContractValue: "262500000.75",
            clientConfirmedAt: new Date("2026-10-10T03:00:00Z"),
            clientConfirmationReference: "Persetujuan tertulis klien · 10 Oktober 2026",
            createdAt: new Date("2026-10-09T03:00:00Z"),
            approvedAt: new Date("2026-10-10T04:00:00Z"),
            createdByName: "Karin Putri",
            approvedByName: "Libran",
            baseRevision: 1,
            revisedRevision: 2,
            sourceRevisionSummary: "RAP R2 · Package R2",
          },
        ]
      : [],
    revisionHistory: rabEstimate
      ? [
          {
            id: rabEstimate.id,
            revision: rabEstimate.revision,
            status: rabEstimate.status,
            value: calculateQuotationTotal(items, bundles),
            voidReason: null,
            voidedAt: null,
            voidedByName: null,
          },
          ...(draftRab
            ? [
                {
                  id: rapRabFixtureId(800),
                  revision: 2,
                  status: "APPROVED",
                  value: 250000000.25,
                  voidReason: null,
                  voidedAt: null,
                  voidedByName: null,
                },
              ]
            : []),
          {
            id: rapRabFixtureId(799),
            revision: 1,
            status: "VOID",
            value: 230000000.5,
            voidReason: "Diganti dengan lingkup revisi yang sudah ditinjau bersama klien.",
            voidedAt: new Date("2026-10-08T03:00:00Z"),
            voidedByName: "Libran",
          },
        ]
      : [],
    staleSourceLabels:
      kind === "stale-source" ? items.slice(0, 3).map((item) => item.clientLabel) : [],
    exportMetadata: {
      projectName: "Menteng Villa — Kitchen & Living Room Fit-Out",
      projectNumber: "SYNTHETIC-2026-001",
      clientName: "Keluarga Surya",
      projectAddress: "Menteng, Jakarta Pusat",
      companyName: "Dekoria · Contoh sintetis",
      date: "15 Oktober 2026",
    },
  };
}
