import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { db, pool } from "../src/backend/db";
import {
  account,
  aiConversation,
  aiMessage,
  aiProposalConfirmation,
  bankAccount,
  cashTransaction,
  materialInventory,
  project,
  projectBudgetCategory,
  projectBudgets,
  projectExpenses,
  role,
  rolePermission,
  session,
  stockMovement,
  tenantMember,
  user,
  INSTANCE_TENANT_ID,
} from "../src/backend/db/schema";
import { auth } from "../src/backend/lib/auth";
import { getRoleAccess } from "../src/backend/lib/auth/role-access";
import { buildAiTools } from "../src/backend/lib/ai/tools";
import { buildFinanceTools } from "../src/backend/lib/ai/tools/finance-tools";
import { buildProjectTools } from "../src/backend/lib/ai/tools/project-tools";
import { canAccessProject, type AiToolContext } from "../src/backend/lib/ai/tools/context";

const target = new URL(process.env.ATRIA_TEST_DATABASE_URL ?? "http://invalid");
if (
  target.hostname !== "127.0.0.1" ||
  target.port !== "32774" ||
  target.pathname !== "/atria_audit_reconciliation" ||
  process.env.NODE_ENV === "production"
)
  throw new Error("Named disposable final UAT database only");

const mode = z
  .enum(["credentials", "restore-credentials", "matrix", "observe"])
  .parse(process.argv[2]);
const keys = ["owner", "finance", "purchasing", "pm_a", "pm_b", "custom_none", "no_ai"] as const;
const keySchema = z.enum(keys);
const fixture = z
  .object({
    actors: z.array(
      z.object({ key: z.string(), userId: z.guid(), roleId: z.guid(), email: z.string() }),
    ),
    projects: z.array(z.object({ id: z.guid(), name: z.string(), managerId: z.guid() })),
  })
  .parse(JSON.parse(readFileSync("/tmp/atria-ai-role-fixture.json", "utf8")));
const backupPath = "/tmp/atria-ai-final-uat-credential-backup.json";
const secretPath = "/tmp/atria-ai-final-uat-credentials.json";
const dir = "../../output/ai-chat-qa/final-uat";
mkdirSync(dir, { recursive: true });
const backupSchema = z.object({
  startedAt: z.string().datetime(),
  rows: z.array(
    z.object({
      key: keySchema,
      userId: z.guid(),
      accountId: z.string(),
      password: z.string(),
      temporaryHash: z.string(),
      updatedAt: z.string().datetime(),
    }),
  ),
});

const actors = await Promise.all(
  keys.map(async (key) => {
    const ref = fixture.actors.find((a) => a.key === key);
    if (!ref || ref.email !== `ai-role-${key}@fixture.invalid`)
      throw new Error("Exact fixture email required");
    const actor = await db.query.user.findFirst({ where: eq(user.id, ref.userId) });
    const membership = await db.query.tenantMember.findFirst({
      where: and(
        eq(tenantMember.tenantId, INSTANCE_TENANT_ID),
        eq(tenantMember.userId, ref.userId),
      ),
    });
    if (
      !actor ||
      actor.email !== ref.email ||
      !actor.name.startsWith("QA ") ||
      actor.roleId !== ref.roleId ||
      !actor.isActive ||
      actor.mustChangePassword ||
      !membership?.isActive ||
      membership.roleId !== ref.roleId
    )
      throw new Error(`Unchanged active synthetic actor and membership required: ${key}`);
    const access = await getRoleAccess(actor.roleId);
    if (!access) throw new Error("Actual effective role required");
    return { key, actor, access };
  }),
);

if (mode === "credentials") {
  if (existsSync(backupPath) || existsSync(secretPath))
    throw new Error("Private credential backup already exists; restore before rerunning");
  const password = randomBytes(24).toString("base64url");
  const temporaryHash = await auth.$context.then((context) => context.password.hash(password));
  const rows = await Promise.all(
    actors.map(async ({ key, actor }) => {
      const credentials = await db.query.account.findMany({
        where: and(eq(account.userId, actor.id), eq(account.providerId, "credential")),
      });
      if (credentials.length !== 1 || !credentials[0].password)
        throw new Error("Single existing fixture credential required");
      const credential = credentials[0];
      return {
        key,
        userId: actor.id,
        accountId: credential.id,
        password: credential.password,
        temporaryHash,
        updatedAt: credential.updatedAt.toISOString(),
      };
    }),
  );
  const backup = backupSchema.parse({ startedAt: new Date().toISOString(), rows });
  writeFileSync(backupPath, JSON.stringify(backup), { mode: 0o600, flag: "wx" });
  writeFileSync(
    secretPath,
    JSON.stringify({
      password,
      actors: actors.map(({ key, actor }) => ({ key, email: actor.email })),
    }),
    { mode: 0o600, flag: "wx" },
  );
  await db.transaction(async (tx) => {
    for (const row of backup.rows) {
      const updated = await tx
        .update(account)
        .set({ password: temporaryHash, updatedAt: new Date() })
        .where(
          and(
            eq(account.id, row.accountId),
            eq(account.userId, row.userId),
            eq(account.providerId, "credential"),
            eq(account.password, row.password),
          ),
        )
        .returning({ id: account.id });
      if (updated.length !== 1)
        throw new Error("Credential changed while preparing ordinary QA login");
    }
  });
  console.log(JSON.stringify({ keys, secretPath, backupPath }));
} else if (mode === "restore-credentials") {
  const backup = backupSchema.parse(JSON.parse(readFileSync(backupPath, "utf8")));
  if (
    backup.rows.length !== keys.length ||
    !keys.every((key) => backup.rows.some((r) => r.key === key))
  )
    throw new Error("Complete exact fixture backup required");
  await db.transaction(async (tx) => {
    for (const row of backup.rows) {
      const actor = actors.find((a) => a.key === row.key);
      if (!actor || actor.actor.id !== row.userId) throw new Error("Backup actor mismatch");
      const current = await tx.query.account.findFirst({
        where: and(
          eq(account.id, row.accountId),
          eq(account.userId, row.userId),
          eq(account.providerId, "credential"),
        ),
      });
      if (!current || (current.password !== row.temporaryHash && current.password !== row.password))
        throw new Error("Credential changed outside final UAT; inspect before restoring");
      await tx
        .update(account)
        .set({ password: row.password, updatedAt: new Date(row.updatedAt) })
        .where(eq(account.id, row.accountId));
    }
  });
  for (const row of backup.rows) {
    const restored = await db.query.account.findFirst({ where: eq(account.id, row.accountId) });
    if (restored?.password !== row.password || restored.updatedAt.toISOString() !== row.updatedAt)
      throw new Error("Exact credential restoration failed");
  }
  const evidence = {
    restoredAt: new Date().toISOString(),
    keys,
    exactHashesAndTimestampsRestored: true,
    noRoleGrantUserFlagChanges: true,
    retainedOrdinaryOwnerSession: true,
  };
  writeFileSync(`${dir}/credential-restoration.json`, JSON.stringify(evidence, null, 2));
  unlinkSync(secretPath);
  unlinkSync(backupPath);
  console.log(JSON.stringify(evidence));
} else if (mode === "matrix") {
  const options = { toolCallId: "final-uat-read", messages: [], context: {} };
  const checks: { label: string; pass: boolean }[] = [];
  const matrix = [];
  const hash = (value: unknown): string =>
    createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const snapshot = async (): Promise<string> =>
    hash(
      await Promise.all([
        db.select().from(project).orderBy(asc(project.id)),
        db.select().from(projectBudgets).orderBy(asc(projectBudgets.id)),
        db.select().from(projectBudgetCategory).orderBy(asc(projectBudgetCategory.id)),
        db.select().from(bankAccount).orderBy(asc(bankAccount.id)),
        db.select().from(cashTransaction).orderBy(asc(cashTransaction.id)),
        db.select().from(projectExpenses).orderBy(asc(projectExpenses.id)),
        db.select().from(materialInventory).orderBy(asc(materialInventory.id)),
        db.select().from(stockMovement).orderBy(asc(stockMovement.id)),
        db.select().from(aiProposalConfirmation).orderBy(asc(aiProposalConfirmation.id)),
        db.select().from(role).orderBy(asc(role.id)),
        db.select().from(rolePermission).orderBy(asc(rolePermission.id)),
      ]),
    );
  const before = await snapshot();
  for (const { key, actor, access } of actors) {
    const context: AiToolContext = { ...access, userId: actor.id };
    const tools = buildAiTools(context);
    const projectReader = buildProjectTools(context).listProjects.execute;
    const balanceReader = buildFinanceTools(context).getBankBalances.execute;
    if (!projectReader || !balanceReader) throw new Error("Read executor missing");
    const projectResult = tools.listProjects
      ? await projectReader({ query: "Proyek Role QA", limit: 20 }, options)
      : { error: "Project reader is unavailable in the actual permission-filtered AI catalog." };
    const balanceResult = await balanceReader({}, options);
    const scopes = await Promise.all(
      fixture.projects.map(async (p) => ({
        id: p.id,
        name: p.name,
        allowed: await canAccessProject(context, p.id),
      })),
    );
    const expectedIds =
      key === "owner" || key === "finance"
        ? fixture.projects.map((p) => p.id).sort()
        : key === "pm_a" || key === "pm_b"
          ? fixture.projects
              .filter((p) => p.managerId === actor.id)
              .map((p) => p.id)
              .sort()
          : [];
    const parsed = z
      .object({ projects: z.array(z.object({ projectId: z.guid() })) })
      .safeParse(projectResult);
    const actualIds = parsed.success ? parsed.data.projects.map((p) => p.projectId).sort() : [];
    checks.push({
      label: `${key}: scoped project ids`,
      pass: JSON.stringify(actualIds) === JSON.stringify(expectedIds),
    });
    const hasBank = key === "owner" || key === "finance";
    const bankAllowed = z
      .object({ accounts: z.array(z.unknown()) })
      .safeParse(balanceResult).success;
    checks.push({ label: `${key}: bank balance permission`, pass: bankAllowed === hasBank });
    checks.push({
      label: `${key}: project tool catalog`,
      pass: Boolean(tools.listProjects) === expectedIds.length > 0,
    });
    if (key === "custom_none")
      checks.push({
        label: "Custom Owner label never grants project/global tools",
        pass:
          access.dataScope === "NONE" &&
          !tools.listProjects &&
          !tools.getProjectBudget &&
          !tools.getBankBalances,
      });
    if (key === "purchasing")
      checks.push({
        label: "Purchasing warehouse remains available with project NONE",
        pass:
          Boolean(tools.getMaterialCatalog) &&
          Boolean(tools.getWarehouseContext) &&
          !tools.getProjectBudget &&
          !tools.getBankBalances,
      });
    if (key === "no_ai")
      checks.push({
        label: "No AI grant disables entire registered tool catalog",
        pass: Object.keys(tools).length === 0,
      });
    matrix.push({
      key,
      userId: actor.id,
      name: actor.name,
      roleName: access.roleName,
      dataScope: access.dataScope,
      permissions: access.permissions,
      availableTools: Object.keys(tools).sort(),
      projectResult,
      balanceResult,
      scopes,
    });
  }
  const after = await snapshot();
  checks.push({
    label: "All read probes leave protected business records, receipts and grants unchanged",
    pass: before === after,
  });
  const projectFacts = await db.query.project.findMany({
    where: and(
      eq(project.tenantId, INSTANCE_TENANT_ID),
      inArray(project.id, [
        ...fixture.projects.map((p) => p.id),
        "33bf90c2-7897-4fa1-935a-eb1a3d99e665",
      ]),
    ),
    columns: {
      id: true,
      name: true,
      projectManagerId: true,
      totalContractValue: true,
      status: true,
    },
    orderBy: [asc(project.id)],
  });
  const budgetFacts = await db.query.projectBudgets.findMany({
    where: inArray(
      projectBudgets.projectId,
      projectFacts.map((p) => p.id),
    ),
    columns: { id: true, projectId: true, contractValue: true, internalBudget: true, status: true },
    orderBy: [asc(projectBudgets.id)],
  });
  const inventoryFacts = await db.query.materialInventory.findMany({
    where: and(
      eq(materialInventory.tenantId, INSTANCE_TENANT_ID),
      inArray(materialInventory.id, [
        "6fec540e-9e7f-41cc-a0bd-980bf4e08060",
        "011104b3-2c6f-454a-be36-6c92f2b209d2",
      ]),
    ),
    columns: {
      id: true,
      materialId: true,
      locationId: true,
      currentStock: true,
      reservedStock: true,
      averageCost: true,
      lastPurchasePrice: true,
      minimumStock: true,
    },
    orderBy: [asc(materialInventory.id)],
  });
  const sourceFacts = { projectFacts, budgetFacts, inventoryFacts };
  writeFileSync(
    `${dir}/backend-role-matrix.json`,
    JSON.stringify(
      { observedAt: new Date().toISOString(), before, after, checks, matrix, sourceFacts },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      file: `${dir}/backend-role-matrix.json`,
      checks: checks.length,
      passed: checks.filter((c) => c.pass).length,
      failed: checks.filter((c) => !c.pass),
    }),
  );
  if (checks.some((c) => !c.pass)) process.exitCode = 1;
} else {
  const runStart = z.string().datetime().parse(process.argv[3]);
  const observations = await Promise.all(
    actors.map(async ({ key, actor, access }) => {
      const conversations = await db.query.aiConversation.findMany({
        where: eq(aiConversation.userId, actor.id),
        orderBy: [desc(aiConversation.createdAt)],
      });
      const collected = await Promise.all(
        conversations.map(async (c) => ({
          conversationId: c.id,
          title: c.title,
          userId: c.userId,
          messages: await db.query.aiMessage.findMany({
            where: and(
              eq(aiMessage.conversationId, c.id),
              gte(aiMessage.createdAt, new Date(runStart)),
            ),
            orderBy: [asc(aiMessage.createdAt)],
            columns: {
              id: true,
              role: true,
              parts: true,
              provider: true,
              inputTokens: true,
              outputTokens: true,
              createdAt: true,
            },
          }),
          receipts: await db.query.aiProposalConfirmation.findMany({
            where: and(
              eq(aiProposalConfirmation.conversationId, c.id),
              gte(aiProposalConfirmation.createdAt, new Date(runStart)),
            ),
          }),
        })),
      );
      const threads = collected.filter((c) => c.messages.length > 0);
      const ordinarySessions = await db
        .select({
          id: session.id,
          developerActorUserId: session.developerActorUserId,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
        })
        .from(session)
        .where(eq(session.userId, actor.id));
      return {
        key,
        userId: actor.id,
        roleId: actor.roleId,
        roleName: access.roleName,
        dataScope: access.dataScope,
        threads,
        ordinarySessions,
      };
    }),
  );
  const receipts = await db
    .select({
      id: aiProposalConfirmation.id,
      userId: aiProposalConfirmation.userId,
      conversationId: aiProposalConfirmation.conversationId,
      tenantId: aiProposalConfirmation.tenantId,
      toolCallId: aiProposalConfirmation.toolCallId,
    })
    .from(aiProposalConfirmation)
    .where(
      inArray(
        aiProposalConfirmation.userId,
        actors.map((a) => a.actor.id),
      ),
    );
  const proofKeys = receipts.map((r) => `${r.tenantId}/${r.toolCallId}`);
  const proofUnique = new Set(proofKeys).size === proofKeys.length;
  writeFileSync(
    `${dir}/browser-observations.json`,
    JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        runStart,
        observations,
        confirmationProofsUnique: proofUnique,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      file: `${dir}/browser-observations.json`,
      confirmationProofsUnique: proofUnique,
      actors: observations.map((a) => ({
        key: a.key,
        scope: a.dataScope,
        conversations: a.threads.map((t) => ({
          id: t.conversationId,
          messages: t.messages.length,
          receipts: t.receipts.length,
        })),
        ordinarySessionActorIdsClear: a.ordinarySessions.every(
          (s) => s.developerActorUserId === null,
        ),
      })),
    }),
  );
}
await pool.end();
