import { eq, asc, gte } from "drizzle-orm";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { z } from "zod";
import { db, pool } from "../src/backend/db";
import * as s from "../src/backend/db/schema";

const target = new URL(process.env.ATRIA_TEST_DATABASE_URL ?? "http://invalid");
if (
  target.hostname !== "127.0.0.1" ||
  target.port !== "32774" ||
  target.pathname !== "/atria_audit_reconciliation" ||
  process.env.NODE_ENV === "production"
)
  throw new Error("Named disposable operational QA database only");
const owner = await db.query.user.findFirst({
  where: eq(s.user.email, "ai-role-owner@fixture.invalid"),
});
if (!owner || owner.name !== "QA Role OWNER") throw new Error("Actual synthetic Owner QA required");
const mode = z.enum(["seed", "snapshot", "observe"]).parse(process.argv[2]);
const path = "/tmp/atria-ai-operational-fixture.json";
const fixtureSchema = z.object({
  startedAt: z.string(),
  clientId: z.guid(),
  vendorId: z.guid(),
  materialId: z.guid(),
  locationId: z.guid(),
  accountId: z.guid(),
  ownerId: z.guid(),
  managerId: z.guid(),
});
if (mode === "seed" && !existsSync(path)) {
  const fixture = await db.transaction(async (tx) => {
    const [client] = await tx
      .insert(s.client)
      .values({
        name: "Klien Operasional QA",
        companyName: "QA sintetis",
        phone: "-",
        email: "operational-client@fixture.invalid",
        address: "Fixture",
      })
      .returning();
    const [vendor] = await tx
      .insert(s.vendor)
      .values({
        name: "Vendor Operasional QA",
        phone: "-",
        email: "operational-vendor@fixture.invalid",
        address: "Fixture",
      })
      .returning();
    const [category] = await tx
      .insert(s.materialCategory)
      .values({ name: "Kategori Operasional QA" })
      .returning();
    const [material] = await tx
      .insert(s.materialMaster)
      .values({ name: "Panel Operasional QA", unit: "lembar", categoryId: category.id })
      .returning();
    const [location] = await tx
      .insert(s.inventoryLocation)
      .values({ name: "Gudang Operasional QA" })
      .returning();
    await tx.insert(s.materialInventory).values({
      materialId: material.id,
      locationId: location.id,
      currentStock: "0.00",
      reservedStock: "0.00",
      averageCost: "0.00",
      lastPurchasePrice: "0.00",
    });
    const [account] = await tx
      .insert(s.bankAccount)
      .values({
        name: "Rekening Operasional QA",
        accountNumber: "OPQA-1013",
        bankName: "Bank QA",
        holderName: "Fixture sintetis",
        balance: "2000000.00",
      })
      .returning();
    const manager = await tx.query.user.findFirst({
      where: eq(s.user.email, "ai-role-pm_a@fixture.invalid"),
    });
    if (!manager) throw new Error("Reference PM QA required");
    return {
      startedAt: new Date().toISOString(),
      clientId: client.id,
      vendorId: vendor.id,
      materialId: material.id,
      locationId: location.id,
      accountId: account.id,
      ownerId: owner.id,
      managerId: manager.id,
    };
  });
  writeFileSync(path, JSON.stringify(fixture, null, 2));
}
const fixture = fixtureSchema.parse(JSON.parse(readFileSync(path, "utf8")));
mkdirSync("../../output/ai-chat-qa/operational", { recursive: true });
if (mode === "seed") console.log(JSON.stringify(fixture));
if (mode === "snapshot") {
  const snapshot = {
    projects: await db.select().from(s.project).orderBy(asc(s.project.id)),
    budgets: await db.select().from(s.projectBudgets).orderBy(asc(s.projectBudgets.id)),
    categories: await db
      .select()
      .from(s.projectBudgetCategory)
      .orderBy(asc(s.projectBudgetCategory.id)),
    raps: await db.select().from(s.projectRap).orderBy(asc(s.projectRap.id)),
    rapItems: await db.select().from(s.projectRapItem).orderBy(asc(s.projectRapItem.id)),
    rabs: await db.select().from(s.rabEstimate).orderBy(asc(s.rabEstimate.id)),
    rabItems: await db.select().from(s.rabEstimateItem).orderBy(asc(s.rabEstimateItem.id)),
    accounts: await db.select().from(s.bankAccount).orderBy(asc(s.bankAccount.id)),
    cash: await db.select().from(s.cashTransaction).orderBy(asc(s.cashTransaction.id)),
    bills: await db.select().from(s.vendorBill).orderBy(asc(s.vendorBill.id)),
    payments: await db.select().from(s.vendorPayment).orderBy(asc(s.vendorPayment.id)),
    expenses: await db.select().from(s.projectExpenses).orderBy(asc(s.projectExpenses.id)),
    costs: await db.select().from(s.projectCost).orderBy(asc(s.projectCost.id)),
    inventory: await db.select().from(s.materialInventory).orderBy(asc(s.materialInventory.id)),
    movements: await db.select().from(s.stockMovement).orderBy(asc(s.stockMovement.id)),
    goodsReceipts: await db.select().from(s.goodsReceipt).orderBy(asc(s.goodsReceipt.id)),
    goodsReceiptItems: await db
      .select()
      .from(s.goodsReceiptItem)
      .orderBy(asc(s.goodsReceiptItem.id)),
    statementImports: await db
      .select()
      .from(s.bankStatementImport)
      .orderBy(asc(s.bankStatementImport.id)),
    statementRows: await db.select().from(s.bankStatementRow).orderBy(asc(s.bankStatementRow.id)),
    confirmations: await db
      .select()
      .from(s.aiProposalConfirmation)
      .orderBy(asc(s.aiProposalConfirmation.id)),
    audits: await db
      .select()
      .from(s.auditLog)
      .where(gte(s.auditLog.createdAt, new Date(fixture.startedAt))),
    settings: await db.select().from(s.appConfig).orderBy(asc(s.appConfig.key)),
  };
  const label = z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .parse(process.argv[3] ?? "snapshot");
  writeFileSync(
    `../../output/ai-chat-qa/operational/${label}.json`,
    JSON.stringify(snapshot, null, 2),
  );
  console.log(
    JSON.stringify({
      label,
      account: snapshot.accounts.find((a) => a.id === fixture.accountId),
      inventory: snapshot.inventory.filter((i) => i.materialId === fixture.materialId),
      projects: snapshot.projects.filter((p) => p.name.includes("Operasional QA")),
      bills: snapshot.bills.filter((b) => b.vendorId === fixture.vendorId),
      counts: {
        cash: snapshot.cash.length,
        movements: snapshot.movements.length,
        receipts: snapshot.confirmations.length,
      },
    }),
  );
}
if (mode === "observe") {
  const conversations = await db.query.aiConversation.findMany({
    where: eq(s.aiConversation.userId, owner.id),
  });
  const result = [];
  for (const c of conversations) {
    const messages = await db.query.aiMessage.findMany({
      where: eq(s.aiMessage.conversationId, c.id),
      orderBy: asc(s.aiMessage.createdAt),
    });
    if (!messages.some((m) => m.createdAt >= new Date(fixture.startedAt))) continue;
    result.push({
      conversationId: c.id,
      title: c.title,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        parts: m.parts,
        provider: m.provider,
        inputTokens: m.inputTokens,
        outputTokens: m.outputTokens,
      })),
    });
  }
  writeFileSync(
    "../../output/ai-chat-qa/operational/live-observation.json",
    JSON.stringify(result, null, 2),
  );
  console.log(
    JSON.stringify(
      result.map((c) => ({
        id: c.conversationId,
        title: c.title,
        messages: c.messages.length,
        last: c.messages.at(-1),
      })),
    ),
  );
}
await pool.end();
