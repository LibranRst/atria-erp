"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLog,
  projectBudgets,
  projectCategoryPlanItem,
  projectChangeOrder,
  projectRap,
  projectRapItem,
  rabEstimate,
  rabEstimateItem,
} from "@/db/schema";
import { calculateRabSellingUnitPrice } from "@/lib/project/rap-rab";
import { calculateQuotationTotal } from "@/lib/project/quotation-total";
import { assertRabRevisionCanBeVoided, isOpenChangeOrderStatus } from "@/lib/project/rab-selection";
import type { ActionResponse } from "@/lib/types/action-response";
import {
  confirmChangeOrderClientSchema,
  createCategoryPlanRevisionSchema,
  createChangeOrderSchema,
  createRapRevisionSchema,
  refreshRabSourcesSchema,
  voidRabRevisionSchema,
} from "@/lib/validations/workflow-governance";
import {
  assertRevisionProjectScope,
  getRevisionActionUser,
  revisionActionFailure,
} from "./revision-change-order-utils";
import { approveProjectChangeOrder as approveProjectChangeOrderWrite } from "./revision-change-order-approval";

type Rap = typeof projectRap.$inferSelect;
type CategoryPlan = typeof projectCategoryPlanItem.$inferSelect;
type ChangeOrder = typeof projectChangeOrder.$inferSelect;

export async function createRapRevision(input: unknown): Promise<ActionResponse<Rap>> {
  const validation = createRapRevisionSchema.safeParse(input);
  if (!validation.success) return { success: false, error: { code: "VALIDATION_ERROR", message: validation.error.issues[0]?.message ?? "Revision RAP tidak valid." } };
  const user = await getRevisionActionUser();
  if (!user) return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction(async (tx) => {
      const source = await tx.query.projectRap.findFirst({
        where: eq(projectRap.id, validation.data.projectRapId),
        with: { items: true },
      });
      if (!source) throw new Error("RAP_NOT_FOUND");
      if (source.status !== "LOCKED") throw new Error("Hanya RAP LOCKED yang dapat dibuatkan revision.");
      await assertRevisionProjectScope(user, source.projectId, "update:rap");
      const openRevision = await tx.query.projectRap.findFirst({ where: and(eq(projectRap.projectId, source.projectId), eq(projectRap.status, "DRAFT")) });
      if (openRevision) throw new Error("Revision RAP DRAFT sudah tersedia.");
      const [revision] = await tx.insert(projectRap).values({
        projectId: source.projectId,
        supersedesProjectRapId: source.id,
        status: "DRAFT",
        revision: source.revision + 1,
        notes: validation.data.reason,
      }).returning();
      if (source.items.length > 0) {
        await tx.insert(projectRapItem).values(source.items.map((item) => ({
          projectRapId: revision.id,
          materialId: item.materialId,
          sourceLibraryItemId: item.sourceLibraryItemId,
          area: item.area,
          name: item.name,
          description: item.description,
          requiredQuantity: item.requiredQuantity,
          bufferQuantity: item.bufferQuantity,
          totalQuantity: item.totalQuantity,
          unit: item.unit,
          estimatedUnitCost: item.estimatedUnitCost,
          estimatedTotalCost: item.estimatedTotalCost,
          suggestedClientUnitPrice: item.suggestedClientUnitPrice,
          source: item.source,
          status: item.status,
          internalNote: item.internalNote,
        })));
      }
      await tx.insert(auditLog).values({
        userId: user.id,
        action: "CREATE_RAP_REVISION",
        targetTable: "project_rap",
        targetId: revision.id,
        originalState: JSON.stringify(source),
        newState: JSON.stringify({ ...revision, reason: validation.data.reason }),
      });
      return revision;
    });
    revalidatePath(`/projects/${result.projectId}`);
    return { success: true, data: result };
  } catch (error) {
    return revisionActionFailure(error, "Gagal membuat revision RAP.");
  }
}

export async function createCategoryPlanRevision(input: unknown): Promise<ActionResponse<CategoryPlan>> {
  const validation = createCategoryPlanRevisionSchema.safeParse(input);
  if (!validation.success) return { success: false, error: { code: "VALIDATION_ERROR", message: validation.error.issues[0]?.message ?? "Revision package tidak valid." } };
  const user = await getRevisionActionUser();
  if (!user) return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction(async (tx) => {
      const source = await tx.query.projectCategoryPlanItem.findFirst({ where: eq(projectCategoryPlanItem.id, validation.data.projectCategoryPlanItemId) });
      if (!source) throw new Error("CATEGORY_PLAN_ITEM_NOT_FOUND");
      if (source.status !== "LOCKED") throw new Error("Hanya package LOCKED yang dapat dibuatkan revision.");
      await assertRevisionProjectScope(user, source.projectId, "update:budget");
      const [revision] = await tx.insert(projectCategoryPlanItem).values({
        projectId: source.projectId,
        projectBudgetId: source.projectBudgetId,
        projectBudgetCategoryId: source.projectBudgetCategoryId,
        expenseCategoryId: source.expenseCategoryId,
        vendorId: source.vendorId,
        sourceLibraryItemId: source.sourceLibraryItemId,
        supersedesProjectCategoryPlanItemId: source.id,
        revision: source.revision + 1,
        name: source.name,
        scopeDescription: source.scopeDescription,
        area: source.area,
        quantity: source.quantity,
        unit: source.unit,
        estimatedUnitCost: source.estimatedUnitCost,
        estimatedTotalCost: source.estimatedTotalCost,
        suggestedClientUnitPrice: source.suggestedClientUnitPrice,
        status: "DRAFT",
        internalNote: validation.data.reason,
        displayOrder: source.displayOrder,
      }).returning();
      await tx.insert(auditLog).values({
        userId: user.id,
        action: "CREATE_CATEGORY_PLAN_REVISION",
        targetTable: "project_category_plan_item",
        targetId: revision.id,
        originalState: JSON.stringify(source),
        newState: JSON.stringify({ ...revision, reason: validation.data.reason }),
      });
      return revision;
    });
    revalidatePath(`/projects/${result.projectId}`);
    return { success: true, data: result };
  } catch (error) {
    return revisionActionFailure(error, "Gagal membuat revision package.");
  }
}

export async function refreshRabLinkedSources(input: unknown): Promise<ActionResponse<{ readonly rabEstimateId: string; readonly refreshedCount: number }>> {
  const validation = refreshRabSourcesSchema.safeParse(input);
  if (!validation.success) return { success: false, error: { code: "VALIDATION_ERROR", message: "RAB tidak valid." } };
  const user = await getRevisionActionUser();
  if (!user) return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction(async (tx) => {
      const estimate = await tx.query.rabEstimate.findFirst({
        where: eq(rabEstimate.id, validation.data.rabEstimateId),
        with: { items: true },
      });
      if (!estimate) throw new Error("RAB_NOT_FOUND");
      if (estimate.status !== "DRAFT") throw new Error("Hanya RAB DRAFT yang dapat di-refresh.");
      await assertRevisionProjectScope(user, estimate.projectId, "update:rab");
      const budget = await tx.query.projectBudgets.findFirst({ where: eq(projectBudgets.projectId, estimate.projectId) });
      const targetGrossPercentage = Number(budget?.targetGrossPercentage ?? 10);
      let refreshedCount = 0;
      for (const line of estimate.items) {
        if (line.sourceProjectRapItemId) {
          const source = await tx.query.projectRapItem.findFirst({ where: eq(projectRapItem.id, line.sourceProjectRapItemId), with: { rap: true } });
          if (!source) continue;
          const quantity = Number(source.totalQuantity);
          const unitPrice = Number(source.suggestedClientUnitPrice) > 0
            ? Number(source.suggestedClientUnitPrice)
            : calculateRabSellingUnitPrice({ costUnitPrice: Number(source.estimatedUnitCost), targetGrossPercentage });
          await tx.update(rabEstimateItem).set({
            sourceLibraryItemId: source.sourceLibraryItemId,
            sourceRevision: source.rap.revision,
            sourceUpdatedAt: source.updatedAt,
            quantity: quantity.toFixed(2),
            unit: source.unit,
            unitPrice: unitPrice.toFixed(2),
            lineTotal: (quantity * unitPrice).toFixed(2),
            updatedAt: new Date(),
          }).where(eq(rabEstimateItem.id, line.id));
          refreshedCount += 1;
        } else if (line.sourceProjectCategoryPlanItemId) {
          const source = await tx.query.projectCategoryPlanItem.findFirst({ where: eq(projectCategoryPlanItem.id, line.sourceProjectCategoryPlanItemId) });
          if (!source) continue;
          const quantity = Number(source.quantity);
          const unitPrice = Number(source.suggestedClientUnitPrice) > 0
            ? Number(source.suggestedClientUnitPrice)
            : calculateRabSellingUnitPrice({ costUnitPrice: Number(source.estimatedUnitCost), targetGrossPercentage });
          await tx.update(rabEstimateItem).set({
            sourceLibraryItemId: source.sourceLibraryItemId,
            sourceRevision: source.revision,
            sourceUpdatedAt: source.updatedAt,
            quantity: quantity.toFixed(2),
            unit: source.unit,
            unitPrice: unitPrice.toFixed(2),
            lineTotal: (quantity * unitPrice).toFixed(2),
            updatedAt: new Date(),
          }).where(eq(rabEstimateItem.id, line.id));
          refreshedCount += 1;
        }
      }
      await tx.insert(auditLog).values({
        userId: user.id,
        action: "REFRESH_RAB_LINKED_SOURCES",
        targetTable: "rab_estimate",
        targetId: estimate.id,
        newState: JSON.stringify({ refreshedCount }),
      });
      return { rabEstimateId: estimate.id, refreshedCount, projectId: estimate.projectId };
    });
    revalidatePath(`/projects/${result.projectId}`);
    return { success: true, data: { rabEstimateId: result.rabEstimateId, refreshedCount: result.refreshedCount } };
  } catch (error) {
    return revisionActionFailure(error, "Gagal refresh sumber RAB.");
  }
}

export async function createProjectChangeOrder(input: unknown): Promise<ActionResponse<ChangeOrder>> {
  const validation = createChangeOrderSchema.safeParse(input);
  if (!validation.success) return { success: false, error: { code: "VALIDATION_ERROR", message: validation.error.issues[0]?.message ?? "Change Order tidak valid." } };
  const user = await getRevisionActionUser();
  if (!user) return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction(async (tx) => {
      const base = await tx.query.rabEstimate.findFirst({ where: eq(rabEstimate.id, validation.data.baseRabEstimateId) });
      const revised = await tx.query.rabEstimate.findFirst({ where: eq(rabEstimate.id, validation.data.revisedRabEstimateId), with: { items: true, bundles: true } });
      if (!base || !revised) throw new Error("RAB_NOT_FOUND");
      if (base.projectId !== revised.projectId || base.status !== "APPROVED" || revised.status !== "DRAFT") {
        throw new Error("Change Order membutuhkan RAB base APPROVED dan revision DRAFT pada proyek yang sama.");
      }
      if (revised.supersedesRabEstimateId !== base.id) throw new Error("Revision RAB tidak mereferensikan baseline yang dipilih.");
      await assertRevisionProjectScope(user, base.projectId, "update:rab");
      const revisedValue = calculateQuotationTotal(revised.items, revised.bundles);
      const previousValue = Number(base.approvedValue);
      const [changeOrder] = await tx.insert(projectChangeOrder).values({
        projectId: base.projectId,
        baseRabEstimateId: base.id,
        revisedRabEstimateId: revised.id,
        status: "DRAFT",
        reason: validation.data.reason,
        scopeSummary: validation.data.scopeSummary,
        previousContractValue: previousValue.toFixed(2),
        valueDelta: (revisedValue - previousValue).toFixed(2),
        revisedContractValue: revisedValue.toFixed(2),
        createdById: user.id,
      }).returning();
      await tx.insert(auditLog).values({ userId: user.id, action: "CREATE_CHANGE_ORDER", targetTable: "project_change_order", targetId: changeOrder.id, newState: JSON.stringify(changeOrder) });
      return changeOrder;
    });
    revalidatePath(`/projects/${result.projectId}`);
    return { success: true, data: result };
  } catch (error) {
    return revisionActionFailure(error, "Gagal membuat Change Order.");
  }
}

export async function confirmChangeOrderClient(input: unknown): Promise<ActionResponse<ChangeOrder>> {
  const validation = confirmChangeOrderClientSchema.safeParse(input);
  if (!validation.success) return { success: false, error: { code: "VALIDATION_ERROR", message: validation.error.issues[0]?.message ?? "Konfirmasi client tidak valid." } };
  const user = await getRevisionActionUser();
  if (!user) return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const existing = await db.query.projectChangeOrder.findFirst({ where: eq(projectChangeOrder.id, validation.data.changeOrderId) });
    if (!existing) throw new Error("CHANGE_ORDER_NOT_FOUND");
    if (existing.status !== "DRAFT" && existing.status !== "PENDING_CLIENT") throw new Error("Status Change Order tidak dapat dikonfirmasi.");
    await assertRevisionProjectScope(user, existing.projectId, "update:rab");
    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx.update(projectChangeOrder).set({
        status: "PENDING_APPROVAL",
        clientConfirmedAt: validation.data.confirmedAt,
        clientConfirmationReference: validation.data.confirmationReference,
        updatedAt: new Date(),
      }).where(eq(projectChangeOrder.id, existing.id)).returning();
      await tx.insert(auditLog).values({ userId: user.id, action: "CONFIRM_CHANGE_ORDER_CLIENT", targetTable: "project_change_order", targetId: existing.id, originalState: JSON.stringify(existing), newState: JSON.stringify(rows[0]) });
      return rows;
    });
    revalidatePath(`/projects/${updated.projectId}`);
    return { success: true, data: updated };
  } catch (error) {
    return revisionActionFailure(error, "Gagal mencatat konfirmasi client.");
  }
}

export async function voidRabRevision(input: unknown): Promise<ActionResponse<typeof rabEstimate.$inferSelect>> {
  const validation = voidRabRevisionSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Pembatalan revisi RAB tidak valid.",
      },
    };
  }
  const user = await getRevisionActionUser();
  if (!user) return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };

  try {
    const result = await db.transaction(async (tx) => {
      const revision = await tx.query.rabEstimate.findFirst({
        where: eq(rabEstimate.id, validation.data.rabEstimateId),
      });
      if (!revision) throw new Error("RAB_NOT_FOUND");
      assertRabRevisionCanBeVoided(revision);
      await assertRevisionProjectScope(user, revision.projectId, "update:rab");

      const linkedChangeOrder = await tx.query.projectChangeOrder.findFirst({
        where: eq(projectChangeOrder.revisedRabEstimateId, revision.id),
      });
      if (linkedChangeOrder?.status === "APPROVED") {
        throw new Error("Revisi yang sudah disetujui tidak dapat dibatalkan.");
      }

      const now = new Date();
      const [voided] = await tx.update(rabEstimate).set({
        status: "VOID",
        voidReason: validation.data.reason,
        voidedAt: now,
        voidedById: user.id,
        updatedAt: now,
      }).where(and(eq(rabEstimate.id, revision.id), eq(rabEstimate.status, "DRAFT"))).returning();
      if (!voided) throw new Error("Status revisi RAB sudah berubah. Muat ulang halaman.");

      let cancelledChangeOrder: ChangeOrder | null = null;
      if (linkedChangeOrder && isOpenChangeOrderStatus(linkedChangeOrder.status)) {
        const [cancelled] = await tx.update(projectChangeOrder).set({
          status: "CANCELLED",
          updatedAt: now,
        }).where(eq(projectChangeOrder.id, linkedChangeOrder.id)).returning();
        cancelledChangeOrder = cancelled ?? null;
        if (cancelled) {
          await tx.insert(auditLog).values({
            userId: user.id,
            action: "CANCEL_CHANGE_ORDER_WITH_RAB_REVISION",
            targetTable: "project_change_order",
            targetId: cancelled.id,
            originalState: JSON.stringify(linkedChangeOrder),
            newState: JSON.stringify(cancelled),
          });
        }
      }

      await tx.insert(auditLog).values({
        userId: user.id,
        action: "VOID_RAB_REVISION",
        targetTable: "rab_estimate",
        targetId: voided.id,
        originalState: JSON.stringify(revision),
        newState: JSON.stringify({ ...voided, cancelledChangeOrderId: cancelledChangeOrder?.id ?? null }),
      });
      return voided;
    });
    revalidatePath(`/projects/${result.projectId}`);
    return { success: true, data: result };
  } catch (error) {
    return revisionActionFailure(error, "Gagal membatalkan revisi RAB.");
  }
}

export async function approveProjectChangeOrder(input: unknown): Promise<ActionResponse<ChangeOrder>> {
  return approveProjectChangeOrderWrite(input);
}
