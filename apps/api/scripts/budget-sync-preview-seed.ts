import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, pool } from "../src/backend/db";
import {
  user,
  role,
  rolePermission,
  client,
  project,
  projectBudgets,
  projectBudgetCategory,
  expenseCategory,
  projectExpenses,
  aiConversation,
  aiMessage,
  INSTANCE_TENANT_ID,
} from "../src/backend/db/schema";
import { getRoleAccess } from "../src/backend/lib/auth/role-access";
import type { Actor } from "../src/backend/server/actor";
import { inspectBudgetSummary } from "../src/backend/server/usecases/project/budget-summary-writer";
const target = new URL(process.env.ATRIA_TEST_DATABASE_URL ?? "http://invalid");
if (
  target.hostname !== "127.0.0.1" ||
  target.port !== "32774" ||
  target.pathname !== "/atria_audit_reconciliation" ||
  process.env.NODE_ENV === "production"
)
  throw new Error("Named disposable Browser database only.");
const qa = await db.query.user.findFirst({
  where: eq(user.email, "reconciliation-qa@fixture.invalid"),
});
if (!qa?.roleId) throw new Error("Synthetic actor required.");
const r = await db.query.role.findFirst({ where: eq(role.id, qa.roleId) });
if (!r || r.isSystem || !r.name.startsWith("QA Rekonsiliasi "))
  throw new Error("Synthetic role only.");
await db
  .insert(rolePermission)
  .values(
    (["use:ai_chat", "view:project", "view:budget", "update:budget"] as const).map(
      (permissionKey) => ({ roleId: r.id, permissionKey }),
    ),
  )
  .onConflictDoNothing();
const access = await getRoleAccess(r.id);
if (!access) throw new Error("access");
const actor: Actor = {
  userId: qa.id,
  roleId: r.id,
  roleName: access.roleName,
  permissions: access.permissions,
  dataScope: access.dataScope,
  isActive: true,
  mustChangePassword: false,
  name: qa.name,
  email: qa.email,
  sessionId: "fixture",
  developerActorUserId: null,
};
const qaId = qa.id;
const [cl] = await db
  .insert(client)
  .values({ name: "Klien QA budget", email: `${randomUUID()}@fixture.invalid`, phone: "000" })
  .returning();
async function fixture(
  name: string,
  drift: boolean,
): Promise<{ projectId: string; budgetId: string }> {
  const [p] = await db
    .insert(project)
    .values({
      name,
      clientId: cl.id,
      location: "Data sintetis QA",
      projectManagerId: qaId,
      totalContractValue: "100000000",
      status: "ACTIVE",
    })
    .returning();
  const [b] = await db
    .insert(projectBudgets)
    .values({ projectId: p.id, contractValue: "100000000", internalBudget: "90000000" })
    .returning();
  for (const [index, code] of [
    "MATERIAL",
    "TUKANG",
    "OPERASIONAL",
    "LAIN_LAIN",
    "SUBCON",
  ].entries()) {
    const ec = await db.query.expenseCategory.findFirst({
      where: and(eq(expenseCategory.tenantId, INSTANCE_TENANT_ID), eq(expenseCategory.code, code)),
    });
    if (!ec) throw new Error("Seed categories required");
    const allocation = code === "OPERASIONAL" ? "200000.00" : "25000000.00";
    const [c] = await db
      .insert(projectBudgetCategory)
      .values({
        projectBudgetId: b.id,
        expenseCategoryId: ec.id,
        allocatedAmount: allocation,
        remainingAmount: allocation,
        actualAmount: drift && index === 0 ? "100000.00" : "0.00",
        sortOrder: index,
      })
      .returning();
    if (drift && (index === 0 || index === 2))
      for (const [n, status] of (index === 0
        ? ["APPROVED", "PAID", "SUBMITTED"]
        : ["APPROVED"]
      ).entries())
        await db.insert(projectExpenses).values({
          projectId: p.id,
          projectBudgetId: b.id,
          projectBudgetCategoryId: c.id,
          expenseCategoryId: ec.id,
          requestedById: qaId,
          description: `Sumber sintetis QA ${code} ${n}`,
          amount:
            index === 2
              ? "300000.00"
              : status === "PAID"
                ? "150000.25"
                : status === "SUBMITTED"
                  ? "125000.00"
                  : "325000.00",
          status,
        });
  }
  return { projectId: p.id, budgetId: b.id };
}
const drift = await fixture("Proyek QA · sinkronisasi budget", true),
  clean = await fixture("Proyek QA · budget sesuai", false),
  stale = await fixture("Proyek QA · sumber berubah", true);
const [conv] = await db
  .insert(aiConversation)
  .values({ userId: qa.id, title: "QA pemeriksaan & sinkronisasi budget" })
  .returning();
async function message(projectId: string, text: string): Promise<void> {
  const proposal = await inspectBudgetSummary(actor, projectId),
    call = randomUUID();
  await db.insert(aiMessage).values({
    conversationId: conv.id,
    role: "assistant",
    parts: [
      { type: "text", text },
      {
        type: "tool-inspectProjectBudgetSummary",
        toolCallId: call,
        state: "output-available",
        input: { projectId },
        output: { proposal },
      },
    ],
  });
}
await message(
  clean.projectId,
  "Contoh sintetis QA: ringkasan sudah sesuai; tidak ada tindakan sinkronisasi.",
);
await message(
  stale.projectId,
  "Contoh sintetis QA: sumber sengaja berubah setelah pemeriksaan; tindakan harus diblokir.",
);
await db
  .update(projectBudgets)
  .set({ notes: "Sumber diperbarui setelah preview" })
  .where(eq(projectBudgets.id, stale.budgetId));
await message(
  drift.projectId,
  "Contoh sintetis QA: dua kategori memiliki selisih. Periksa perbedaan, lalu konfirmasi sinkronisasi untuk memverifikasi hasil di database disposable.",
);
console.log(JSON.stringify({ conversationId: conv.id, drift, clean, stale }));
await pool.end();
