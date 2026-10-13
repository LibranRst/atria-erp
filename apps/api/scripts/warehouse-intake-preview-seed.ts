/** Real owned proposal fixtures, restricted to the existing disposable Browser database. */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/backend/db";
import {
  user,
  rolePermission,
  client,
  project,
  expenseCategory,
  projectBudgets,
  projectBudgetCategory,
  materialCategory,
  materialMaster,
  materialInventory,
  inventoryLocation,
  aiConversation,
  aiMessage,
} from "../src/backend/db/schema";
import { getRoleAccess } from "../src/backend/lib/auth/role-access";
import { prepareProcurementWarehouseProposal } from "../src/backend/server/usecases/ai/procurement-warehouse-context";
import {
  createInventoryOpeningTx,
  decideInventoryOpeningTx,
} from "../src/backend/server/usecases/material/opening-inventory-writer";
import type { Actor } from "../src/backend/server/actor";
import type { PermissionKey } from "@atria/core/auth/permissions";
import {
  warehouseIntakeInputSchema,
  type WarehouseIntakeInput,
} from "@atria/core/ai/procurement-warehouse";
const target = new URL(process.env.ATRIA_TEST_DATABASE_URL ?? "http://invalid");
if (
  target.protocol !== "postgresql:" ||
  target.hostname !== "127.0.0.1" ||
  target.port !== "32774" ||
  target.pathname !== "/atria_audit_reconciliation" ||
  process.env.NODE_ENV === "production"
)
  throw new Error("Only the named disposable Browser database is allowed.");
const qa = await db.query.user.findFirst({
  where: eq(user.email, "reconciliation-qa@fixture.invalid"),
});
if (!qa?.roleId) throw new Error("Existing synthetic Browser user is required.");
const permissions: readonly PermissionKey[] = [
  "use:ai_chat",
  "view:material",
  "view:inventory",
  "view:budget",
  "view:project",
  "create:stock_movement",
  "create:opening_inventory",
  "approve:opening_inventory",
  "reverse:opening_inventory",
];
await db
  .insert(rolePermission)
  .values(permissions.map((permissionKey) => ({ roleId: qa.roleId, permissionKey })))
  .onConflictDoNothing();
const access = await getRoleAccess(qa.roleId);
if (!access) throw new Error("QA access missing.");
const actor: Actor = {
  userId: qa.id,
  roleId: qa.roleId,
  roleName: access.roleName,
  name: qa.name,
  email: qa.email,
  isActive: true,
  mustChangePassword: false,
  sessionId: randomUUID(),
  permissions: access.permissions,
  dataScope: access.dataScope,
  developerActorUserId: null,
};
const prefix = randomUUID().slice(0, 8),
  today = "2026-10-11";
const [cl] = await db
  .insert(client)
  .values({
    name: "Klien QA Gudang",
    email: `warehouse-${prefix}@fixture.invalid`,
    phone: "000000",
  })
  .returning();
const [proj] = await db
  .insert(project)
  .values({
    name: "Proyek QA · Penerimaan material",
    clientId: cl.id,
    status: "ACTIVE",
    totalContractValue: "1000000000.00",
  })
  .returning();
const [b] = await db
  .insert(projectBudgets)
  .values({
    projectId: proj.id,
    contractValue: "1000000000.00",
    internalBudget: "900000000.00",
    budgetCapRatio: "0.9000",
    targetGrossPercentage: "10.00",
  })
  .returning();
let category = await db.query.expenseCategory.findFirst({
  where: eq(expenseCategory.code, "MATERIAL"),
});
if (!category)
  [category] = await db
    .insert(expenseCategory)
    .values({ name: "Material", code: "MATERIAL" })
    .returning();
await db.insert(projectBudgetCategory).values({
  projectBudgetId: b.id,
  expenseCategoryId: category.id,
  ratioPercentage: "0.3500",
  allocatedAmount: "315000000.00",
  actualAmount: "0.00",
  remainingAmount: "315000000.00",
});
const [mc] = await db
  .insert(materialCategory)
  .values({ name: `Material QA gudang ${prefix}` })
  .returning();
const names = [
  "Multipleks 18 mm",
  "HPL putih matte",
  "Lem kuning",
  "Engsel soft close",
  "Rel laci tandem",
  "Sekrup kayu",
];
async function inventory(
  label: string,
  size: number,
  stock = "0.00",
): Promise<{
  locationId: string;
  items: { materialId: string; inventoryId: string; quantity: number; unitCost: number }[];
}> {
  const [l] = await db
    .insert(inventoryLocation)
    .values({ name: `${label} · ${prefix}` })
    .returning();
  const items = [];
  for (let i = 0; i < size; i++) {
    const [m] = await db
      .insert(materialMaster)
      .values({
        categoryId: mc.id,
        name: names[i % names.length],
        unit: ["lembar", "lembar", "kaleng", "pasang", "set", "kotak"][i % names.length]!,
        code: `QA-${prefix}-${label.slice(0, 3)}-${i}`,
      })
      .returning();
    const [inv] = await db
      .insert(materialInventory)
      .values({
        materialId: m.id,
        locationId: l.id,
        currentStock: stock,
        averageCost: stock === "0.00" ? "0.00" : "100000.00",
      })
      .returning();
    items.push({
      materialId: m.id,
      inventoryId: inv.id,
      quantity: i + 2,
      unitCost: 125000 + i * 15000,
    });
  }
  return { locationId: l.id, items };
}
const receipt = await inventory("Gudang QA · penerimaan proyek", 6, "5.00"),
  incoming = await inventory("Gudang QA · stok perusahaan", 6, "10.00"),
  opening = await inventory("Gudang QA · saldo awal", 3),
  pendingApprove = await inventory("Gudang QA · persetujuan saldo awal", 3),
  pendingReject = await inventory("Gudang QA · penolakan saldo awal", 2),
  postedReverse = await inventory("Gudang QA · pembatalan saldo awal", 2),
  single = await inventory("Gudang QA · penerimaan satu material", 1, "10.00");
const [otherUser] = await db
  .insert(user)
  .values({
    name: "Pembuat QA · data sintetis",
    email: `warehouse-maker-${prefix}@fixture.invalid`,
    roleId: qa.roleId,
    isActive: true,
    mustChangePassword: false,
  })
  .returning();
const other: Actor = {
  ...actor,
  userId: otherUser.id,
  name: otherUser.name,
  email: otherUser.email,
};
async function request(label: string, f: Awaited<ReturnType<typeof inventory>>): Promise<string> {
  return (
    await db.transaction((tx) =>
      createInventoryOpeningTx(tx, other, {
        batchNumber: `SA-QA-${label}-${prefix}`,
        cutoverDate: new Date(today),
        referenceNumber: `OPNAME-QA-${prefix}`,
        note: "Hasil penghitungan stok awal · data sintetis",
        items: f.items.map((i) => ({
          materialInventoryId: i.inventoryId,
          quantity: i.quantity,
          unitCost: i.unitCost,
        })),
      }),
    )
  ).id;
}
const approveId = await request("SETUJUI", pendingApprove),
  rejectId = await request("TOLAK", pendingReject),
  reverseId = await request("BALIK", postedReverse);
await db.transaction((tx) =>
  decideInventoryOpeningTx(tx, actor, {
    batchId: reverseId,
    decision: "APPROVE",
    reason: "Hasil opname QA diverifikasi",
    emergencyOverride: false,
  }),
);
const emptyLocation = await inventory("Gudang QA · lokasi baru", 1);
await db
  .delete(materialInventory)
  .where(eq(materialInventory.id, emptyLocation.items[0]!.inventoryId));
const inputs: WarehouseIntakeInput[] = [
  warehouseIntakeInputSchema.parse({
    action: "PROJECT_RECEIPT",
    projectId: proj.id,
    inventoryLocationId: receipt.locationId,
    receiptNumber: `SJ-QA-PROYEK-${prefix}`,
    receivedAt: today,
    note: "Surat jalan pemasok · data sintetis",
    items: receipt.items.map(({ materialId, quantity, unitCost }) => ({
      materialId,
      quantity,
      unitCost,
    })),
  }),
  warehouseIntakeInputSchema.parse({
    action: "WAREHOUSE_STOCK_IN",
    inventoryLocationId: incoming.locationId,
    referenceNumber: `SJ-QA-GUDANG-${prefix}`,
    receivedAt: today,
    note: "Stok masuk perusahaan · data sintetis",
    items: incoming.items.map(({ materialId, quantity, unitCost }) => ({
      materialId,
      quantity,
      unitCost,
    })),
  }),
  warehouseIntakeInputSchema.parse({
    action: "OPENING_REQUEST",
    batchNumber: `SA-QA-BARU-${prefix}`,
    referenceNumber: `OPNAME-QA-${prefix}`,
    cutoverDate: today,
    note: "Hasil penghitungan stok awal · data sintetis",
    items: opening.items.map((i) => ({
      materialInventoryId: i.inventoryId,
      quantity: i.quantity,
      unitCost: i.unitCost,
    })),
  }),
  {
    action: "OPENING_APPROVE",
    batchId: approveId,
    reason: "Seluruh jumlah dan harga pokok telah diperiksa",
  },
  {
    action: "OPENING_REJECT",
    batchId: rejectId,
    reason: "Dokumen pendukung penghitungan belum lengkap",
  },
  {
    action: "OPENING_REVERSE",
    batchId: reverseId,
    reason: "Pengajuan memakai lokasi gudang yang keliru",
  },
  warehouseIntakeInputSchema.parse({
    action: "WAREHOUSE_STOCK_IN",
    inventoryLocationId: single.locationId,
    referenceNumber: `SJ-QA-SATU-${prefix}`,
    receivedAt: today,
    note: "Penerimaan satu material · data sintetis",
    items: single.items.map(({ materialId, quantity, unitCost }) => ({
      materialId,
      quantity,
      unitCost,
    })),
  }),
  warehouseIntakeInputSchema.parse({
    action: "WAREHOUSE_STOCK_IN",
    inventoryLocationId: emptyLocation.locationId,
    referenceNumber: `SJ-QA-BARU-${prefix}`,
    receivedAt: today,
    note: "Penerimaan ke lokasi baru · data sintetis",
    items: emptyLocation.items.map(({ materialId, quantity, unitCost }) => ({
      materialId,
      quantity,
      unitCost,
    })),
  }),
];
const [conversation] = await db
  .insert(aiConversation)
  .values({ userId: qa.id, title: "QA penerimaan & stok gudang · database disposable" })
  .returning();
await db.insert(aiMessage).values({
  conversationId: conversation.id,
  role: "user",
  parts: [
    {
      type: "text",
      text: "Tampilkan contoh penerimaan proyek, stok masuk gudang, pengajuan/approval/penolakan/pembatalan saldo awal dan penerimaan satu material. Ini data sintetis untuk uji UI dan transaksi di database disposable.",
    },
  ],
});
const parts: unknown[] = [
  {
    type: "text",
    text: "Seluruh contoh memakai preview tersimpan dan backend nyata. Setiap batch memiliki sumber terpisah; penerimaan dan saldo awal tidak membuat pembayaran atau realisasi budget.",
  },
];
for (const input of inputs)
  parts.push({
    type: "tool-proposeWarehouseIntake",
    toolCallId: randomUUID(),
    state: "output-available",
    input,
    output: { proposal: await prepareProcurementWarehouseProposal(actor, input) },
  });
await db.insert(aiMessage).values({ conversationId: conversation.id, role: "assistant", parts });
console.info(
  JSON.stringify({
    conversationId: conversation.id,
    projectId: proj.id,
    fixturePrefix: prefix,
    proposals: inputs.length,
  }),
);
await pool.end();
