import { readFileSync } from "node:fs";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, pool } from "../src/backend/db";
import { aiConversation, aiMessage, user, role } from "../src/backend/db/schema";
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
  .object({
    conversationId: z.string().guid(),
    drift: z.object({ projectId: z.string().guid() }),
    clean: z.object({ projectId: z.string().guid() }),
  })
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
const part = z.object({
  type: z.literal("tool-inspectProjectBudgetSummary"),
  toolCallId: z.string(),
  input: z.object({ projectId: z.string().guid() }),
});
for (const m of await db.query.aiMessage.findMany({
  where: eq(aiMessage.conversationId, conv.id),
})) {
  const parts = z.array(z.unknown()).parse(m.parts),
    next: unknown[] = [];
  for (const p of parts) {
    const found = part.safeParse(p);
    if (
      found.success &&
      [f.drift.projectId, f.clean.projectId].includes(found.data.input.projectId)
    ) {
      next.push({
        ...found.data,
        state: "output-available",
        output: { proposal: await inspectBudgetSummary(actor, found.data.input.projectId) },
      });
    } else next.push(p);
  }
  await db.update(aiMessage).set({ parts: next }).where(eq(aiMessage.id, m.id));
}
console.log("Refreshed scoped synthetic clean/drift proof only; stale fixture retained.");
await pool.end();
