import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { z } from "zod";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, pool } from "../src/backend/db";
import {
  user,
  role,
  rolePermission,
  tenantMember,
  materialCategory,
  materialMaster,
  inventoryLocation,
  materialInventory,
  client,
  project,
  projectExpenses,
  bankAccount,
  cashTransaction,
  stockMovement,
  auditLog,
  aiConversation,
  aiMessage,
  aiProposalConfirmation,
  appConfig,
  INSTANCE_TENANT_ID,
} from "../src/backend/db/schema";
const url = new URL(process.env.ATRIA_TEST_DATABASE_URL ?? "http://invalid");
if (
  url.hostname !== "127.0.0.1" ||
  url.port !== "32774" ||
  url.pathname !== "/atria_audit_reconciliation" ||
  process.env.NODE_ENV === "production"
)
  throw Error("Named disposable Browser database only");
const qa = await db.query.user.findFirst({
  where: eq(user.email, "reconciliation-qa@fixture.invalid"),
});
if (!qa) throw Error("Synthetic QA actor only");
const r = await db.query.role.findFirst({ where: eq(role.id, qa.roleId) });
if (!r || r.isSystem || !r.name.startsWith("QA Rekonsiliasi "))
  throw Error("Synthetic QA role only");
const mode = z.enum(["seed", "observe", "snapshot"]).parse(process.argv[2]),
  path = "/tmp/atria-ai-live-fixture.json";
const schema = z.object({
  startedAt: z.string(),
  originalName: z.string(),
  locationIds: z.array(z.string().guid()),
  items: z.array(
    z.object({ materialId: z.string().guid(), inventoryId: z.string().guid(), name: z.string() }),
  ),
  clientIds: z.array(z.string().guid()),
  managerId: z.string().guid(),
  projectIds: z.array(z.string().guid()),
});
if (mode === "seed" && !existsSync(path)) {
  const [category] = await db
    .insert(materialCategory)
    .values({ name: "Kategori Live QA · sintetis" })
    .returning();
  const locationIds: string[] = [];
  for (const name of ["Gudang Live QA A", "Gudang Live QA B"]) {
    const [l] = await db.insert(inventoryLocation).values({ name }).returning();
    locationIds.push(l.id);
  }
  const items: { materialId: string; inventoryId: string; name: string }[] = [];
  for (const name of ["Panel Live QA A", "Panel Live QA B"]) {
    const [m] = await db
      .insert(materialMaster)
      .values({ name, categoryId: category.id, unit: "lembar" })
      .returning();
    const [i] = await db
      .insert(materialInventory)
      .values({
        materialId: m.id,
        locationId: locationIds[0],
        currentStock: "20.00",
        reservedStock: "5.00",
        averageCost: "10000.00",
        lastPurchasePrice: "12000.00",
        minimumStock: "2.00",
      })
      .returning();
    items.push({ materialId: m.id, inventoryId: i.id, name });
  }
  const clientIds: string[] = [];
  for (const name of ["Klien Live QA A", "Klien Live QA B"]) {
    const [c] = await db
      .insert(client)
      .values({
        name,
        companyName: "",
        email: `live-qa-${crypto.randomUUID()}@fixture.invalid`,
        phone: "-",
        address: "-",
      })
      .returning();
    clientIds.push(c.id);
  }
  const [pmRole] = await db
    .insert(role)
    .values({ name: "PM Live QA · " + crypto.randomUUID().slice(0, 8), dataScope: "ASSIGNED" })
    .returning();
  await db.insert(rolePermission).values(
    (["view:project", "view:budget", "use:ai_chat"] as const).map((permissionKey) => ({
      roleId: pmRole.id,
      permissionKey,
    })),
  );
  const [pm] = await db
    .insert(user)
    .values({
      roleId: pmRole.id,
      name: "PM Live QA",
      email: `pm-live-${crypto.randomUUID()}@fixture.invalid`,
      isActive: true,
      mustChangePassword: false,
    })
    .returning();
  await db
    .insert(tenantMember)
    .values({ tenantId: INSTANCE_TENANT_ID, userId: pm.id, roleId: pmRole.id, isActive: true });
  const projectIds = (await db.query.project.findMany({ columns: { id: true } })).map((p) => p.id);
  writeFileSync(
    path,
    JSON.stringify({
      startedAt: new Date().toISOString(),
      originalName: qa.name,
      locationIds,
      items,
      clientIds,
      managerId: pm.id,
      projectIds,
    }),
  );
}
const f = schema.parse(JSON.parse(readFileSync(path, "utf8")));
if (mode === "seed")
  console.log(
    JSON.stringify({
      locations: ["Gudang Live QA A", "Gudang Live QA B"],
      materials: f.items.map((i) => i.name),
      clients: ["Klien Live QA A", "Klien Live QA B"],
      manager: "PM Live QA",
      actorGrants: (
        await db.query.rolePermission.findMany({
          where: eq(rolePermission.roleId, qa.roleId),
          columns: { permissionKey: true },
        })
      ).map((p) => p.permissionKey),
    }),
  );
else if (mode === "observe") {
  const cs = await db.query.aiConversation.findMany({
    where: eq(aiConversation.userId, qa.id),
    orderBy: desc(aiConversation.updatedAt),
    limit: 10,
  });
  const part = z.object({
    type: z.string(),
    text: z.string().optional(),
    toolCallId: z.string().optional(),
    state: z.string().optional(),
    input: z.unknown().optional(),
    output: z.unknown().optional(),
    errorText: z.string().optional(),
  });
  const results = [];
  for (const c of cs) {
    const messages = await db.query.aiMessage.findMany({
      where: eq(aiMessage.conversationId, c.id),
      orderBy: asc(aiMessage.createdAt),
    });
    if (!messages.some((m) => m.createdAt >= new Date(f.startedAt) && m.role === "user")) continue;
    const receipts = await db.query.aiProposalConfirmation.findMany({
      where: eq(aiProposalConfirmation.conversationId, c.id),
    });
    results.push({
      conversationId: c.id,
      title: c.title,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        provider: m.provider,
        inputTokens: m.inputTokens,
        outputTokens: m.outputTokens,
        parts: z
          .array(part)
          .parse(m.parts)
          .map((p) =>
            p.type === "text"
              ? { type: p.type, text: p.text }
              : p.type.startsWith("tool-")
                ? {
                    type: p.type,
                    toolCallId: p.toolCallId,
                    state: p.state,
                    input: p.input,
                    output: p.output,
                    errorText: p.errorText,
                  }
                : { type: p.type },
          ),
      })),
      receipts: receipts.map((x) => ({
        toolCallId: x.toolCallId,
        kind: x.proposalType,
        documentId: x.documentId,
      })),
    });
  }
  writeFileSync("/tmp/atria-ai-live-observation.json", JSON.stringify(results, null, 2));
  console.log(
    JSON.stringify(
      results.map((c) => ({
        ...c,
        messages: c.messages.map((m) => ({
          ...m,
          parts: m.parts.map((p) =>
            p.type === "text"
              ? p
              : {
                  type: p.type,
                  toolCallId: "toolCallId" in p ? p.toolCallId : undefined,
                  state: "state" in p ? p.state : undefined,
                  input: "input" in p ? p.input : undefined,
                  errorText: "errorText" in p ? p.errorText : undefined,
                },
          ),
        })),
      })),
      null,
      2,
    ),
  );
} else {
  const protect = await Promise.all([
    db.select().from(cashTransaction),
    db.select().from(bankAccount),
    db.select().from(projectExpenses),
    db.select().from(appConfig),
  ]);
  const hash = (data: unknown): string =>
    createHash("sha256").update(JSON.stringify(data)).digest("hex");
  const budgets = await db.query.projectBudgets.findMany(),
    cats = await db.query.projectBudgetCategory.findMany();
  const inventories = await db.query.materialInventory.findMany({
    where: inArray(
      materialInventory.id,
      f.items.map((i) => i.inventoryId),
    ),
    orderBy: asc(materialInventory.id),
  });
  const movements = await db.query.stockMovement.findMany({
    where: inArray(
      stockMovement.materialId,
      f.items.map((i) => i.materialId),
    ),
    orderBy: asc(stockMovement.createdAt),
  });
  const audits = await db.query.auditLog.findMany({
    where: and(
      eq(auditLog.userId, qa.id),
      inArray(
        auditLog.targetId,
        f.items.map((i) => i.inventoryId),
      ),
    ),
  });
  const projects = await db.query.project.findMany({ orderBy: asc(project.id) });
  const receipts = await db.query.aiProposalConfirmation.findMany({
    where: eq(aiProposalConfirmation.userId, qa.id),
  });
  const snapshot = {
    protectedHash: hash(protect.map((rows) => rows.toSorted((a, b) => a.id.localeCompare(b.id)))),
    existingBudgetsHash: hash({
      budgets: budgets
        .filter((b) => f.projectIds.includes(b.projectId))
        .toSorted((a, b) => a.id.localeCompare(b.id)),
      categories: cats
        .filter((c) =>
          budgets.some((b) => f.projectIds.includes(b.projectId) && b.id === c.projectBudgetId),
        )
        .toSorted((a, b) => a.id.localeCompare(b.id)),
    }),
    inventories: inventories.map((i) => ({
      id: i.id,
      materialId: i.materialId,
      current: i.currentStock,
      reserved: i.reservedStock,
      average: i.averageCost,
      lastPrice: i.lastPurchasePrice,
    })),
    movements: movements.map((m) => ({
      id: m.id,
      materialId: m.materialId,
      quantity: m.quantity,
      type: m.movementType,
    })),
    audits: audits.length,
    createdProjects: projects.filter((p) => !f.projectIds.includes(p.id)),
    receipts: receipts
      .filter((c) => c.createdAt >= new Date(f.startedAt))
      .map((c) => ({
        conversationId: c.conversationId,
        toolCallId: c.toolCallId,
        kind: c.proposalType,
        documentId: c.documentId,
      })),
    profileName: qa.name,
    profile: {
      name: qa.name,
      image: qa.image,
      email: qa.email,
      roleId: qa.roleId,
      isActive: qa.isActive,
      mustChangePassword: qa.mustChangePassword,
    },
  };
  console.log(JSON.stringify(snapshot));
}
await pool.end();
