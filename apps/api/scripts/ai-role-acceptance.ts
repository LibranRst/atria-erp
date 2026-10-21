import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { db, pool } from "../src/backend/db";
import {
  user,
  role,
  rolePermission,
  account,
  tenantMember,
  INSTANCE_TENANT_ID,
  client,
  project,
  projectBudgets,
  projectBudgetCategory,
  bankAccount,
  cashTransaction,
  projectExpenses,
  materialCategory,
  materialMaster,
  materialInventory,
  inventoryLocation,
  stockMovement,
  aiConversation,
  aiMessage,
  aiProposalConfirmation,
  appConfig,
} from "../src/backend/db/schema";
import { auth } from "../src/backend/lib/auth";
import { SYSTEM_ROLES } from "@atria/core/auth/role-constants";
import { ROLE_PERMISSIONS, type PermissionKey } from "@atria/core/auth/permissions";
import { readBudgetAllocationSnapshot } from "../src/backend/lib/budget/allocation-defaults";
import { insertProjectWithCanonicalBudgetTx } from "../src/backend/server/usecases/project/project-creation-write";
import { getRoleAccess } from "../src/backend/lib/auth/role-access";
import { aiCapabilityReport } from "../src/backend/lib/ai/tools/capability-catalog";

const target = new URL(process.env.ATRIA_TEST_DATABASE_URL ?? "http://invalid");
if (
  target.hostname !== "127.0.0.1" ||
  target.port !== "32774" ||
  target.pathname !== "/atria_audit_reconciliation" ||
  process.env.NODE_ENV === "production"
)
  throw new Error("Named disposable Browser role database only");
const qa = await db.query.user.findFirst({
  where: eq(user.email, "reconciliation-qa@fixture.invalid"),
});
if (!qa) throw new Error("Synthetic QA actor required");
const qaRole = await db.query.role.findFirst({ where: eq(role.id, qa.roleId) });
if (!qaRole || qaRole.isSystem || !qaRole.name.startsWith("QA Rekonsiliasi "))
  throw new Error("Synthetic source role required");
const mode = z
  .enum([
    "inspect",
    "seed",
    "snapshot",
    "observe",
    "revoke-stock",
    "restore-stock",
    "revoke-chat",
    "restore-chat",
  ])
  .parse(process.argv[2]);
const fixturePath = "/tmp/atria-ai-role-fixture.json";
const fixtureSchema = z.object({
  startedAt: z.string(),
  actors: z.array(
    z.object({
      key: z.string(),
      userId: z.guid(),
      roleId: z.guid(),
      email: z.string(),
      name: z.string(),
    }),
  ),
  projects: z.array(z.object({ id: z.guid(), name: z.string(), managerId: z.guid() })),
  locationId: z.guid(),
  materialId: z.guid(),
  inventoryId: z.guid(),
  clientId: z.guid(),
  existingProjectIds: z.array(z.guid()),
});
type RoleFixture = z.infer<typeof fixtureSchema>;
function readFixture(): RoleFixture {
  return fixtureSchema.parse(JSON.parse(readFileSync(fixturePath, "utf8")));
}
if (mode === "inspect") {
  const roles = await db.select().from(role);
  const permissions = await db.select().from(rolePermission);
  console.log(
    JSON.stringify(
      roles
        .filter(
          (r) =>
            r.isSystem ||
            ["owner", "finance_admin", "purchasing", "project_manager", "designer"].includes(
              r.name.toLowerCase(),
            ),
        )
        .map((r) => ({
          id: r.id,
          name: r.name,
          scope: r.dataScope,
          isSystem: r.isSystem,
          permissions: permissions
            .filter((p) => p.roleId === r.id)
            .map((p) => p.permissionKey)
            .sort(),
        })),
    ),
  );
  console.log(
    JSON.stringify(
      (
        await db
          .select({ id: bankAccount.id, name: bankAccount.name, tenantId: bankAccount.tenantId })
          .from(bankAccount)
      ).filter((a) => a.tenantId !== INSTANCE_TENANT_ID),
    ),
  );
}
if (mode === "seed" && !existsSync(fixturePath)) {
  // Canonical seed roles do not exist in this prior custom-role-only QA database.
  // Never overwrite a role's live grants to force this acceptance to pass.
  if (
    (
      await db
        .select()
        .from(role)
        .where(
          inArray(
            role.id,
            SYSTEM_ROLES.map((r) => r.id),
          ),
        )
    ).length
  )
    throw new Error("Canonical roles already exist; inspect rather than overwrite");
  const password = randomBytes(24).toString("base64url");
  const passwordHash = await auth.$context.then((context) => context.password.hash(password));
  const existingProjectIds = (await db.select({ id: project.id }).from(project)).map((p) => p.id);
  const actors: RoleFixture["actors"] = [];
  const projects: RoleFixture["projects"] = [];
  let locationId = "",
    materialId = "",
    inventoryId = "",
    clientId = "";
  await db.transaction(async (tx) => {
    await tx.insert(role).values([...SYSTEM_ROLES]);
    await tx.insert(rolePermission).values(
      SYSTEM_ROLES.flatMap((r) =>
        (ROLE_PERMISSIONS[r.name.toUpperCase()] ?? []).map((permissionKey) => ({
          roleId: r.id,
          permissionKey,
        })),
      ),
    );
    const custom: readonly {
      key: string;
      name: string;
      scope: "GLOBAL" | "NONE";
      permissions: readonly PermissionKey[];
    }[] = [
      {
        key: "custom_none",
        name: "Owner QA · hanya chat",
        scope: "NONE",
        permissions: ["use:ai_chat", "view:project", "view:budget"],
      },
      {
        key: "revoker",
        name: "QA Role · koreksi stok",
        scope: "NONE",
        permissions: ["use:ai_chat", "view:material", "view:inventory", "adjust:stock"],
      },
      {
        key: "no_ai",
        name: "QA Role · tanpa AI",
        scope: "GLOBAL",
        permissions: ["view:project", "view:budget"],
      },
    ];
    const roleIds: Record<string, string> = {
      owner: SYSTEM_ROLES[0].id,
      finance: SYSTEM_ROLES[1].id,
      pm_a: SYSTEM_ROLES[2].id,
      pm_b: SYSTEM_ROLES[2].id,
      purchasing: SYSTEM_ROLES[3].id,
    };
    for (const r of custom) {
      const [row] = await tx
        .insert(role)
        .values({ name: r.name, dataScope: r.scope, isSystem: false })
        .returning();
      roleIds[r.key] = row.id;
      await tx
        .insert(rolePermission)
        .values(r.permissions.map((permissionKey) => ({ roleId: row.id, permissionKey })));
    }
    for (const key of [
      "owner",
      "finance",
      "purchasing",
      "pm_a",
      "pm_b",
      "custom_none",
      "revoker",
      "no_ai",
    ]) {
      const [row] = await tx
        .insert(user)
        .values({
          name: `QA Role ${key.toUpperCase()}`,
          email: `ai-role-${key}@fixture.invalid`,
          emailVerified: true,
          roleId: roleIds[key],
          isActive: true,
          mustChangePassword: false,
        })
        .returning();
      await tx.insert(tenantMember).values({
        tenantId: INSTANCE_TENANT_ID,
        userId: row.id,
        roleId: row.roleId,
        isActive: true,
      });
      await tx.insert(account).values({
        id: crypto.randomUUID(),
        accountId: row.id,
        providerId: "credential",
        userId: row.id,
        password: passwordHash,
      });
      actors.push({ key, userId: row.id, roleId: row.roleId, email: row.email, name: row.name });
    }
    const [c] = await tx
      .insert(client)
      .values({
        name: "Klien Role QA",
        email: "client-role-qa@fixture.invalid",
        phone: "-",
        address: "Data sintetis",
      })
      .returning();
    clientId = c.id;
    const allocation = await readBudgetAllocationSnapshot(tx);
    if (!allocation.settingId || allocation.categories.length !== 5)
      throw new Error("Actual complete QA Settings required");
    for (const key of ["pm_a", "pm_b"]) {
      const pm = actors.find((a) => a.key === key);
      if (!pm) throw new Error("Missing QA PM");
      const result = await insertProjectWithCanonicalBudgetTx({
        tx,
        allocation,
        input: {
          name: key === "pm_a" ? "Proyek Role QA A" : "Proyek Role QA B",
          clientId,
          projectManagerId: pm.userId,
          totalContractValue: key === "pm_a" ? 111000000.25 : 222000000.5,
          notes: "Fixture izin AI, data sintetis",
        },
      });
      await tx.update(project).set({ status: "ACTIVE" }).where(eq(project.id, result.project.id));
      projects.push({ id: result.project.id, name: result.project.name, managerId: pm.userId });
    }
    const [category] = await tx
      .insert(materialCategory)
      .values({ name: "Kategori Role QA" })
      .returning();
    const [m] = await tx
      .insert(materialMaster)
      .values({ name: "Panel Role QA", unit: "lembar", categoryId: category.id })
      .returning();
    materialId = m.id;
    const [l] = await tx.insert(inventoryLocation).values({ name: "Gudang Role QA" }).returning();
    locationId = l.id;
    const [i] = await tx
      .insert(materialInventory)
      .values({
        materialId,
        locationId,
        currentStock: "30.00",
        reservedStock: "4.00",
        averageCost: "11000.00",
        lastPurchasePrice: "12000.00",
        minimumStock: "2.00",
      })
      .returning();
    inventoryId = i.id;
  });
  const fixture: RoleFixture = {
    startedAt: new Date().toISOString(),
    actors,
    projects,
    locationId,
    materialId,
    inventoryId,
    clientId,
    existingProjectIds,
  };
  writeFileSync(fixturePath, JSON.stringify(fixture, null, 2), { mode: 0o600 });
  writeFileSync(
    "/tmp/atria-ai-role-credentials.json",
    JSON.stringify({ password, actors: actors.map(({ key, email }) => ({ key, email })) }),
    { mode: 0o600 },
  );
  console.log(JSON.stringify(fixture));
}
if (mode.startsWith("revoke-") || mode.startsWith("restore-")) {
  const fixture = readFixture();
  const targetActor = fixture.actors.find((a) => a.key === "revoker");
  if (!targetActor) throw new Error("Synthetic revoker required");
  const r = await db.query.role.findFirst({ where: eq(role.id, targetActor.roleId) });
  if (!r || r.isSystem || r.name !== "QA Role · koreksi stok")
    throw new Error("Exact synthetic role only");
  const permissionKey: PermissionKey = mode.endsWith("stock") ? "adjust:stock" : "use:ai_chat";
  if (mode.startsWith("revoke-"))
    await db
      .delete(rolePermission)
      .where(and(eq(rolePermission.roleId, r.id), eq(rolePermission.permissionKey, permissionKey)));
  else
    await db.insert(rolePermission).values({ roleId: r.id, permissionKey }).onConflictDoNothing();
  console.log(JSON.stringify({ mode, roleId: r.id, permissionKey }));
}
if (mode === "observe") {
  const fixture = readFixture();
  const result = [];
  for (const actor of fixture.actors) {
    const access = await getRoleAccess(actor.roleId);
    if (!access) throw new Error("Role access missing");
    const conversations = await db.query.aiConversation.findMany({
      where: eq(aiConversation.userId, actor.userId),
      orderBy: [asc(aiConversation.createdAt)],
    });
    const threads = [];
    for (const c of conversations) {
      const messages = await db.query.aiMessage.findMany({
        where: eq(aiMessage.conversationId, c.id),
        orderBy: [asc(aiMessage.createdAt)],
        columns: {
          id: true,
          role: true,
          parts: true,
          provider: true,
          inputTokens: true,
          outputTokens: true,
        },
      });
      const receipts = await db.query.aiProposalConfirmation.findMany({
        where: eq(aiProposalConfirmation.conversationId, c.id),
      });
      threads.push({ conversationId: c.id, title: c.title, messages, receipts });
    }
    result.push({
      actor,
      access,
      capabilities: aiCapabilityReport({ ...access, userId: actor.userId }),
      conversations: threads,
    });
  }
  writeFileSync("/tmp/atria-ai-role-observation.json", JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify(
      result.map((r) => ({
        key: r.actor.key,
        scope: r.access.dataScope,
        conversations: r.conversations.map((c) => ({
          id: c.conversationId,
          messages: c.messages.length,
          receipts: c.receipts.length,
        })),
      })),
    ),
  );
}
if (mode === "snapshot") {
  const fixture = readFixture();
  const allProjects = await db.select().from(project).orderBy(asc(project.id));
  const protectedIds = [...fixture.existingProjectIds, ...fixture.projects.map((p) => p.id)];
  const budgets = await db
    .select()
    .from(projectBudgets)
    .where(inArray(projectBudgets.projectId, protectedIds))
    .orderBy(asc(projectBudgets.id));
  const categories = await db
    .select()
    .from(projectBudgetCategory)
    .where(
      inArray(
        projectBudgetCategory.projectBudgetId,
        budgets.map((b) => b.id),
      ),
    )
    .orderBy(asc(projectBudgetCategory.id));
  const protectedRows = await Promise.all([
    db.select().from(cashTransaction).orderBy(asc(cashTransaction.id)),
    db.select().from(bankAccount).orderBy(asc(bankAccount.id)),
    db.select().from(projectExpenses).orderBy(asc(projectExpenses.id)),
    db.select().from(materialInventory).orderBy(asc(materialInventory.id)),
    db.select().from(stockMovement).orderBy(asc(stockMovement.id)),
    db.select().from(appConfig).orderBy(asc(appConfig.key)),
  ]);
  const actors = await db
    .select({
      id: user.id,
      name: user.name,
      roleId: user.roleId,
      active: user.isActive,
      image: user.image,
    })
    .from(user)
    .where(
      inArray(
        user.id,
        fixture.actors.map((a) => a.userId),
      ),
    )
    .orderBy(asc(user.id));
  const receipts = await db
    .select()
    .from(aiProposalConfirmation)
    .where(
      inArray(
        aiProposalConfirmation.userId,
        fixture.actors.map((a) => a.userId),
      ),
    )
    .orderBy(desc(aiProposalConfirmation.createdAt));
  const createdProjects = allProjects.filter((p) => !protectedIds.includes(p.id));
  const createdBudgets = createdProjects.length
    ? await db
        .select()
        .from(projectBudgets)
        .where(
          inArray(
            projectBudgets.projectId,
            createdProjects.map((p) => p.id),
          ),
        )
    : [];
  const createdCategories = createdBudgets.length
    ? await db
        .select()
        .from(projectBudgetCategory)
        .where(
          inArray(
            projectBudgetCategory.projectBudgetId,
            createdBudgets.map((b) => b.id),
          ),
        )
    : [];
  const hash = (value: unknown): string =>
    createHash("sha256").update(JSON.stringify(value)).digest("hex");
  console.log(
    JSON.stringify({
      protectedHash: hash(protectedRows),
      existingBudgetsHash: hash([budgets, categories]),
      actors,
      receipts,
      createdProjects,
      createdBudgets,
      createdCategories,
    }),
  );
}
await pool.end();
