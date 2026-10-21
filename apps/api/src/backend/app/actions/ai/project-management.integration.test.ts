import { beforeAll, beforeEach, afterAll, expect, test, spyOn } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, eq, count } from "drizzle-orm";
import { db } from "@backend/db";
import {
  role,
  rolePermission,
  user,
  client,
  project,
  projectBudgets,
  projectBudgetCategory,
  projectExpenses,
  projectRap,
  rabEstimate,
  aiConversation,
  aiMessage,
  aiProposalConfirmation,
  auditLog,
  stockMovement,
  cashTransaction,
  projectProfitabilitySnapshot,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { withTestRequest } from "@backend/lib/testing/request";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { resolveActor, type Actor } from "@backend/server/actor";
import * as writers from "@backend/server/usecases/project/project-management-writer";
import { projectManagementInputSchema } from "@atria/core/ai/project-management";
import type { PermissionKey, RoleDataScope } from "@atria/core/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  getAiProjectManagementProposal,
  confirmAiProjectManagementProposal,
} from "./project-management";
import { activateProjectAction } from "@backend/app/actions/project/activation";
import { completeProject } from "@backend/app/actions/project/closing";
import { assignProjectManagerUseCase } from "@backend/server/usecases/project/assign-project-manager";
import { reallocateProjectBudget } from "@backend/app/actions/project/workflow-governance";
import {
  submitProjectBudget,
  approveProjectBudget,
  rejectProjectBudget,
} from "@backend/app/actions/project/excel-budget";
const prefix = `PROJECTAI-${randomUUID().slice(0, 6)}`;
const grants: PermissionKey[] = [
  "use:ai_chat",
  "view:project",
  "view:budget",
  "view:profitability",
  "update:budget",
  "approve:budget",
  "create:project",
  "activate:project",
  "close:project",
];
type Person = {
  id: string;
  roleId: string;
  name: string;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
};
const api = auth.api as unknown as { getSession: unknown },
  original = api.getSession;
let owner: Person,
  pm: Person,
  none: Person,
  limited: Person,
  clientId: string,
  projectId: string,
  budgetId: string;
let categoryRows: (typeof projectBudgetCategory.$inferSelect)[];
function as(person: Person): void {
  api.getSession = async () => ({
    user: person,
    session: { id: randomUUID(), userId: person.id, expiresAt: new Date(Date.now() + 3600000) },
  });
}
function ok<T>(result: ActionResponse<T>): T {
  if (!result.success) throw new Error(result.error.message);
  return result.data;
}
async function actor(): Promise<Actor> {
  const value = await withTestRequest(resolveActor)();
  if (!value) throw new Error("No Actor");
  return value;
}
async function person(scope: RoleDataScope, permissions: PermissionKey[]): Promise<Person> {
  const [r] = await db
    .insert(role)
    .values({ name: `${prefix}-${randomUUID().slice(0, 6)}`, dataScope: scope })
    .returning();
  await db
    .insert(rolePermission)
    .values(permissions.map((permissionKey) => ({ roleId: r.id, permissionKey })));
  const [p] = await db
    .insert(user)
    .values({
      name: r.name,
      email: `${randomUUID()}@fixture.invalid`,
      roleId: r.id,
      isActive: true,
      mustChangePassword: false,
    })
    .returning();
  return {
    id: p.id,
    roleId: r.id,
    name: p.name,
    email: p.email,
    isActive: true,
    mustChangePassword: false,
  };
}
async function proof(raw: unknown) {
  const proposal = await writers.prepareProjectManagementProposal(
    await actor(),
    projectManagementInputSchema.parse(raw),
  );
  const toolCallId = randomUUID();
  const [c] = await db
    .insert(aiConversation)
    .values({ userId: (await actor()).userId, title: prefix })
    .returning();
  const [m] = await db
    .insert(aiMessage)
    .values({
      conversationId: c.id,
      role: "assistant",
      parts: [
        {
          type: "tool-proposeProjectManagement",
          state: "output-available",
          toolCallId,
          output: { proposal },
        },
      ],
    })
    .returning();
  return { proposal, messageId: m.id, identity: { conversationId: c.id, toolCallId } };
}
const read = withTestRequest(getAiProjectManagementProposal),
  save = withTestRequest(confirmAiProjectManagementProposal);
async function currentProject() {
  return (await db.query.project.findFirst({ where: eq(project.id, projectId) }))!;
}
async function counts(): Promise<readonly number[]> {
  return Promise.all(
    [
      db.select({ n: count() }).from(cashTransaction),
      db.select({ n: count() }).from(stockMovement),
    ].map(async (q) => Number((await q)[0].n)),
  );
}
function allocate(amount = 420) {
  return {
    action: "REALLOCATE_BUDGET",
    projectId,
    projectBudgetId: budgetId,
    reason: "Penyesuaian kebutuhan material terbaru",
    categories: [
      { projectBudgetCategoryId: categoryRows[0].id, allocatedAmount: amount },
      { projectBudgetCategoryId: categoryRows[2].id, allocatedAmount: 80 },
    ],
  };
}
describeIntegration("AI project and canonical budget management", () => {
  beforeAll(async () => {
    owner = await person("GLOBAL", grants);
    pm = await person("ASSIGNED", grants);
    none = await person("NONE", grants);
    limited = await person(
      "GLOBAL",
      grants.filter((p) => p !== "approve:budget"),
    );
    const [c] = await db
      .insert(client)
      .values({ name: prefix, email: `${randomUUID()}@fixture.invalid`, phone: "08123456789" })
      .returning();
    clientId = c.id;
  });
  beforeEach(async () => {
    as(owner);
    const [p] = await db
      .insert(project)
      .values({
        name: prefix,
        clientId,
        projectManagerId: pm.id,
        status: "DRAFT",
        totalContractValue: "1000.00",
        notes: "Catatan yang dipertahankan",
      })
      .returning();
    projectId = p.id;
    const [b] = await db
      .insert(projectBudgets)
      .values({
        projectId,
        contractValue: "1000.00",
        internalBudget: "900.00",
        targetGrossAmount: "100.00",
        targetGrossPercentage: "10.0000",
      })
      .returning();
    budgetId = b.id;
    const definitions = await db.query.expenseCategory.findMany({
      where: (t, { eq }) => eq(t.tenantId, INSTANCE_TENANT_ID),
      orderBy: (t, { asc }) => asc(t.sortOrder),
      limit: 5,
    });
    categoryRows = await db
      .insert(projectBudgetCategory)
      .values(
        definitions.map((c, i) => ({
          projectBudgetId: b.id,
          expenseCategoryId: c.id,
          allocatedAmount: [400, 200, 100, 50, 50][i].toFixed(2),
          ratioPercentage: ([400, 200, 100, 50, 50][i] / 900).toFixed(6),
          sortOrder: i,
        })),
      )
      .returning();
  });
  afterAll(() => {
    api.getSession = original;
  });
  test(
    "metadata is partial, owned, audited and replay-safe without stock/cash writes",
    withTestRequest(async () => {
      const before = await counts(),
        p = await proof({ action: "EDIT_PROJECT", projectId, patch: { location: "Lokasi baru" } });
      expect(ok(await read(p.identity)).status).toBe("READY");
      const [a, b] = await Promise.all([save(p.identity), save(p.identity)]);
      expect(a.success && b.success).toBe(true);
      expect([ok(a).alreadyConfirmed, ok(b).alreadyConfirmed].filter(Boolean)).toHaveLength(1);
      expect((await currentProject()).notes).toBe("Catatan yang dipertahankan");
      expect((await currentProject()).location).toBe("Lokasi baru");
      expect(await counts()).toEqual(before);
      expect(
        await db
          .select({ n: count() })
          .from(auditLog)
          .where(and(eq(auditLog.targetId, projectId), eq(auditLog.action, "UPDATE_PROJECT"))),
      ).toEqual([{ n: 1 }]);
    }),
  );
  test(
    "custom dynamic permissions, ASSIGNED/NONE scope and foreign proof are enforced",
    withTestRequest(async () => {
      as(pm);
      const p = await proof({
        action: "EDIT_PROJECT",
        projectId,
        patch: { name: "Proyek ditugaskan" },
      });
      expect(ok(await read(p.identity)).status).toBe("READY");
      as(owner);
      expect((await read(p.identity)).success).toBe(false);
      as(none);
      await expect(
        writers.prepareProjectManagementProposal(await actor(), p.proposal.input),
      ).rejects.toThrow("Izin");
      as(pm);
      await db.update(project).set({ projectManagerId: owner.id }).where(eq(project.id, projectId));
      expect((await save(p.identity)).success).toBe(false);
    }),
  );
  test(
    "grant revocation, stale source, expiry and forged client payload block execution",
    withTestRequest(async () => {
      const p = await proof({ action: "EDIT_PROJECT", projectId, patch: { name: "Nama baru" } });
      await db
        .delete(rolePermission)
        .where(
          and(
            eq(rolePermission.roleId, owner.roleId),
            eq(rolePermission.permissionKey, "update:budget"),
          ),
        );
      expect((await save(p.identity)).success).toBe(false);
      await db
        .insert(rolePermission)
        .values({ roleId: owner.roleId, permissionKey: "update:budget" });
      await db.update(project).set({ notes: "Koreksi manual" }).where(eq(project.id, projectId));
      expect(ok(await read(p.identity)).status).toBe("STALE");
      expect((await save(p.identity)).success).toBe(false);
      const expired = await proof({
        action: "EDIT_PROJECT",
        projectId,
        patch: { location: "Baru" },
      });
      await db
        .update(aiMessage)
        .set({ createdAt: new Date(Date.now() - 31 * 86400000) })
        .where(eq(aiMessage.id, expired.messageId));
      expect(ok(await read(expired.identity)).status).toBe("EXPIRED");
      expect((await save(expired.identity)).success).toBe(false);
      expect((await save({ ...p.identity, patch: { name: "Bypass" } })).success).toBe(false);
    }),
  );
  test(
    "PM assignment uses active assigned-scope candidates and the shared manual writer",
    withTestRequest(async () => {
      await expect(
        writers.prepareProjectManagementProposal(await actor(), {
          action: "ASSIGN_PM",
          projectId,
          projectManagerId: owner.id,
        }),
      ).rejects.toThrow("scope");
      const replacement = await person("ASSIGNED", ["view:project"]);
      ok(
        await assignProjectManagerUseCase(await actor(), {
          projectId,
          projectManagerId: replacement.id,
        }),
      );
      expect((await currentProject()).projectManagerId).toBe(replacement.id);
      const p = await proof({ action: "ASSIGN_PM", projectId, projectManagerId: pm.id });
      ok(await save(p.identity));
      expect((await currentProject()).projectManagerId).toBe(pm.id);
    }),
  );
  test(
    "activation preserves all manual readiness gates and succeeds only against matching locked RAP/RAB",
    withTestRequest(async () => {
      const blocked = await proof({ action: "ACTIVATE_PROJECT", projectId });
      expect(ok(await read(blocked.identity)).status).toBe("BLOCKED");
      expect((await save(blocked.identity)).success).toBe(false);
      expect((await withTestRequest(activateProjectAction)({ projectId })).success).toBe(false);
      await db
        .update(projectBudgets)
        .set({ status: "APPROVED" })
        .where(eq(projectBudgets.id, budgetId));
      const [rap] = await db
        .insert(projectRap)
        .values({ projectId, status: "LOCKED", setupStage: "COMPLETE" })
        .returning();
      await db
        .insert(rabEstimate)
        .values({ projectId, sourceProjectRapId: rap.id, status: "APPROVED", title: prefix });
      const p = await proof({ action: "ACTIVATE_PROJECT", projectId });
      ok(await save(p.identity));
      expect((await currentProject()).status).toBe("ACTIVE");
    }),
  );
  test(
    "budget submit/reject/approve use canonical status and dynamic grants, retaining reason",
    withTestRequest(async () => {
      ok(await withTestRequest(submitProjectBudget)(budgetId));
      as(limited);
      expect((await withTestRequest(approveProjectBudget)(budgetId)).success).toBe(false);
      as(owner);
      const reject = await proof({
        action: "REJECT_BUDGET",
        projectId,
        projectBudgetId: budgetId,
        reason: "Perbaiki alokasi operasional",
      });
      ok(await save(reject.identity));
      expect(
        (await db.query.projectBudgets.findFirst({ where: eq(projectBudgets.id, budgetId) }))
          ?.notes,
      ).toContain("Perbaiki alokasi");
      ok(await withTestRequest(submitProjectBudget)(budgetId));
      const approval = await proof({
        action: "APPROVE_BUDGET",
        projectId,
        projectBudgetId: budgetId,
      });
      ok(await save(approval.identity));
      expect(
        (await db.query.projectBudgets.findFirst({ where: eq(projectBudgets.id, budgetId) }))
          ?.approvedById,
      ).toBe(owner.id);
      expect(
        (await withTestRequest(rejectProjectBudget)(budgetId, "Tidak sedang pending")).success,
      ).toBe(false);
    }),
  );
  test(
    "partial allocation checks complete cap, preserves unchanged categories, and protects approved budgets",
    withTestRequest(async () => {
      await expect(
        writers.prepareProjectManagementProposal(await actor(), allocate(600)),
      ).rejects.toThrow("seluruh kategori");
      const p = await proof(allocate());
      const before = await counts();
      ok(await save(p.identity));
      const all = await db.query.projectBudgetCategory.findMany({
        where: eq(projectBudgetCategory.projectBudgetId, budgetId),
        orderBy: (t, { asc }) => asc(t.sortOrder),
      });
      expect(all.map((r) => r.allocatedAmount)).toEqual([
        "420.00",
        "200.00",
        "80.00",
        "50.00",
        "50.00",
      ]);
      expect(await counts()).toEqual(before);
      await db
        .update(projectBudgets)
        .set({ status: "APPROVED" })
        .where(eq(projectBudgets.id, budgetId));
      as(limited);
      await expect(
        writers.prepareProjectManagementProposal(await actor(), allocate()),
      ).rejects.toThrow("persetujuan");
      as(owner);
      expect(
        (
          await withTestRequest(reallocateProjectBudget)({
            projectBudgetId: budgetId,
            categories: [{ projectBudgetCategoryId: all[0].id, ratioPercentage: 0.7 }],
            reason: "Perubahan input manual dengan batas",
          })
        ).success,
      ).toBe(false);
    }),
  );
  test(
    "live realization and plan risk appear in preview, and partial writer rollback leaves no receipt",
    withTestRequest(async () => {
      await db.insert(projectExpenses).values({
        projectId,
        projectBudgetId: budgetId,
        projectBudgetCategoryId: categoryRows[0].id,
        expenseCategoryId: categoryRows[0].expenseCategoryId,
        requestedById: owner.id,
        description: prefix,
        amount: "450.01",
        status: "APPROVED",
        isCashImpact: false,
      });
      const p = await proof(allocate());
      expect(p.proposal.warnings.some((w) => w.includes("realisasi"))).toBe(true);
      expect(p.proposal.rows[0].details.find((r) => r.label === "Realisasi")?.value).toBe(450.01);
      const write = writers.writeProjectManagementTx;
      const spy = spyOn(writers, "writeProjectManagementTx").mockImplementation(async (...args) => {
        await write(...args);
        throw new writers.ProjectManagementError("CONFLICT", "Gagal setelah baris ditulis");
      });
      try {
        expect((await save(p.identity)).success).toBe(false);
      } finally {
        spy.mockRestore();
      }
      expect(
        (
          await db.query.projectBudgetCategory.findFirst({
            where: eq(projectBudgetCategory.id, categoryRows[0].id),
          })
        )?.allocatedAmount,
      ).toBe("400.00");
      expect(
        await db.query.aiProposalConfirmation.findFirst({
          where: eq(aiProposalConfirmation.toolCallId, p.identity.toolCallId),
        }),
      ).toBeUndefined();
    }),
  );
  test(
    "manual/AI races serialize on the project and stale allocation cannot overwrite a manual decision",
    withTestRequest(async () => {
      const p = await proof(allocate());
      ok(
        await withTestRequest(reallocateProjectBudget)({
          projectBudgetId: budgetId,
          reason: "Koreksi manual sebelum konfirmasi AI",
          categories: [{ projectBudgetCategoryId: categoryRows[0].id, ratioPercentage: 0.4 }],
        }),
      );
      expect((await save(p.identity)).success).toBe(false);
      expect(
        (
          await db.query.projectBudgetCategory.findFirst({
            where: eq(projectBudgetCategory.id, categoryRows[0].id),
          })
        )?.allocatedAmount,
      ).toBe("360.00");
      const [a, b] = await Promise.all([
        withTestRequest(approveProjectBudget)(budgetId),
        withTestRequest(submitProjectBudget)(budgetId),
      ]);
      expect(b.success).toBe(true);
      if (!a.success) ok(await withTestRequest(approveProjectBudget)(budgetId));
      expect(
        (await db.query.projectBudgets.findFirst({ where: eq(projectBudgets.id, budgetId) }))
          ?.status,
      ).toBe("APPROVED");
    }),
  );
  test(
    "approved-allocation receipt still rechecks approval authority after revocation",
    withTestRequest(async () => {
      await db
        .update(projectBudgets)
        .set({ status: "APPROVED" })
        .where(eq(projectBudgets.id, budgetId));
      const p = await proof(allocate());
      ok(await save(p.identity));
      await db
        .delete(rolePermission)
        .where(
          and(
            eq(rolePermission.roleId, owner.roleId),
            eq(rolePermission.permissionKey, "approve:budget"),
          ),
        );
      try {
        expect((await read(p.identity)).success).toBe(false);
        expect((await save(p.identity)).success).toBe(false);
      } finally {
        await db
          .insert(rolePermission)
          .values({ roleId: owner.roleId, permissionKey: "approve:budget" });
      }
    }),
  );
  test(
    "closing stays blocked for real obligations; a ready project closes once with atomic final snapshot",
    withTestRequest(async () => {
      const blocked = await proof({
        action: "COMPLETE_PROJECT",
        projectId,
        closingNote: "Seluruh dokumen ditinjau pengguna",
      });
      expect(blocked.proposal.blockers.length).toBeGreaterThan(0);
      expect((await save(blocked.identity)).success).toBe(false);
      await db
        .update(project)
        .set({ status: "ACTIVE", totalContractValue: "0.00" })
        .where(eq(project.id, projectId));
      await db
        .update(projectBudgets)
        .set({ status: "APPROVED", contractValue: "0.00", internalBudget: "0.00" })
        .where(eq(projectBudgets.id, budgetId));
      await db.insert(rabEstimate).values({ projectId, status: "APPROVED", title: prefix });
      const p = await proof({
        action: "COMPLETE_PROJECT",
        projectId,
        closingNote: "Seluruh dokumen final telah diperiksa",
      });
      const before = await counts();
      const [a, b] = await Promise.all([save(p.identity), save(p.identity)]);
      expect(a.success && b.success).toBe(true);
      expect(await counts()).toEqual(before);
      expect((await currentProject()).status).toBe("COMPLETED");
      expect(
        await db
          .select({ n: count() })
          .from(projectProfitabilitySnapshot)
          .where(eq(projectProfitabilitySnapshot.projectId, projectId)),
      ).toEqual([{ n: 1 }]);
      expect(
        (
          await withTestRequest(completeProject)({
            projectId,
            closingNote: "Permintaan penutupan kedua ditolak",
          })
        ).success,
      ).toBe(false);
    }),
  );
});
