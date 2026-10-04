import { withTestRequest } from "@backend/lib/testing/request";
import { afterAll, expect, test } from "bun:test";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { and, eq } from "drizzle-orm";

import { createProjectAction } from "@backend/app/actions/project/crud";
import { voidRabRevision } from "@backend/app/actions/project/revision-change-order";
import { db } from "@backend/db";
import {
  auditLog,
  project,
  projectBudgetCategory,
  projectBudgets,
  projectChangeOrder,
  rabEstimate,
} from "@backend/db/schema";
import { auth } from "@backend/lib/auth";

const originalGetSession = (auth.api as unknown as { getSession: unknown }).getSession;
const owner = {
  id: "11111111-1111-1111-1111-111111111111",
  roleId: "00000000-0000-0000-0000-000000000001",
  email: "ronald@dekoria.com",
  name: "Ronald Wijaya",
};

function mockOwnerSession(): void {
  (auth.api as unknown as { getSession: unknown }).getSession = async () => ({
    session: {
      id: "rab-void-session",
      userId: owner.id,
      expiresAt: new Date(Date.now() + 3600000),
    },
    user: {
      ...owner,
      emailVerified: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

describeIntegration("voidRabRevision", () => {
  afterAll(
    withTestRequest(() => {
      (auth.api as unknown as { getSession: unknown }).getSession = originalGetSession;
    }),
  );

  test(
    "voids a draft revision and cancels its open Change Order without changing the approved baseline",
    withTestRequest(async () => {
      mockOwnerSession();
      const client = await db.query.client.findFirst();
      if (!client) throw new Error("Seed client tidak tersedia.");
      const created = await createProjectAction({
        name: `RAB Void Test ${crypto.randomUUID()}`,
        clientId: client.id,
        projectManagerId: "33333333-3333-3333-3333-333333333331",
        status: "DRAFT",
      });
      expect(created.success).toBeTrue();
      if (!created.success) return;

      const projectId = created.data.id;
      const baseId = crypto.randomUUID();
      const revisionId = crypto.randomUUID();
      const changeOrderId = crypto.randomUUID();
      try {
        await db.insert(rabEstimate).values([
          {
            id: baseId,
            projectId,
            status: "APPROVED",
            revision: 1,
            title: "RAB Approved",
            approvedValue: "100000000.00",
            approvedAt: new Date(),
          },
          {
            id: revisionId,
            projectId,
            supersedesRabEstimateId: baseId,
            status: "DRAFT",
            revision: 2,
            title: "RAB Revision",
          },
        ]);
        await db.insert(projectChangeOrder).values({
          id: changeOrderId,
          projectId,
          baseRabEstimateId: baseId,
          revisedRabEstimateId: revisionId,
          status: "PENDING_APPROVAL",
          reason: "Client meminta perubahan scope.",
          scopeSummary: "Scope lama diganti dengan scope baru.",
          previousContractValue: "100000000.00",
          valueDelta: "0.00",
          revisedContractValue: "100000000.00",
          clientConfirmedAt: new Date(),
          clientConfirmationReference: "Email client",
          createdById: owner.id,
        });

        const result = await voidRabRevision({
          rabEstimateId: revisionId,
          reason: "Client membatalkan perubahan",
        });
        if (!result.success) throw new Error(result.error.message);
        expect(result.success).toBeTrue();
        const base = await db.query.rabEstimate.findFirst({ where: eq(rabEstimate.id, baseId) });
        const revision = await db.query.rabEstimate.findFirst({
          where: eq(rabEstimate.id, revisionId),
        });
        const changeOrder = await db.query.projectChangeOrder.findFirst({
          where: eq(projectChangeOrder.id, changeOrderId),
        });
        const audit = await db.query.auditLog.findFirst({
          where: and(eq(auditLog.targetId, revisionId), eq(auditLog.action, "VOID_RAB_REVISION")),
        });
        expect(base?.status).toBe("APPROVED");
        expect(revision?.status).toBe("VOID");
        expect(revision?.voidReason).toBe("Client membatalkan perubahan");
        expect(revision?.voidedById).toBe(owner.id);
        expect(changeOrder?.status).toBe("CANCELLED");
        expect(audit).toBeDefined();
      } finally {
        await db.delete(auditLog).where(eq(auditLog.targetId, revisionId));
        await db.delete(auditLog).where(eq(auditLog.targetId, changeOrderId));
        await db.delete(projectChangeOrder).where(eq(projectChangeOrder.projectId, projectId));
        await db.delete(rabEstimate).where(eq(rabEstimate.projectId, projectId));
        const budget = await db.query.projectBudgets.findFirst({
          where: eq(projectBudgets.projectId, projectId),
        });
        if (budget) {
          await db
            .delete(projectBudgetCategory)
            .where(eq(projectBudgetCategory.projectBudgetId, budget.id));
          await db.delete(projectBudgets).where(eq(projectBudgets.id, budget.id));
        }
        await db.delete(project).where(eq(project.id, projectId));
      }
    }),
  );
});
