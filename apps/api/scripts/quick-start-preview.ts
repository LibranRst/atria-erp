import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, pool } from "../src/backend/db";
import {
  user,
  role,
  rolePermission,
  tenantMember,
  appConfig,
  aiConversation,
  aiMessage,
  aiProposalConfirmation,
  cashTransaction,
  projectExpenses,
  bankAccount,
  materialInventory,
  stockMovement,
  auditLog,
  onboardingEvent,
  INSTANCE_TENANT_ID,
} from "../src/backend/db/schema";
import { getRoleAccess } from "../src/backend/lib/auth/role-access";
import type { Actor } from "../src/backend/server/actor";
import { prepareQuickStart } from "../src/backend/server/usecases/ai/quick-start-context";
import { quickStartInputSchema } from "@atria/core/ai/quick-start";
import {
  OWNER_ONBOARDING_V2_CONFIG_KEY,
  createDefaultOwnerQuickStartState,
  parseOwnerQuickStartState,
} from "@atria/core/onboarding/organization-setup";
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
const path = "/tmp/atria-quick-start-preview.json",
  schema = z.object({
    conversationId: z.string().guid(),
    oldSetup: z.string().nullable(),
    projectIds: z.array(z.string()),
  });
const mode = z
  .enum([
    "seed",
    "advance",
    "pause",
    "resume",
    "retry",
    "stock",
    "project",
    "expired",
    "stale",
    "snapshot",
  ])
  .parse(process.argv[2]);
if (mode === "seed" && !existsSync(path)) {
  await db
    .insert(rolePermission)
    .values(
      (
        [
          "use:ai_chat",
          "manage:onboarding",
          "create:project",
          "view:settings",
          "view:project",
          "create:opening_inventory",
        ] as const
      ).map((permissionKey) => ({ roleId: r.id, permissionKey })),
    )
    .onConflictDoNothing();
  await db
    .insert(tenantMember)
    .values({ tenantId: INSTANCE_TENANT_ID, userId: qa.id, roleId: r.id, isActive: true })
    .onConflictDoNothing();
  const old = await db.query.appConfig.findFirst({
    where: and(
      eq(appConfig.tenantId, INSTANCE_TENANT_ID),
      eq(appConfig.key, OWNER_ONBOARDING_V2_CONFIG_KEY),
    ),
  });
  const [c] = await db
    .insert(aiConversation)
    .values({ userId: qa.id, title: "QA Quick Start · data sintetis" })
    .returning();
  const projects = await db.query.project.findMany({ columns: { id: true } });
  writeFileSync(
    path,
    JSON.stringify({
      conversationId: c.id,
      oldSetup: old?.value ?? null,
      projectIds: projects.map((p) => p.id),
    }),
  );
  const value = JSON.stringify(createDefaultOwnerQuickStartState());
  if (old)
    await db
      .update(appConfig)
      .set({ value, updatedAt: new Date(), updatedById: qa.id })
      .where(eq(appConfig.id, old.id));
  else
    await db
      .insert(appConfig)
      .values({ key: OWNER_ONBOARDING_V2_CONFIG_KEY, value, updatedById: qa.id });
}
const f = schema.parse(JSON.parse(readFileSync(path, "utf8"))),
  conv = await db.query.aiConversation.findFirst({
    where: and(eq(aiConversation.id, f.conversationId), eq(aiConversation.userId, qa.id)),
  });
if (conv?.title !== "QA Quick Start · data sintetis") throw Error("Synthetic conversation only");
const setup = await db.query.appConfig.findFirst({
    where: and(
      eq(appConfig.tenantId, INSTANCE_TENANT_ID),
      eq(appConfig.key, OWNER_ONBOARDING_V2_CONFIG_KEY),
    ),
  }),
  state = parseOwnerQuickStartState(setup?.value);
if (!state) throw Error("state");
if (mode === "snapshot") {
  const protectedRows = await Promise.all([
    db.select().from(cashTransaction),
    db.select().from(projectExpenses),
    db.select().from(bankAccount),
    db.select().from(materialInventory),
    db.select().from(stockMovement),
  ]);
  const protectedHash = createHash("sha256")
    .update(
      JSON.stringify(
        protectedRows.map((rows) => rows.toSorted((a, b) => a.id.localeCompare(b.id))),
      ),
    )
    .digest("hex");
  const projects = await db.query.project.findMany({
      columns: { id: true, name: true, totalContractValue: true },
    }),
    created = projects.filter((p) => !f.projectIds.includes(p.id));
  const budgets = await db.query.projectBudgets.findMany(),
    categories = await db.query.projectBudgetCategory.findMany();
  const receipts = await db.query.aiProposalConfirmation.findMany({
    where: and(
      eq(aiProposalConfirmation.conversationId, conv.id),
      eq(aiProposalConfirmation.proposalType, "QUICK_START"),
    ),
  });
  const events = await db.query.onboardingEvent.findMany({
    where: eq(onboardingEvent.actorUserId, qa.id),
  });
  const audits = await db.query.auditLog.findMany({ where: eq(auditLog.userId, qa.id) });
  console.log(
    JSON.stringify({
      protectedHash,
      state,
      created,
      createdBudgets: budgets
        .filter((b) => created.some((p) => p.id === b.projectId))
        .map((b) => ({ ...b, categories: categories.filter((c) => c.projectBudgetId === b.id) })),
      existingBudgetHash: createHash("sha256")
        .update(
          JSON.stringify({
            budgets: budgets
              .filter((b) => f.projectIds.includes(b.projectId))
              .toSorted((a, b) => a.id.localeCompare(b.id)),
            categories: categories
              .filter((c) =>
                budgets.some(
                  (b) => f.projectIds.includes(b.projectId) && b.id === c.projectBudgetId,
                ),
              )
              .toSorted((a, b) => a.id.localeCompare(b.id)),
          }),
        )
        .digest("hex"),
      receipts: receipts.length,
      events: events.length,
      audits: audits.length,
    }),
  );
} else {
  const access = await getRoleAccess(r.id);
  if (!access) throw Error("role");
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
  const raw =
    mode === "project"
      ? {
          action: "CREATE_PROJECT",
          project: {
            name: "Proyek QA · Quick Start",
            newClientName: "Klien QA · Quick Start",
            projectManagerId: null,
            totalContractValue: 250000000.25,
            approvedRabValue: 240000000.5,
          },
        }
      : mode === "stock"
        ? { action: "STOCK_DECISION", decision: "HAS_LEGACY_STOCK" }
        : mode === "pause"
          ? { action: "PAUSE", stepId: state.currentStep }
          : mode === "resume"
            ? { action: "RESUME", stepId: state.currentStep }
            : mode === "retry"
              ? { action: "RETRY", stepId: state.currentStep }
              : { action: "ADVANCE", stepId: state.currentStep };
  const input = quickStartInputSchema.parse(raw),
    proposal = await prepareQuickStart(actor, input),
    toolCallId = crypto.randomUUID();
  if (mode === "stale") proposal.contextHash = "0".repeat(64);
  await db.insert(aiMessage).values({
    conversationId: conv.id,
    role: "assistant",
    createdAt: mode === "expired" ? new Date(Date.now() - 31 * 86400000) : new Date(),
    parts: [
      {
        type: "text",
        text: "Data sintetis QA · Quick Start. Periksa langkah yang ditinjau; tombol konfirmasi manusia menyimpan keputusan.",
      },
      {
        type: "tool-proposeQuickStart",
        toolCallId,
        state: "output-available",
        input,
        output: { proposal },
      },
    ],
  });
  await db
    .update(aiConversation)
    .set({ updatedAt: new Date() })
    .where(eq(aiConversation.id, conv.id));
  console.log(JSON.stringify({ conversationId: conv.id, mode, toolCallId, action: input.action }));
}
await pool.end();
