import { and, asc, eq, ne } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "@backend/db";
import {
  INSTANCE_TENANT_ID,
  vendor,
  materialMaster,
  inventoryLocation,
  materialInventory,
  expenseCategory,
  itemPriceLibrary,
  itemPriceLibraryCostComponent,
  stockMovement,
  auditLog,
} from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import { lockMaterialCatalog } from "../material/master-writer";
import { createVendorTx } from "../material/reference-writer";
import { calculateSuggestedClientPrice, roundMoney } from "@atria/core/project/pricing";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import {
  catalogSettingsInputSchema,
  catalogSettingsProposalSchema,
  catalogSettingsPermission,
  type CatalogSettingsInput,
  type CatalogSettingsProposal,
} from "@atria/core/ai/catalog-settings";
export type CatalogTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export class CatalogSettingsError extends Error {
  constructor(
    readonly code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR",
    message: string,
  ) {
    super(message);
  }
}
export function assertCatalogRights(actor: Actor, input: CatalogSettingsInput): void {
  if (!actorCan(actor, catalogSettingsPermission(input.action)))
    throw new CatalogSettingsError("FORBIDDEN", "Izin pengaturan terkait tidak tersedia.");
}
const clean = (value: string | null | undefined): string | null => value?.trim() || null;
type VendorInput = Extract<
  CatalogSettingsInput,
  { action: "VENDOR_CREATE" | "VENDOR_EDIT" | "VENDOR_STATUS" }
>;
type LibraryInput = Extract<
  CatalogSettingsInput,
  {
    action:
      | "LIBRARY_CREATE"
      | "LIBRARY_EDIT"
      | "LIBRARY_STATUS"
      | "LIBRARY_ARCHIVE"
      | "PRICING_TEMPLATE_SAVE";
  }
>;
function vendorValues(
  before: typeof vendor.$inferSelect | null,
  input: VendorInput,
): typeof vendor.$inferInsert {
  const v =
    input.action === "VENDOR_CREATE"
      ? input.payload
      : input.action === "VENDOR_EDIT"
        ? { ...before, ...input.patch }
        : { ...before, isActive: input.isActive };
  if (!v.name || !v.phone)
    throw new CatalogSettingsError("VALIDATION_ERROR", "Nama dan telepon vendor wajib diisi.");
  return {
    name: v.name.trim(),
    phone: v.phone.trim(),
    email: clean(v.email)?.toLowerCase() ?? null,
    address: clean(v.address),
    bankName: clean(v.bankName),
    bankAccountNumber: clean(v.bankAccountNumber),
    bankAccountHolder: clean(v.bankAccountHolder),
    isActive: v.isActive ?? true,
  };
}
function libraryValues(
  before: typeof itemPriceLibrary.$inferSelect | null,
  input: LibraryInput,
): typeof itemPriceLibrary.$inferInsert {
  if (input.action === "LIBRARY_STATUS" || input.action === "LIBRARY_ARCHIVE") {
    if (!before) throw new CatalogSettingsError("NOT_FOUND", "Item library tidak ditemukan.");
    return { ...before, isActive: input.action === "LIBRARY_ARCHIVE" ? false : input.isActive };
  }
  const p = input.action === "LIBRARY_EDIT" ? { ...before, ...input.patch } : input.payload;
  if (!p.expenseCategoryId || !p.name || !p.unit || !p.itemCategory)
    throw new CatalogSettingsError("VALIDATION_ERROR", "Lengkapi identitas item library.");
  const base: typeof itemPriceLibrary.$inferInsert = {
    expenseCategoryId: p.expenseCategoryId,
    materialId: p.materialId ?? null,
    code: clean(p.code),
    itemType: p.itemType,
    itemCategory: p.itemCategory.trim(),
    name: p.name.trim(),
    description: clean(p.description),
    unit: p.unit.trim(),
    isActive:
      "isActive" in p ? (p.isActive ?? before?.isActive ?? true) : (before?.isActive ?? true),
  };
  if (input.action === "PRICING_TEMPLATE_SAVE") {
    const t = input.payload;
    const total = roundMoney(
      t.components.reduce((sum, c) => sum + roundMoney(c.quantity * c.unitCost), 0),
    );
    const price =
      t.pricingMode === "MARGIN_BASED"
        ? calculateSuggestedClientPrice(total, t.targetGrossPercentage)
        : (t.fixedClientPrice ?? 0);
    if (
      !Number.isFinite(total) ||
      !Number.isFinite(price) ||
      total > 9_999_999_999_999.99 ||
      price > 9_999_999_999_999.99
    )
      throw new CatalogSettingsError(
        "VALIDATION_ERROR",
        "Total biaya atau harga melewati batas penyimpanan.",
      );
    return {
      ...base,
      defaultVendorId: t.defaultVendorId ?? null,
      defaultInternalCost: total.toFixed(2),
      defaultClientPrice: roundMoney(price).toFixed(2),
      pricingMode: t.pricingMode,
      targetGrossPercentage: t.targetGrossPercentage.toFixed(4),
      priceSourceType: t.priceSourceType,
      sourceNote: t.sourceNote,
      effectiveFrom: new Date(t.effectiveFrom),
    };
  }
  const v = input.action === "LIBRARY_CREATE" ? input.payload : { ...before, ...input.patch };
  return {
    ...base,
    defaultInternalCost: Number(v.defaultInternalCost).toFixed(2),
    defaultClientPrice: Number(v.defaultClientPrice).toFixed(2),
  };
}
const titles: Record<CatalogSettingsInput["action"], string> = {
  VENDOR_CREATE: "Vendor baru",
  VENDOR_EDIT: "Koreksi vendor",
  VENDOR_STATUS: "Status vendor",
  LIBRARY_CREATE: "Item library baru",
  LIBRARY_EDIT: "Koreksi item library",
  LIBRARY_STATUS: "Status item library",
  LIBRARY_ARCHIVE: "Arsip item library",
  PRICING_TEMPLATE_SAVE: "Template harga",
  INVENTORY_DEFAULTS: "Default inventory",
  INVENTORY_VALUATION: "Valuasi inventory",
};
type Row = CatalogSettingsProposal["rows"][number];
type Fact = CatalogSettingsProposal["summary"][number];
const fact = (label: string, value: string | number, money = false): Fact => ({
  label,
  value,
  money,
});
const display = (value: unknown): string =>
  value == null || value === ""
    ? "—"
    : typeof value === "boolean"
      ? value
        ? "Aktif"
        : "Nonaktif"
      : value instanceof Date
        ? value.toISOString().slice(0, 10)
        : String(value);
function changeValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "targetGrossPercentage")
    return `${(Number(value) * 100).toLocaleString("id-ID", { maximumFractionDigits: 4 })}%`;
  return ["itemType", "pricingMode", "priceSourceType"].includes(key)
    ? formatBusinessLabel(display(value))
    : display(value);
}
function changes(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
  names: Record<string, string>,
): Fact[] {
  return Object.entries(names)
    .filter(([key]) =>
      before
        ? changeValue(key, before[key]) !== changeValue(key, after[key])
        : changeValue(key, after[key]) !== "—",
    )
    .flatMap(([key, label]) =>
      before
        ? [
            fact(`${label} · sebelumnya`, changeValue(key, before[key])),
            fact(`${label} · sesudah`, changeValue(key, after[key])),
          ]
        : [fact(label, changeValue(key, after[key]))],
    );
}
export async function prepareCatalogSettingsTx(
  tx: CatalogTx,
  actor: Actor,
  raw: unknown,
): Promise<CatalogSettingsProposal> {
  const input = catalogSettingsInputSchema.parse(raw);
  assertCatalogRights(actor, input);
  await lockMaterialCatalog(tx);
  const snapshot: unknown[] = [];
  let entityName = "",
    meta = "",
    effect = "",
    rows: Row[] = [],
    summary: Fact[] = [];
  if (
    input.action === "VENDOR_CREATE" ||
    input.action === "VENDOR_EDIT" ||
    input.action === "VENDOR_STATUS"
  ) {
    const [before] =
      input.action === "VENDOR_CREATE"
        ? []
        : await tx
            .select()
            .from(vendor)
            .where(and(eq(vendor.id, input.vendorId), eq(vendor.tenantId, INSTANCE_TENANT_ID)))
            .for("update");
    if (input.action !== "VENDOR_CREATE" && !before)
      throw new CatalogSettingsError("NOT_FOUND", "Vendor tidak ditemukan.");
    const after = vendorValues(before ?? null, input);
    const duplicate = after.email
      ? await tx.query.vendor.findFirst({
          where: and(
            eq(vendor.tenantId, INSTANCE_TENANT_ID),
            eq(vendor.email, after.email),
            before ? ne(vendor.id, before.id) : undefined,
          ),
        })
      : null;
    if (duplicate) throw new CatalogSettingsError("CONFLICT", "Email vendor sudah digunakan.");
    snapshot.push(before ?? null);
    entityName = after.name;
    meta = input.action === "VENDOR_CREATE" ? "Data vendor baru" : "Data vendor tersimpan";
    rows = [
      {
        id: before?.id ?? "vendor-new",
        title: after.name,
        meta: "Data vendor",
        amount: null,
        comparisons: [],
        details: changes(before ?? null, after, {
          name: "Nama",
          phone: "Telepon",
          email: "Email",
          address: "Alamat",
          bankName: "Bank",
          bankAccountNumber: "Nomor rekening",
          bankAccountHolder: "Pemilik rekening",
          isActive: "Status",
        }),
      },
    ];
    summary = [fact("Hasil", after.isActive ? "Vendor aktif" : "Vendor nonaktif")];
    effect =
      "Memperbarui katalog vendor. Tagihan, pembayaran, dan hubungan vendor pada dokumen tersimpan tetap.";
  } else if (input.action === "INVENTORY_DEFAULTS" || input.action === "INVENTORY_VALUATION") {
    // Read identity then use the same material → location → inventory lock order as warehouse writers.
    const source = await tx.query.materialInventory.findFirst({
      where: and(
        eq(materialInventory.id, input.materialInventoryId),
        eq(materialInventory.tenantId, INSTANCE_TENANT_ID),
      ),
    });
    if (!source) throw new CatalogSettingsError("NOT_FOUND", "Inventory tidak ditemukan.");
    const [mat] = await tx
      .select()
      .from(materialMaster)
      .where(
        and(
          eq(materialMaster.id, source.materialId),
          eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
        ),
      )
      .for("update");
    const [loc] = await tx
      .select()
      .from(inventoryLocation)
      .where(
        and(
          eq(inventoryLocation.id, source.locationId),
          eq(inventoryLocation.tenantId, INSTANCE_TENANT_ID),
        ),
      )
      .for("update");
    const [before] = await tx
      .select()
      .from(materialInventory)
      .where(eq(materialInventory.id, source.id))
      .for("update");
    if (!mat || !loc || !before)
      throw new CatalogSettingsError("NOT_FOUND", "Material atau lokasi tidak tersedia.");
    snapshot.push(mat, loc, before);
    entityName = mat.name;
    meta = loc.name;
    const valuation = input.action === "INVENTORY_VALUATION";
    if (valuation && Number(before.currentStock) * input.averageCost > 9_999_999_999_999.99)
      throw new CatalogSettingsError(
        "VALIDATION_ERROR",
        "Nilai persediaan setelah koreksi melewati batas nominal.",
      );
    const comparisons = valuation
      ? [
          {
            label: "Biaya rata-rata / satuan",
            before: Number(before.averageCost),
            after: input.averageCost,
            money: true,
          },
          {
            label: "Nilai persediaan",
            before: roundMoney(Number(before.currentStock) * Number(before.averageCost)),
            after: roundMoney(Number(before.currentStock) * input.averageCost),
            money: true,
          },
        ]
      : [
          {
            label: "Stok minimum",
            before: Number(before.minimumStock),
            after: input.minimumStock,
            money: false,
          },
          {
            label: "Harga pembelian terakhir",
            before: Number(before.lastPurchasePrice),
            after: input.lastPurchasePrice,
            money: true,
          },
        ];
    rows = [
      {
        id: before.id,
        title: mat.name,
        meta: `${loc.name} · ${mat.unit}`,
        amount: null,
        comparisons,
        details: [
          fact("Stok fisik tetap", Number(before.currentStock)),
          fact("Reservasi tetap", Number(before.reservedStock)),
          fact("Satuan", mat.unit),
          ...(valuation
            ? [fact("Alasan valuasi", input.reason)]
            : [fact("Biaya rata-rata tetap", Number(before.averageCost), true)]),
        ],
      },
    ];
    summary = valuation
      ? [
          fact(
            "Nilai persediaan sesudah",
            roundMoney(Number(before.currentStock) * input.averageCost),
            true,
          ),
          fact(
            "Perubahan nilai",
            roundMoney(
              Number(before.currentStock) * (input.averageCost - Number(before.averageCost)),
            ),
            true,
          ),
        ]
      : [
          fact("Stok minimum", input.minimumStock),
          fact("Harga referensi", input.lastPurchasePrice, true),
        ];
    effect = valuation
      ? "Mengoreksi biaya rata-rata dan nilai persediaan pada lokasi ini dengan jejak valuasi dan audit. Stok fisik, reservasi, RAP/RAB tersimpan, realisasi proyek dan kas tetap."
      : "Mengubah stok minimum dan harga referensi pembelian pada lokasi ini. Stok fisik, reservasi, biaya rata-rata dan dokumen proyek tersimpan tetap.";
  } else {
    const libraryId =
      input.action === "LIBRARY_CREATE"
        ? undefined
        : input.action === "PRICING_TEMPLATE_SAVE"
          ? input.payload.itemPriceLibraryId
          : input.itemPriceLibraryId;
    const [before] = libraryId
      ? await tx
          .select()
          .from(itemPriceLibrary)
          .where(
            and(
              eq(itemPriceLibrary.id, libraryId),
              eq(itemPriceLibrary.tenantId, INSTANCE_TENANT_ID),
            ),
          )
          .for("update")
      : [];
    if (libraryId && !before)
      throw new CatalogSettingsError("NOT_FOUND", "Item library tidak ditemukan.");
    const oldComponents = before
      ? await tx.query.itemPriceLibraryCostComponent.findMany({
          where: eq(itemPriceLibraryCostComponent.itemPriceLibraryId, before.id),
          orderBy: [
            asc(itemPriceLibraryCostComponent.displayOrder),
            asc(itemPriceLibraryCostComponent.id),
          ],
        })
      : [];
    const after = { ...before, ...libraryValues(before ?? null, input) };
    const category = await tx.query.expenseCategory.findFirst({
      where: and(
        eq(expenseCategory.id, after.expenseCategoryId),
        eq(expenseCategory.tenantId, INSTANCE_TENANT_ID),
      ),
    });
    if (!category) throw new CatalogSettingsError("NOT_FOUND", "Kategori expense tidak tersedia.");
    const expected: Record<string, string> = {
      MATERIAL_ITEM: "MATERIAL",
      WORK_PACKAGE: "TUKANG",
      SUBCON_PACKAGE: "SUBCON",
    };
    if (expected[after.itemType ?? ""] && category.code !== expected[after.itemType ?? ""])
      throw new CatalogSettingsError(
        "VALIDATION_ERROR",
        "Kategori expense tidak sesuai tipe item.",
      );
    if (after.itemType !== "MATERIAL_ITEM" && after.materialId)
      throw new CatalogSettingsError(
        "VALIDATION_ERROR",
        "Material hanya dapat ditautkan ke Material Item.",
      );
    const mat = after.materialId
      ? await tx.query.materialMaster.findFirst({
          where: and(
            eq(materialMaster.id, after.materialId),
            eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
          ),
        })
      : null;
    if (after.materialId && (!mat || (!mat.isActive && after.materialId !== before?.materialId)))
      throw new CatalogSettingsError("VALIDATION_ERROR", "Material baru harus aktif dan tersedia.");
    const vendorIds = [
      ...new Set(
        [
          after.defaultVendorId,
          ...(input.action === "PRICING_TEMPLATE_SAVE"
            ? input.payload.components.map((c) => c.vendorId)
            : []),
        ].filter((v): v is string => Boolean(v)),
      ),
    ].sort();
    const vendors: (typeof vendor.$inferSelect)[] = [];
    for (const id of vendorIds) {
      const [v] = await tx
        .select()
        .from(vendor)
        .where(and(eq(vendor.id, id), eq(vendor.tenantId, INSTANCE_TENANT_ID)))
        .for("update");
      if (
        !v ||
        (!v.isActive &&
          id !== before?.defaultVendorId &&
          !oldComponents.some((c) => c.vendorId === id))
      )
        throw new CatalogSettingsError("VALIDATION_ERROR", "Vendor baru harus aktif dan tersedia.");
      vendors.push(v);
    }
    if (input.action === "PRICING_TEMPLATE_SAVE")
      for (const c of input.payload.components) {
        if (c.id && !oldComponents.some((o) => o.id === c.id))
          throw new CatalogSettingsError("VALIDATION_ERROR", "Komponen bukan milik template ini.");
        if (roundMoney(c.quantity * c.unitCost) > 9_999_999_999_999.99)
          throw new CatalogSettingsError("VALIDATION_ERROR", "Subtotal komponen melewati batas.");
      }
    const duplicate = after.code
      ? await tx.query.itemPriceLibrary.findFirst({
          where: and(
            eq(itemPriceLibrary.tenantId, INSTANCE_TENANT_ID),
            eq(itemPriceLibrary.code, after.code),
            before ? ne(itemPriceLibrary.id, before.id) : undefined,
          ),
        })
      : null;
    if (duplicate) throw new CatalogSettingsError("CONFLICT", "Kode item library sudah digunakan.");
    const beforeMaterial = before?.materialId
      ? await tx.query.materialMaster.findFirst({
          where: and(
            eq(materialMaster.id, before.materialId),
            eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
          ),
          columns: { name: true },
        })
      : null;
    const beforeCategory = before
      ? await tx.query.expenseCategory.findFirst({
          where: eq(expenseCategory.id, before.expenseCategoryId),
          columns: { name: true },
        })
      : null;
    const beforeVendor = before?.defaultVendorId
      ? await tx.query.vendor.findFirst({
          where: and(
            eq(vendor.id, before.defaultVendorId),
            eq(vendor.tenantId, INSTANCE_TENANT_ID),
          ),
          columns: { name: true },
        })
      : null;
    snapshot.push(
      before ?? null,
      oldComponents,
      category,
      mat,
      vendors,
      beforeMaterial,
      beforeCategory,
      beforeVendor,
    );
    entityName = after.name;
    meta = `${category.name} · ${formatBusinessLabel(after.itemType ?? "")} · ${after.unit}`;
    rows = [
      {
        id: before?.id ?? "library-new",
        title: after.name,
        meta,
        amount: Number(after.defaultClientPrice ?? before?.defaultClientPrice ?? 0),
        comparisons: [
          {
            label: "Biaya internal / satuan",
            before: Number(before?.defaultInternalCost ?? 0),
            after: Number(after.defaultInternalCost ?? before?.defaultInternalCost ?? 0),
            money: true,
          },
          {
            label: "Harga jual / satuan",
            before: Number(before?.defaultClientPrice ?? 0),
            after: Number(after.defaultClientPrice ?? before?.defaultClientPrice ?? 0),
            money: true,
          },
        ],
        details: changes(before ?? null, after, {
          name: "Nama",
          code: "Kode",
          itemCategory: "Kategori item",
          description: "Deskripsi",
          unit: "Satuan",
          isActive: "Status",
          pricingMode: "Mode harga",
          targetGrossPercentage: "Target gross",
          sourceNote: "Sumber harga",
          effectiveFrom: "Berlaku mulai",
        }),
      },
    ];
    if (rows[0])
      rows[0].details.push(
        fact("Kategori expense · sebelumnya", beforeCategory?.name ?? "—"),
        fact("Kategori expense · sesudah", category.name),
        fact("Material · sebelumnya", beforeMaterial?.name ?? "Tanpa material"),
        fact("Material · sesudah", mat?.name ?? "Tanpa material"),
        fact("Vendor default · sebelumnya", beforeVendor?.name ?? "Tanpa vendor"),
        fact(
          "Vendor default · sesudah",
          vendors.find((v) => v.id === after.defaultVendorId)?.name ?? "Tanpa vendor",
        ),
      );
    if (input.action === "PRICING_TEMPLATE_SAVE") {
      const t = input.payload;
      rows.push(
        ...t.components.map((c, index): Row => {
          const old = c.id ? oldComponents.find((o) => o.id === c.id) : undefined;
          return {
            id: c.id ?? `new-${index}`,
            title: c.label,
            meta: `${formatBusinessLabel(c.componentType)} · ${c.quantity.toLocaleString("id-ID")} ${c.unit}`,
            amount: roundMoney(c.quantity * c.unitCost),
            comparisons: [
              {
                label: "Jumlah komponen",
                before: Number(old?.quantity ?? 0),
                after: c.quantity,
                money: false,
              },
              {
                label: "Biaya per satuan",
                before: Number(old?.unitCost ?? 0),
                after: c.unitCost,
                money: true,
              },
              {
                label: "Subtotal biaya",
                before: Number(old?.totalCost ?? 0),
                after: roundMoney(c.quantity * c.unitCost),
                money: true,
              },
            ],
            details: [
              fact("Hasil", old ? "Komponen diperbarui" : "Komponen baru"),
              fact("Jumlah", c.quantity),
              fact("Nama sebelumnya", old?.label ?? "—"),
              fact("Satuan sebelumnya", old?.unit ?? "—"),
              fact("Satuan sesudah", c.unit),
              fact("Biaya per satuan", c.unitCost, true),
              fact("Vendor", vendors.find((v) => v.id === c.vendorId)?.name ?? "Tanpa vendor"),
              fact("Catatan", c.note ?? "—"),
            ],
          };
        }),
      );
      rows.push(
        ...oldComponents
          .filter((c) => !t.components.some((n) => n.id === c.id))
          .map((c): Row => ({
            id: `removed-${c.id}`,
            title: c.label,
            meta: "Komponen dihapus dari template",
            amount: null,
            comparisons: [
              { label: "Subtotal biaya", before: Number(c.totalCost), after: 0, money: true },
            ],
            details: [fact("Hasil", "Dihapus")],
          })),
      );
    }
    summary = [
      fact(
        "Biaya internal",
        Number(after.defaultInternalCost ?? before?.defaultInternalCost ?? 0),
        true,
      ),
      fact("Harga jual", Number(after.defaultClientPrice ?? before?.defaultClientPrice ?? 0), true),
      fact("Hasil", after.isActive ? "Item aktif" : "Item nonaktif"),
      ...(input.action === "PRICING_TEMPLATE_SAVE"
        ? [
            fact("Komponen setelah", input.payload.components.length),
            fact(
              "Target gross",
              `${(input.payload.targetGrossPercentage * 100).toLocaleString("id-ID")}%`,
            ),
          ]
        : []),
    ];
    effect =
      input.action === "PRICING_TEMPLATE_SAVE"
        ? "Menyimpan seluruh template beserta komponen biaya yang ditinjau. Komponen lama yang tidak dipertahankan akan dihapus dari template. Harga ini menjadi referensi untuk input berikutnya; RAP/RAB, tagihan, budget dan kas tersimpan tetap."
        : "Memperbarui library untuk input berikutnya. Komponen biaya dan metadata template yang tidak diubah dipertahankan. RAP/RAB, tagihan, budget dan kas tersimpan tetap.";
  }
  return catalogSettingsProposalSchema.parse({
    kind: "CATALOG_SETTINGS",
    action: input.action,
    input,
    title: titles[input.action],
    entityName,
    meta,
    effect,
    rows,
    summary,
    contextHash: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
  });
}
export async function writeCatalogSettingsTx(
  tx: CatalogTx,
  actor: Actor,
  raw: unknown,
): Promise<string> {
  const input = catalogSettingsInputSchema.parse(raw);
  await prepareCatalogSettingsTx(tx, actor, input);
  let id = "";
  if (input.action === "VENDOR_CREATE")
    return (await createVendorTx(tx, actor.userId, vendorValues(null, input))).id;
  if (input.action === "VENDOR_EDIT" || input.action === "VENDOR_STATUS") {
    const before = await tx.query.vendor.findFirst({ where: eq(vendor.id, input.vendorId) });
    if (!before) throw new CatalogSettingsError("NOT_FOUND", "Vendor tidak tersedia.");
    const [saved] = await tx
      .update(vendor)
      .set({ ...vendorValues(before, input), updatedAt: new Date() })
      .where(eq(vendor.id, before.id))
      .returning();
    id = saved.id;
    await audit(
      tx,
      actor,
      input.action === "VENDOR_STATUS" ? "SET_VENDOR_ACTIVE" : "UPDATE_VENDOR",
      "vendor",
      id,
      before,
      saved,
    );
  } else if (input.action === "INVENTORY_DEFAULTS" || input.action === "INVENTORY_VALUATION") {
    const before = await tx.query.materialInventory.findFirst({
      where: eq(materialInventory.id, input.materialInventoryId),
    });
    if (!before) throw new CatalogSettingsError("NOT_FOUND", "Inventory tidak tersedia.");
    const values =
      input.action === "INVENTORY_DEFAULTS"
        ? {
            minimumStock: input.minimumStock.toFixed(2),
            lastPurchasePrice: input.lastPurchasePrice.toFixed(2),
          }
        : { averageCost: input.averageCost.toFixed(2) };
    const [saved] = await tx
      .update(materialInventory)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(materialInventory.id, before.id))
      .returning();
    id = saved.id;
    if (input.action === "INVENTORY_VALUATION" && saved.averageCost !== before.averageCost)
      await tx.insert(stockMovement).values({
        materialId: before.materialId,
        inventoryLocationId: before.locationId,
        movementType: "INVENTORY_REVALUATION",
        movementDirection: "NEUTRAL",
        referenceType: "MATERIAL_INVENTORY",
        referenceId: id,
        quantity: before.currentStock,
        unitCost: saved.averageCost,
        note: input.reason,
        createdById: actor.userId,
      });
    await audit(
      tx,
      actor,
      input.action === "INVENTORY_VALUATION"
        ? "REVALUE_MATERIAL_INVENTORY"
        : "UPDATE_MATERIAL_SETTING_DEFAULTS",
      "material_inventory",
      id,
      before,
      { ...saved, ...(input.action === "INVENTORY_VALUATION" ? { reason: input.reason } : {}) },
    );
  } else {
    const key =
      input.action === "LIBRARY_CREATE"
        ? undefined
        : input.action === "PRICING_TEMPLATE_SAVE"
          ? input.payload.itemPriceLibraryId
          : input.itemPriceLibraryId;
    const before = key
      ? await tx.query.itemPriceLibrary.findFirst({ where: eq(itemPriceLibrary.id, key) })
      : null;
    const oldComponents = before
      ? await tx.query.itemPriceLibraryCostComponent.findMany({
          where: eq(itemPriceLibraryCostComponent.itemPriceLibraryId, before.id),
        })
      : [];
    const values = {
      ...libraryValues(before ?? null, input),
      updatedById: actor.userId,
      updatedAt: new Date(),
    };
    const [saved] = before
      ? await tx
          .update(itemPriceLibrary)
          .set(values)
          .where(eq(itemPriceLibrary.id, before.id))
          .returning()
      : await tx.insert(itemPriceLibrary).values(values).returning();
    id = saved.id;
    if (input.action === "PRICING_TEMPLATE_SAVE") {
      await tx
        .delete(itemPriceLibraryCostComponent)
        .where(eq(itemPriceLibraryCostComponent.itemPriceLibraryId, id));
      await tx.insert(itemPriceLibraryCostComponent).values(
        input.payload.components.map((c, index) => ({
          ...(c.id ? { id: c.id } : {}),
          itemPriceLibraryId: id,
          vendorId: c.vendorId ?? null,
          componentType: c.componentType,
          label: c.label,
          quantity: c.quantity.toFixed(2),
          unit: c.unit,
          unitCost: c.unitCost.toFixed(2),
          totalCost: roundMoney(c.quantity * c.unitCost).toFixed(2),
          note: c.note ?? null,
          displayOrder: c.displayOrder ?? index,
        })),
      );
    }
    await audit(
      tx,
      actor,
      input.action === "PRICING_TEMPLATE_SAVE"
        ? before
          ? "UPDATE_PRICING_TEMPLATE"
          : "CREATE_PRICING_TEMPLATE"
        : input.action === "LIBRARY_ARCHIVE"
          ? "ARCHIVE_ITEM_PRICE_LIBRARY_ITEM"
          : input.action === "LIBRARY_STATUS"
            ? "SET_ITEM_PRICE_LIBRARY_ITEM_ACTIVE"
            : before
              ? "UPDATE_ITEM_PRICE_LIBRARY_ITEM"
              : "CREATE_ITEM_PRICE_LIBRARY_ITEM",
      "item_price_library",
      id,
      { ...before, components: oldComponents },
      {
        ...saved,
        ...(input.action === "PRICING_TEMPLATE_SAVE"
          ? { components: input.payload.components }
          : {}),
      },
    );
  }
  return id;
}
async function audit(
  tx: CatalogTx,
  actor: Actor,
  action: string,
  table: string,
  id: string,
  before: unknown,
  after: unknown,
): Promise<void> {
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action,
    targetTable: table,
    targetId: id,
    originalState: before ? JSON.stringify(before) : null,
    newState: JSON.stringify(after),
  });
}
export async function prepareCatalogSettingsProposal(
  actor: Actor,
  raw: unknown,
): Promise<CatalogSettingsProposal> {
  return db.transaction((tx) => prepareCatalogSettingsTx(tx, actor, raw));
}
