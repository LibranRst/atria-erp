import { beforeAll, beforeEach, afterAll, expect, test, spyOn } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, eq, count } from "drizzle-orm";
import { db } from "@backend/db";
import {
  role,
  rolePermission,
  user,
  vendor,
  expenseCategory,
  materialCategory,
  materialMaster,
  inventoryLocation,
  materialInventory,
  itemPriceLibrary,
  itemPriceLibraryCostComponent,
  stockMovement,
  auditLog,
  cashTransaction,
  aiConversation,
  aiMessage,
  aiProposalConfirmation,
} from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { withTestRequest } from "@backend/lib/testing/request";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { resolveActor, type Actor } from "@backend/server/actor";
import * as writers from "@backend/server/usecases/settings/catalog-settings-writer";
import {
  catalogSettingsInputSchema,
  type CatalogSettingsInput,
} from "@atria/core/ai/catalog-settings";
import type { PermissionKey } from "@atria/core/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";
import { getAiCatalogSettingsProposal, confirmAiCatalogSettingsProposal } from "./catalog-settings";
import { saveVendor, setVendorActive } from "@backend/app/actions/administration-vendors";
import {
  createItemPriceLibraryItem,
  updateItemPriceLibraryItem,
  setItemPriceLibraryItemActive,
  archiveItemPriceLibraryItem,
} from "@backend/app/actions/settings/system-item-library";
import { upsertPricingTemplate } from "@backend/app/actions/settings/pricing-library";
import {
  updateMaterialSettingDefaults,
  updateMaterialInventoryDefaults,
} from "@backend/app/actions/settings/system-materials";
import { buildCatalogSettingsTools } from "@backend/lib/ai/tools/catalog-settings-tools";
const prefix = `CATALOGAI-${randomUUID().slice(0, 8)}`,
  grants: PermissionKey[] = [
    "use:ai_chat",
    "manage:vendors",
    "manage:item_library",
    "manage:material_settings",
  ];
type Person = {
  id: string;
  roleId: string;
  name: string;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
};
const api = auth.api as unknown as { getSession: unknown },
  original = api.getSession;
let owner: Person, limited: Person, categoryId: string, materialId: string, inventoryId: string;
function as(p: Person | null): void {
  api.getSession = async () =>
    p
      ? {
          user: p,
          session: { id: randomUUID(), userId: p.id, expiresAt: new Date(Date.now() + 3600000) },
        }
      : null;
}
function ok<T>(r: ActionResponse<T>): T {
  if (!r.success) throw new Error(r.error.message);
  return r.data;
}
async function person(permissions: PermissionKey[]): Promise<Person> {
  const [r] = await db
    .insert(role)
    .values({ name: `${prefix}-${randomUUID().slice(0, 6)}`, dataScope: "NONE" })
    .returning();
  if (permissions.length)
    await db
      .insert(rolePermission)
      .values(permissions.map((permissionKey) => ({ roleId: r.id, permissionKey })));
  const [p] = await db
    .insert(user)
    .values({
      name: r.name,
      email: `${randomUUID()}@fixture.invalid`,
      roleId: r.id,
      isActive: true,
      mustChangePassword: false,
    })
    .returning();
  return {
    id: p.id,
    roleId: r.id,
    name: p.name,
    email: p.email,
    isActive: true,
    mustChangePassword: false,
  };
}
async function actor(): Promise<Actor> {
  const a = await withTestRequest(resolveActor)();
  if (!a) throw new Error("No Actor");
  return a;
}
const read = withTestRequest(getAiCatalogSettingsProposal),
  save = withTestRequest(confirmAiCatalogSettingsProposal);
async function proof(raw: unknown) {
  const input = catalogSettingsInputSchema.parse(raw),
    a = await actor(),
    proposal = await writers.prepareCatalogSettingsProposal(a, input),
    toolCallId = randomUUID();
  const [c] = await db
    .insert(aiConversation)
    .values({ userId: a.userId, title: prefix })
    .returning();
  const [m] = await db
    .insert(aiMessage)
    .values({
      conversationId: c.id,
      role: "assistant",
      parts: [
        {
          type: "tool-proposeCatalogSettings",
          state: "output-available",
          toolCallId,
          output: { proposal },
        },
      ],
    })
    .returning();
  return { identity: { conversationId: c.id, toolCallId }, proposal, messageId: m.id };
}
function template(itemPriceLibraryId?: string): CatalogSettingsInput {
  return catalogSettingsInputSchema.parse({
    action: "PRICING_TEMPLATE_SAVE",
    payload: {
      itemPriceLibraryId,
      expenseCategoryId: categoryId,
      materialId,
      itemType: "MATERIAL_ITEM",
      itemCategory: "Panel",
      name: `${prefix}-template`,
      unit: "lembar",
      pricingMode: "MARGIN_BASED",
      targetGrossPercentage: 0.2,
      priceSourceType: "VENDOR_QUOTE",
      sourceNote: "Penawaran contoh dari manusia",
      effectiveFrom: "2026-10-10T00:00:00.000Z",
      components: [
        {
          componentType: "MATERIAL",
          label: "Panel utama",
          quantity: 2,
          unit: "lembar",
          unitCost: 40,
        },
        { componentType: "LABOR", label: "Finishing", quantity: 1, unit: "ls", unitCost: 20 },
      ],
    },
  });
}
async function stock() {
  return (await db.query.materialInventory.findFirst({
    where: eq(materialInventory.id, inventoryId),
  }))!;
}
async function cash(): Promise<number> {
  return Number((await db.select({ n: count() }).from(cashTransaction))[0].n);
}
describeIntegration("AI catalog settings", () => {
  beforeAll(async () => {
    owner = await person(grants);
    limited = await person(["use:ai_chat", "manage:material_settings"]);
    const c = await db.query.expenseCategory.findFirst({
      where: eq(expenseCategory.code, "MATERIAL"),
    });
    if (!c) throw new Error("Seed missing");
    categoryId = c.id;
    const [mc] = await db.insert(materialCategory).values({ name: prefix }).returning();
    const [m] = await db
      .insert(materialMaster)
      .values({ name: prefix, categoryId: mc.id, unit: "lembar" })
      .returning();
    materialId = m.id;
    const [l] = await db.insert(inventoryLocation).values({ name: prefix }).returning();
    const [i] = await db
      .insert(materialInventory)
      .values({
        materialId: m.id,
        locationId: l.id,
        currentStock: "10.00",
        reservedStock: "2.00",
        minimumStock: "1.00",
        averageCost: "10.00",
        lastPurchasePrice: "12.00",
      })
      .returning();
    inventoryId = i.id;
  });
  beforeEach(() => as(owner));
  afterAll(() => {
    api.getSession = original;
  });
  test("vendor create/edit/status are permission-scoped, partial and idempotent without changing omitted bank fields", async () => {
    const p = await proof({
      action: "VENDOR_CREATE",
      payload: {
        name: prefix,
        phone: "081234567",
        bankName: "Bank QA",
        bankAccountNumber: "12345",
        bankAccountHolder: "Vendor QA",
        isActive: false,
      },
    });
    expect(ok(await read(p.identity)).status).toBe("READY");
    const replies = await Promise.all([save(p.identity), save(p.identity)]);
    const id = ok(replies[0]).resultId;
    expect(replies.some((r) => r.success && r.data.alreadyConfirmed)).toBe(true);
    const edit = await proof({
      action: "VENDOR_EDIT",
      vendorId: id,
      patch: { phone: "089876543" },
    });
    ok(await save(edit.identity));
    const row = await db.query.vendor.findFirst({ where: eq(vendor.id, id) });
    expect(row?.isActive).toBe(false);
    expect(row?.bankAccountNumber).toBe("12345");
    ok(
      await save((await proof({ action: "VENDOR_STATUS", vendorId: id, isActive: true })).identity),
    );
    ok(await withTestRequest(setVendorActive)({ vendorId: id, isActive: false }));
    const stale = await proof({
      action: "VENDOR_EDIT",
      vendorId: id,
      patch: { name: `${prefix}-changed` },
    });
    ok(
      await withTestRequest(saveVendor)({
        ...row,
        vendorId: id,
        name: prefix,
        phone: "081111111",
        isActive: false,
      }),
    );
    expect((await save(stale.identity)).success).toBe(false);
    as(limited);
    await expect(proof({ action: "VENDOR_STATUS", vendorId: id, isActive: true })).rejects.toThrow(
      "Izin",
    );
  });
  test("pricing template review covers complete components/removals and ordinary library edits preserve breakdowns", async () => {
    const beforeCash = await cash(),
      p = await proof(template());
    const id = ok(await save(p.identity)).resultId;
    let item = await db.query.itemPriceLibrary.findFirst({ where: eq(itemPriceLibrary.id, id) });
    expect(item?.defaultInternalCost).toBe("100.00");
    expect(item?.defaultClientPrice).toBe("125.00");
    const cs = await db.query.itemPriceLibraryCostComponent.findMany({
      where: eq(itemPriceLibraryCostComponent.itemPriceLibraryId, id),
    });
    expect(cs).toHaveLength(2);
    const input = template(id);
    if (input.action !== "PRICING_TEMPLATE_SAVE") throw new Error("wrong input");
    input.payload.components = [
      {
        id: cs[0].id,
        componentType: "MATERIAL",
        label: "Panel dikoreksi",
        quantity: 3,
        unit: "lembar",
        unitCost: 40,
      },
    ];
    const update = await proof(input);
    expect(update.proposal.rows.some((r) => r.meta.includes("dihapus"))).toBe(true);
    ok(await save(update.identity));
    expect(
      await db.query.itemPriceLibraryCostComponent.findMany({
        where: eq(itemPriceLibraryCostComponent.itemPriceLibraryId, id),
      }),
    ).toHaveLength(1);
    const current = await db.query.itemPriceLibrary.findFirst({
      where: eq(itemPriceLibrary.id, id),
    });
    if (!current) throw new Error("missing");
    ok(
      await withTestRequest(updateItemPriceLibraryItem)({
        itemPriceLibraryId: id,
        expenseCategoryId: categoryId,
        materialId,
        itemType: "MATERIAL_ITEM",
        itemCategory: "Panel",
        name: `${prefix}-renamed`,
        unit: "lembar",
        defaultClientPrice: 200,
        defaultInternalCost: 120,
        isActive: true,
      }),
    );
    item = await db.query.itemPriceLibrary.findFirst({ where: eq(itemPriceLibrary.id, id) });
    expect(item?.sourceNote).toBe(current.sourceNote);
    expect(item?.pricingMode).toBe(current.pricingMode);
    expect(
      await db.query.itemPriceLibraryCostComponent.findMany({
        where: eq(itemPriceLibraryCostComponent.itemPriceLibraryId, id),
      }),
    ).toHaveLength(1);
    ok(await save((await proof({ action: "LIBRARY_ARCHIVE", itemPriceLibraryId: id })).identity));
    ok(
      await withTestRequest(setItemPriceLibraryItemActive)({
        itemPriceLibraryId: id,
        isActive: true,
      }),
    );
    expect(await cash()).toBe(beforeCash);
  });
  test("simple library create/edit/status and manual template writer keep signatures and honor live grants", async () => {
    const base = {
      expenseCategoryId: categoryId,
      materialId,
      itemType: "MATERIAL_ITEM" as const,
      itemCategory: "Panel",
      name: `${prefix}-simple`,
      unit: "lembar",
      defaultClientPrice: 20,
      defaultInternalCost: 10,
    };
    const id = ok(
      await save((await proof({ action: "LIBRARY_CREATE", payload: base })).identity),
    ).resultId;
    ok(
      await save(
        (
          await proof({
            action: "LIBRARY_EDIT",
            itemPriceLibraryId: id,
            patch: { defaultClientPrice: 25 },
          })
        ).identity,
      ),
    );
    ok(
      await save(
        (await proof({ action: "LIBRARY_STATUS", itemPriceLibraryId: id, isActive: false }))
          .identity,
      ),
    );
    expect(
      (await db.query.itemPriceLibrary.findFirst({ where: eq(itemPriceLibrary.id, id) }))
        ?.defaultClientPrice,
    ).toBe("25.00");
    ok(await withTestRequest(archiveItemPriceLibraryItem)({ itemPriceLibraryId: id }));
    const ordinary = ok(
      await withTestRequest(createItemPriceLibraryItem)({ ...base, name: `${prefix}-ordinary` }),
    );
    expect(ordinary.id).toBeTruthy();
    const t = template();
    if (t.action !== "PRICING_TEMPLATE_SAVE") throw new Error("wrong");
    ok(
      await withTestRequest(upsertPricingTemplate)({
        ...t.payload,
        name: `${prefix}-manual-template`,
        effectiveFrom: new Date(t.payload.effectiveFrom),
      }),
    );
    const p = await proof({ action: "LIBRARY_STATUS", itemPriceLibraryId: id, isActive: true });
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, owner.roleId),
          eq(rolePermission.permissionKey, "manage:item_library"),
        ),
      );
    try {
      expect((await save(p.identity)).success).toBe(false);
    } finally {
      await db
        .insert(rolePermission)
        .values({ roleId: owner.roleId, permissionKey: "manage:item_library" });
    }
  });
  test("default inventory and separately confirmed valuation preserve quantities/cash and write neutral valuation/audit", async () => {
    const beforeCash = await cash();
    as(limited);
    ok(
      await save(
        (
          await proof({
            action: "INVENTORY_DEFAULTS",
            materialInventoryId: inventoryId,
            minimumStock: 5,
            lastPurchasePrice: 15,
          })
        ).identity,
      ),
    );
    expect((await stock()).averageCost).toBe("10.00");
    const p = await proof({
      action: "INVENTORY_VALUATION",
      materialInventoryId: inventoryId,
      averageCost: 20,
      reason: "Koreksi harga berdasarkan bukti gudang",
    });
    expect(p.proposal.summary.find((f) => f.label === "Perubahan nilai")?.value).toBe(100);
    ok(await save(p.identity));
    expect((await stock()).currentStock).toBe("10.00");
    expect((await stock()).reservedStock).toBe("2.00");
    const movements = await db.query.stockMovement.findMany({
      where: and(
        eq(stockMovement.referenceId, inventoryId),
        eq(stockMovement.movementType, "INVENTORY_REVALUATION"),
      ),
    });
    expect(movements).toHaveLength(1);
    expect(movements[0].movementDirection).toBe("NEUTRAL");
    const stale = await proof({
      action: "INVENTORY_VALUATION",
      materialInventoryId: inventoryId,
      averageCost: 25,
      reason: "Koreksi harga berdasarkan bukti berikutnya",
    });
    ok(
      await withTestRequest(updateMaterialSettingDefaults)({
        materialInventoryId: inventoryId,
        minimumStock: 6,
        lastPurchasePrice: 16,
      }),
    );
    expect((await save(stale.identity)).success).toBe(false);
    ok(
      await withTestRequest(updateMaterialInventoryDefaults)({
        materialInventoryId: inventoryId,
        minimumStock: 6,
        lastPurchasePrice: 16,
        averageCost: 21,
      }),
    );
    expect((await stock()).averageCost).toBe("21.00");
    expect(await cash()).toBe(beforeCash);
  });
  test("ownership, TTL, strict identity, reference drift and whole-writer rollback protect stored proposals", async () => {
    const p = await proof({
      action: "INVENTORY_VALUATION",
      materialInventoryId: inventoryId,
      averageCost: 30,
      reason: "Koreksi nilai untuk uji rollback",
    });
    as(limited);
    expect((await save(p.identity)).success).toBe(false);
    as(owner);
    expect((await save({ ...p.identity, averageCost: 999 })).success).toBe(false);
    const before = await stock(),
      originalWrite = writers.writeCatalogSettingsTx,
      fault = spyOn(writers, "writeCatalogSettingsTx").mockImplementation(
        async (...args: Parameters<typeof originalWrite>) => {
          await originalWrite(...args);
          throw new Error("after-write fault");
        },
      );
    try {
      expect((await save(p.identity)).success).toBe(false);
    } finally {
      fault.mockRestore();
    }
    expect((await stock()).averageCost).toBe(before.averageCost);
    expect(
      await db.query.aiProposalConfirmation.findMany({
        where: eq(aiProposalConfirmation.conversationId, p.identity.conversationId),
      }),
    ).toHaveLength(0);
    expect(
      (await db.query.auditLog.findMany({ where: eq(auditLog.targetId, inventoryId) })).filter(
        (a) => a.newState?.includes("Koreksi nilai untuk uji rollback"),
      ),
    ).toHaveLength(0);
    ok(await save(p.identity));
    const expired = await proof({
      action: "INVENTORY_DEFAULTS",
      materialInventoryId: inventoryId,
      minimumStock: 7,
      lastPurchasePrice: 18,
    });
    await db
      .update(aiMessage)
      .set({ createdAt: new Date(Date.now() - 31 * 86400000) })
      .where(eq(aiMessage.id, expired.messageId));
    expect(ok(await read(expired.identity)).status).toBe("EXPIRED");
    expect((await save(expired.identity)).success).toBe(false);
  });
  test("reference validation rejects wrong category/foreign component, duplicates and inactive new links; lookup masks other management domains", async () => {
    const [v] = await db
      .insert(vendor)
      .values({ name: `${prefix}-inactive`, phone: "000000", isActive: false })
      .returning();
    const t = template();
    if (t.action !== "PRICING_TEMPLATE_SAVE") throw new Error("wrong");
    t.payload.defaultVendorId = v.id;
    await expect(proof(t)).rejects.toThrow("aktif");
    t.payload.defaultVendorId = null;
    t.payload.components[0].id = randomUUID();
    await expect(proof(t)).rejects.toThrow("Komponen");
    as(limited);
    const a = await actor(),
      tools = buildCatalogSettingsTools(a);
    const execute = tools.getCatalogSettingsContext.execute;
    if (!execute) throw new Error("missing");
    const r = await withTestRequest(async () =>
      execute(
        { domain: "vendors", offset: 0 },
        { toolCallId: "lookup", messages: [], context: undefined },
      ),
    )();
    expect(r).toEqual({ error: "Izin pengaturan terkait tidak tersedia." });
  });
});
