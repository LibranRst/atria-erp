import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, pool } from "../src/backend/db";
import {
  user,
  role,
  rolePermission,
  materialCategory,
  materialMaster,
  inventoryLocation,
  materialInventory,
  aiConversation,
  aiMessage,
  stockMovement,
  auditLog,
  aiProposalConfirmation,
  cashTransaction,
  projectExpenses,
  projectBudgets,
  projectBudgetCategory,
  bankAccount,
} from "../src/backend/db/schema";
import { getRoleAccess } from "../src/backend/lib/auth/role-access";
import type { Actor } from "../src/backend/server/actor";
import { prepareProcurementWarehouseProposal } from "../src/backend/server/usecases/ai/procurement-warehouse-context";
import { stockCorrectionInputSchema } from "@atria/core/ai/procurement-warehouse";
const target = new URL(process.env.ATRIA_TEST_DATABASE_URL ?? "http://invalid");
if (
  target.hostname !== "127.0.0.1" ||
  target.port !== "32774" ||
  target.pathname !== "/atria_audit_reconciliation" ||
  process.env.NODE_ENV === "production"
)
  throw Error("Named disposable Browser database only");
const qa = await db.query.user.findFirst({
  where: eq(user.email, "reconciliation-qa@fixture.invalid"),
});
if (!qa) throw Error("Synthetic actor only");
const r = await db.query.role.findFirst({ where: eq(role.id, qa.roleId) });
if (!r || r.isSystem || !r.name.startsWith("QA Rekonsiliasi ")) throw Error("Synthetic role only");
const path = "/tmp/atria-stock-correction-preview.json",
  schema = z.object({
    conversationId: z.string().guid(),
    locationId: z.string().guid(),
    items: z.array(z.object({ materialId: z.string().guid(), inventoryId: z.string().guid() })),
  });
const mode = z.enum(["seed", "snapshot", "fresh", "stale", "expired"]).parse(process.argv[2]);
if (mode === "seed" && !existsSync(path)) {
  await db
    .insert(rolePermission)
    .values({ roleId: r.id, permissionKey: "adjust:stock" })
    .onConflictDoNothing();
  const [c] = await db
    .insert(aiConversation)
    .values({ userId: qa.id, title: "QA koreksi stok · data sintetis" })
    .returning();
  const [l] = await db
    .insert(inventoryLocation)
    .values({ name: "Gudang QA · Koreksi stok" })
    .returning();
  const [mc] = await db
    .insert(materialCategory)
    .values({ name: `QA Koreksi ${crypto.randomUUID().slice(0, 8)}` })
    .returning();
  const items: { materialId: string; inventoryId: string }[] = [];
  for (const name of [
    "Panel MDF 18 mm",
    "Tripleks 9 mm",
    "Lem putih",
    "HPL putih doff",
    "Sekrup drywall",
    "Engsel kabinet",
  ]) {
    const [m] = await db
      .insert(materialMaster)
      .values({
        categoryId: mc.id,
        name: `${name} · QA koreksi`,
        unit:
          name === "Lem putih"
            ? "kg"
            : name.includes("Sekrup") || name.includes("Engsel")
              ? "pcs"
              : "lembar",
      })
      .returning();
    const [i] = await db
      .insert(materialInventory)
      .values({
        materialId: m.id,
        locationId: l.id,
        currentStock: "100.00",
        reservedStock: "15.00",
        averageCost: "18500.00",
        lastPurchasePrice: "19000.00",
        minimumStock: "10.00",
      })
      .returning();
    items.push({ materialId: m.id, inventoryId: i.id });
  }
  writeFileSync(path, JSON.stringify({ conversationId: c.id, locationId: l.id, items }));
}
const f = schema.parse(JSON.parse(readFileSync(path, "utf8")));
const conv = await db.query.aiConversation.findFirst({
  where: and(eq(aiConversation.id, f.conversationId), eq(aiConversation.userId, qa.id)),
});
if (conv?.title !== "QA koreksi stok · data sintetis") throw Error("Synthetic conversation only");
if (mode === "seed") {
  const receipt = await db.query.aiProposalConfirmation.findFirst({
    where: eq(aiProposalConfirmation.conversationId, conv.id),
    columns: { id: true },
  });
  if (!receipt) {
    const messages = await db.query.aiMessage.findMany({
      where: eq(aiMessage.conversationId, conv.id),
    });
    for (const message of messages)
      if (
        message.role === "assistant" &&
        Array.isArray(message.parts) &&
        message.parts.some(
          (part: unknown) =>
            typeof part === "object" &&
            part !== null &&
            "type" in part &&
            part.type === "tool-proposeStockCorrection",
        )
      )
        await db.delete(aiMessage).where(eq(aiMessage.id, message.id));
  }
}
if (mode === "snapshot") {
  const protect = await Promise.all([
    db.select().from(cashTransaction),
    db.select().from(projectExpenses),
    db.select().from(projectBudgets),
    db.select().from(projectBudgetCategory),
    db.select().from(bankAccount),
  ]);
  const protectedHash = createHash("sha256")
    .update(
      JSON.stringify(protect.map((rows) => rows.toSorted((a, b) => a.id.localeCompare(b.id)))),
    )
    .digest("hex");
  const inventories = await Promise.all(
    f.items.map((i) =>
      db.query.materialInventory.findFirst({ where: eq(materialInventory.id, i.inventoryId) }),
    ),
  );
  const movements = await Promise.all(
    f.items.map((i) =>
      db.query.stockMovement.findMany({ where: eq(stockMovement.materialId, i.materialId) }),
    ),
  );
  const audits = await Promise.all(
    f.items.map((i) =>
      db.query.auditLog.findMany({
        where: and(
          eq(auditLog.targetId, i.inventoryId),
          eq(auditLog.action, "ADJUST_MATERIAL_STOCK"),
        ),
      }),
    ),
  );
  const receipts = await db.query.aiProposalConfirmation.findMany({
    where: and(
      eq(aiProposalConfirmation.conversationId, f.conversationId),
      eq(aiProposalConfirmation.proposalType, "PROCUREMENT_WAREHOUSE"),
    ),
  });
  console.log(
    JSON.stringify({
      protectedHash,
      inventories: inventories.map((i) => ({
        id: i?.id,
        current: i?.currentStock,
        reserved: i?.reservedStock,
        averageCost: i?.averageCost,
        lastPurchasePrice: i?.lastPurchasePrice,
      })),
      movements: movements.flat().length,
      audits: audits.flat().length,
      receipts: receipts.length,
    }),
  );
} else {
  const access = await getRoleAccess(r.id);
  if (!access) throw Error("access");
  const actor: Actor = {
    userId: qa.id,
    roleId: r.id,
    roleName: access.roleName,
    permissions: access.permissions,
    dataScope: access.dataScope,
    name: qa.name,
    email: qa.email,
    isActive: true,
    mustChangePassword: false,
    sessionId: "fixture",
    developerActorUserId: null,
  };
  const kinds = mode === "seed" ? ["single", "batch"] : [mode];
  for (const kind of kinds) {
    const items = (kind === "batch" ? f.items : f.items.slice(0, 1)).map((i, n) => ({
      materialId: i.materialId,
      direction: n % 2 ? "INCREASE" : "DECREASE",
      quantity: n % 2 ? 4 : 2.5,
    }));
    const input = stockCorrectionInputSchema.parse({
      action: "STOCK_CORRECT",
      inventoryLocationId: f.locationId,
      reason: "Perbaiki pencatatan jumlah saat pemindahan barang; contoh pengujian sintetis.",
      items,
    });
    const p = await prepareProcurementWarehouseProposal(actor, input);
    if (kind === "stale") p.contextHash = "0".repeat(64);
    const toolCallId = crypto.randomUUID();
    await db.insert(aiMessage).values({
      conversationId: conv.id,
      role: "assistant",
      createdAt: kind === "expired" ? new Date(Date.now() - 31 * 86400000) : new Date(),
      parts: [
        {
          type: "text",
          text: `Data sintetis QA · ${kind === "batch" ? "koreksi enam material" : "koreksi satu material"}. Periksa stok sebelum dan sesudah; perubahan diterapkan hanya melalui tombol konfirmasi.`,
        },
        {
          type: "tool-proposeStockCorrection",
          toolCallId,
          state: "output-available",
          input,
          output: { proposal: p },
        },
      ],
    });
    console.log(JSON.stringify({ kind, conversationId: conv.id, toolCallId }));
  }
  await db
    .update(aiConversation)
    .set({ updatedAt: new Date() })
    .where(eq(aiConversation.id, conv.id));
}
await pool.end();
