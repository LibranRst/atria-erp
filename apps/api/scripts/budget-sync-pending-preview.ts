import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, pool } from "../src/backend/db";
import {
  user,
  role,
  aiConversation,
  aiMessage,
  client,
  project,
  projectBudgets,
  projectBudgetCategory,
  expenseCategory,
  INSTANCE_TENANT_ID,
} from "../src/backend/db/schema";
import { getRoleAccess } from "../src/backend/lib/auth/role-access";
import type { Actor } from "../src/backend/server/actor";
import { inspectBudgetSummary } from "../src/backend/server/usecases/project/budget-summary-writer";
const url = new URL(process.env.ATRIA_TEST_DATABASE_URL ?? "http://invalid");
if (
  url.hostname !== "127.0.0.1" ||
  url.port !== "32774" ||
  url.pathname !== "/atria_audit_reconciliation" ||
  process.env.NODE_ENV === "production"
)
  throw new Error("Named disposable database only");
const f = z
  .object({ conversationId: z.string().guid() })
  .parse(JSON.parse(readFileSync("/tmp/atria-budget-sync-preview-fixture.json", "utf8")));
const qa = await db.query.user.findFirst({
  where: eq(user.email, "reconciliation-qa@fixture.invalid"),
});
if (!qa?.roleId) throw new Error("QA user");
const r = await db.query.role.findFirst({ where: eq(role.id, qa.roleId) });
if (!r || r.isSystem || !r.name.startsWith("QA Rekonsiliasi ")) throw new Error("Synthetic role");
const access = await getRoleAccess(r.id);
if (!access) throw new Error("access");
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
const conv = await db.query.aiConversation.findFirst({
  where: and(eq(aiConversation.id, f.conversationId), eq(aiConversation.userId, qa.id)),
});
if (!conv || conv.title !== "QA pemeriksaan & sinkronisasi budget")
  throw new Error("QA conversation");
const [cl] = await db
  .insert(client)
  .values({
    name: "Klien QA selisih pending",
    email: `${randomUUID()}@fixture.invalid`,
    phone: "000",
  })
  .returning();
const [p] = await db
  .insert(project)
  .values({
    name: "Proyek QA · selisih menunggu persetujuan",
    clientId: cl.id,
    projectManagerId: qa.id,
    totalContractValue: "100000.00",
    status: "ACTIVE",
  })
  .returning();
const [b] = await db
  .insert(projectBudgets)
  .values({ projectId: p.id, contractValue: "100000.00", internalBudget: "90000.00" })
  .returning();
for (const [i, code] of ["MATERIAL", "TUKANG", "OPERASIONAL", "LAIN_LAIN", "SUBCON"].entries()) {
  const ec = await db.query.expenseCategory.findFirst({
    where: and(eq(expenseCategory.tenantId, INSTANCE_TENANT_ID), eq(expenseCategory.code, code)),
  });
  if (!ec) throw new Error("Seed category");
  const amount = i === 0 ? "31500.00" : "10000.00";
  await db.insert(projectBudgetCategory).values({
    projectBudgetId: b.id,
    expenseCategoryId: ec.id,
    allocatedAmount: amount,
    remainingAmount: amount,
    pendingAmount: i === 0 ? "5000.00" : "0.00",
    sortOrder: i,
  });
}
const proposal = await inspectBudgetSummary(actor, p.id);
await db.insert(aiMessage).values({
  conversationId: conv.id,
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "Contoh sintetis QA: hanya angka menunggu persetujuan yang berbeda. Terpakai sudah cocok. Konfirmasi harus menyebut perubahan yang sebenarnya.",
    },
    {
      type: "tool-inspectProjectBudgetSummary",
      toolCallId: randomUUID(),
      state: "output-available",
      input: { projectId: p.id },
      output: { proposal },
    },
  ],
});
console.log(JSON.stringify({ projectId: p.id }));
await pool.end();
