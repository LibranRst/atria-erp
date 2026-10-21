import { and, asc, eq, inArray, ne } from "drizzle-orm";
import {
  INSTANCE_TENANT_ID,
  auditLog,
  project,
  projectBudgets,
  projectBudgetCategory,
  projectCategoryPlanItem,
  projectChangeOrder,
  projectRap,
  rabEstimate,
  rabEstimateItem,
  rabEstimateBundle,
} from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import type { PermissionKey } from "@atria/core/auth/permissions";
import type { FinanceTransaction } from "../finance/mutation-access";
import { recordNotificationEvent } from "@backend/server/services/notification-events";
import {
  calculateRabBudgetDerivation,
  getBudgetCategoryStatus,
} from "@atria/core/budget/excel-budget";
import { calculateQuotationTotal } from "@atria/core/project/quotation-total";
import { readRabSourceRefresh } from "./rab-source-refresh";
import {
  assertRabRevisionCanBeVoided,
  isOpenChangeOrderStatus,
  getNextRabRevision,
} from "@atria/core/project/rab-selection";
import { rabLineTotal } from "@atria/core/ai/rab-draft";
import {
  addRabManualItemSchema,
  createRabBundleSchema,
  updateRabBundleSchema,
  deleteRabBundleSchema,
  updateRabEstimateItemSchema,
  approveRabEstimateSchema,
} from "@atria/core/validations/rap-rab";
import {
  createChangeOrderSchema,
  confirmChangeOrderClientSchema,
  approveChangeOrderSchema,
  refreshRabSourcesSchema,
  voidRabRevisionSchema,
  createRabRevisionSchema,
  rejectChangeOrderSchema,
  updateRabHeaderSchema,
} from "@atria/core/validations/workflow-governance";
import type { z } from "zod";
type ChangeOrder = typeof projectChangeOrder.$inferSelect;

/** One tenant/project lock serializes manual and AI RAB lifecycle writes. */
export async function lockRabWorkflowProjectTx(
  tx: FinanceTransaction,
  actor: Actor,
  projectId: string,
  permission: PermissionKey,
): Promise<void> {
  if (!actorCan(actor, permission)) throw new Error("FORBIDDEN: Izin tindakan RAB tidak tersedia.");
  const [row] = await tx
    .select()
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.tenantId, INSTANCE_TENANT_ID)))
    .for("update");
  if (
    !row ||
    actor.dataScope === "NONE" ||
    (actor.dataScope === "ASSIGNED" && row.projectManagerId !== actor.userId)
  )
    throw new Error("FORBIDDEN: Proyek di luar akses Anda.");
  if (!["DRAFT", "ACTIVE"].includes(row.status))
    throw new Error("FORBIDDEN: RAB hanya dapat diubah pada proyek Draft atau aktif.");
  await tx
    .select({ id: rabEstimate.id })
    .from(rabEstimate)
    .where(and(eq(rabEstimate.projectId, projectId), eq(rabEstimate.tenantId, INSTANCE_TENANT_ID)))
    .orderBy(asc(rabEstimate.id))
    .for("update");
  await tx
    .select({ id: projectChangeOrder.id })
    .from(projectChangeOrder)
    .where(
      and(
        eq(projectChangeOrder.projectId, projectId),
        eq(projectChangeOrder.tenantId, INSTANCE_TENANT_ID),
      ),
    )
    .orderBy(asc(projectChangeOrder.id))
    .for("update");
  const budgets = await tx
    .select({ id: projectBudgets.id })
    .from(projectBudgets)
    .where(
      and(eq(projectBudgets.projectId, projectId), eq(projectBudgets.tenantId, INSTANCE_TENANT_ID)),
    )
    .orderBy(asc(projectBudgets.id))
    .for("update");
  if (budgets.length)
    await tx
      .select({ id: projectBudgetCategory.id })
      .from(projectBudgetCategory)
      .where(
        inArray(
          projectBudgetCategory.projectBudgetId,
          budgets.map((b) => b.id),
        ),
      )
      .orderBy(asc(projectBudgetCategory.id))
      .for("update");
}
async function lockRabIdTx(
  tx: FinanceTransaction,
  actor: Actor,
  rabId: string,
  permission: PermissionKey,
): Promise<void> {
  const row = await tx.query.rabEstimate.findFirst({
    where: and(eq(rabEstimate.id, rabId), eq(rabEstimate.tenantId, INSTANCE_TENANT_ID)),
  });
  if (!row) throw new Error("RAB_NOT_FOUND");
  await lockRabWorkflowProjectTx(tx, actor, row.projectId, permission);
}
async function lockRabItemTx(
  tx: FinanceTransaction,
  actor: Actor,
  itemId: string,
): Promise<string> {
  const row = await tx.query.rabEstimateItem.findFirst({
    where: and(eq(rabEstimateItem.id, itemId), eq(rabEstimateItem.tenantId, INSTANCE_TENANT_ID)),
  });
  if (!row) throw new Error("RAB_ITEM_NOT_FOUND");
  await lockRabIdTx(tx, actor, row.rabEstimateId, "update:rab");
  return row.rabEstimateId;
}
async function lockRabBundleTx(
  tx: FinanceTransaction,
  actor: Actor,
  bundleId: string,
): Promise<string> {
  const row = await tx.query.rabEstimateBundle.findFirst({
    where: and(
      eq(rabEstimateBundle.id, bundleId),
      eq(rabEstimateBundle.tenantId, INSTANCE_TENANT_ID),
    ),
  });
  if (!row) throw new Error("RAB_BUNDLE_NOT_FOUND");
  await lockRabIdTx(tx, actor, row.rabEstimateId, "update:rab");
  return row.rabEstimateId;
}
async function lockChangeOrderTx(
  tx: FinanceTransaction,
  actor: Actor,
  changeOrderId: string,
  permission: PermissionKey,
): Promise<void> {
  const row = await tx.query.projectChangeOrder.findFirst({
    where: and(
      eq(projectChangeOrder.id, changeOrderId),
      eq(projectChangeOrder.tenantId, INSTANCE_TENANT_ID),
    ),
  });
  if (!row) throw new Error("CHANGE_ORDER_NOT_FOUND");
  await lockRabWorkflowProjectTx(tx, actor, row.projectId, permission);
}
export async function assertEditableRabTx(tx: FinanceTransaction, rabId: string): Promise<void> {
  const estimate = await tx.query.rabEstimate.findFirst({ where: eq(rabEstimate.id, rabId) });
  if (!estimate || estimate.status !== "DRAFT")
    throw new Error("Hanya RAB Draft yang dapat dikoreksi.");
  const order = await tx.query.projectChangeOrder.findFirst({
    where: eq(projectChangeOrder.revisedRabEstimateId, rabId),
  });
  if (order && ["PENDING_CLIENT", "PENDING_APPROVAL", "APPROVED"].includes(order.status))
    throw new Error(
      "Change Order sedang menunggu atau sudah disetujui. Koreksi tidak boleh mengubah isi yang telah dikonfirmasi klien.",
    );
}
export async function updateRabHeaderTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: z.output<typeof updateRabHeaderSchema>,
): Promise<typeof rabEstimate.$inferSelect> {
  input = updateRabHeaderSchema.parse(input);
  await lockRabIdTx(tx, actor, input.rabEstimateId, "update:rab");
  await assertEditableRabTx(tx, input.rabEstimateId);
  const before = await tx.query.rabEstimate.findFirst({
    where: eq(rabEstimate.id, input.rabEstimateId),
  });
  const [after] = await tx
    .update(rabEstimate)
    .set({ title: input.title, clientNotes: input.clientNotes || null, updatedAt: new Date() })
    .where(eq(rabEstimate.id, input.rabEstimateId))
    .returning();
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "UPDATE_RAB_DRAFT_HEADER",
    targetTable: "rab_estimate",
    targetId: after.id,
    originalState: JSON.stringify(before),
    newState: JSON.stringify(after),
  });
  return after;
}
export async function createRabRevisionTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: z.output<typeof createRabRevisionSchema>,
): Promise<typeof rabEstimate.$inferSelect> {
  input = createRabRevisionSchema.parse(input);
  await lockRabIdTx(tx, actor, input.rabEstimateId, "create:rab");
  const source = await tx.query.rabEstimate.findFirst({
    where: eq(rabEstimate.id, input.rabEstimateId),
    with: { items: true, bundles: true },
  });
  if (!source || source.status !== "APPROVED")
    throw new Error("Revisi membutuhkan baseline RAB yang masih disetujui.");
  const estimates = await tx.query.rabEstimate.findMany({
    where: eq(rabEstimate.projectId, source.projectId),
  });
  if (estimates.some((row) => row.status === "DRAFT"))
    throw new Error("RAB Draft sudah tersedia. Lanjutkan draft tersebut.");
  const [created] = await tx
    .insert(rabEstimate)
    .values({
      projectId: source.projectId,
      sourceProjectRapId: source.sourceProjectRapId,
      supersedesRabEstimateId: source.id,
      revision: getNextRabRevision(estimates),
      title: source.title,
      clientNotes: source.clientNotes,
      status: "DRAFT",
    })
    .returning();
  const bundleIds = new Map<string, string>();
  for (const bundle of source.bundles) {
    const [copy] = await tx
      .insert(rabEstimateBundle)
      .values({
        tenantId: bundle.tenantId,
        rabEstimateId: created.id,
        clientLabel: bundle.clientLabel,
        description: bundle.description,
        quantity: bundle.quantity,
        unit: bundle.unit,
        unitPrice: bundle.unitPrice,
        lineTotal: bundle.lineTotal,
        displayOrder: bundle.displayOrder,
        isHidden: bundle.isHidden,
      })
      .returning();
    bundleIds.set(bundle.id, copy.id);
  }
  for (const item of source.items) {
    if (item.bundleId && !bundleIds.has(item.bundleId))
      throw new Error("Keanggotaan paket baseline tidak valid.");
    await tx.insert(rabEstimateItem).values({
      tenantId: item.tenantId,
      sourceType: item.sourceType,
      itemNature: item.itemNature,
      sourceProjectRapItemId: item.sourceProjectRapItemId,
      sourceProjectCategoryPlanItemId: item.sourceProjectCategoryPlanItemId,
      sourceLibraryItemId: item.sourceLibraryItemId,
      sourceRevision: item.sourceRevision,
      sourceUpdatedAt: item.sourceUpdatedAt,
      clientLabel: item.clientLabel,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      displayOrder: item.displayOrder,
      isHidden: item.isHidden,
      isBundle: item.isBundle,
      rabEstimateId: created.id,
      bundleId: item.bundleId ? (bundleIds.get(item.bundleId) ?? null) : null,
    });
  }
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "CREATE_RAB_REVISION",
    targetTable: "rab_estimate",
    targetId: created.id,
    originalState: JSON.stringify({ baselineId: source.id }),
    newState: JSON.stringify({
      ...created,
      reason: input.reason,
      copiedItems: source.items.length,
      copiedBundles: source.bundles.length,
    }),
  });
  return created;
}
export async function rejectChangeOrderTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: z.output<typeof rejectChangeOrderSchema>,
): Promise<ChangeOrder> {
  input = rejectChangeOrderSchema.parse(input);
  await lockChangeOrderTx(tx, actor, input.changeOrderId, "approve:rab");
  const before = await tx.query.projectChangeOrder.findFirst({
    where: eq(projectChangeOrder.id, input.changeOrderId),
  });
  if (!before || before.status !== "PENDING_APPROVAL")
    throw new Error("Change Order tidak sedang menunggu persetujuan.");
  if (before.createdById === actor.userId)
    throw new Error(
      "MAKER_CHECKER_REQUIRED: Pembuat tidak dapat mengambil keputusan atas Change Order sendiri.",
    );
  const [after] = await tx
    .update(projectChangeOrder)
    .set({ status: "REJECTED", updatedAt: new Date() })
    .where(eq(projectChangeOrder.id, before.id))
    .returning();
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "REJECT_CHANGE_ORDER",
    targetTable: "project_change_order",
    targetId: after.id,
    originalState: JSON.stringify(before),
    newState: JSON.stringify({ ...after, rejectionReason: input.reason }),
  });
  await recordNotificationEvent(tx, {
    referenceType: "change_order",
    referenceId: after.id,
    projectId: after.projectId,
    stage: `REJECTED:${after.updatedAt.toISOString()}`,
    title: "Perubahan proyek perlu dikoreksi",
    message: "Change Order ditolak dengan alasan. Baseline tetap utuh.",
    permission: "view:rab",
    actionUrl: `/projects/${after.projectId}?tab=rab`,
    actorId: actor.userId,
  });
  return after;
}

export async function addRabManualItemTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: z.output<typeof addRabManualItemSchema>,
): Promise<typeof rabEstimateItem.$inferSelect> {
  input = addRabManualItemSchema.parse(input);
  await lockRabIdTx(tx, actor, input.rabEstimateId, "update:rab");
  await assertEditableRabTx(tx, input.rabEstimateId);
  const estimate = await tx.query.rabEstimate.findFirst({
    where: eq(rabEstimate.id, input.rabEstimateId),
    with: { items: true },
  });
  if (!estimate) throw new Error("RAB_NOT_FOUND");
  if (estimate.status !== "DRAFT")
    throw new Error("Manual line hanya dapat ditambahkan ke RAB DRAFT.");

  const lineTotal = rabLineTotal(input);
  const displayOrder =
    estimate.items.reduce((highest, item) => Math.max(highest, item.displayOrder), 0) + 1;
  const [manualItem] = await tx
    .insert(rabEstimateItem)
    .values({
      rabEstimateId: estimate.id,
      sourceType: "MANUAL",
      itemNature: input.itemNature ?? "PRODUCTION",
      clientLabel: input.clientLabel,
      description: input.description ?? null,
      quantity: input.quantity.toFixed(2),
      unit: input.unit,
      unitPrice: input.unitPrice.toFixed(2),
      lineTotal: lineTotal.toFixed(2),
      displayOrder,
      isHidden: input.isHidden ?? false,
      isBundle: input.isBundle ?? false,
    })
    .returning();
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "ADD_RAB_MANUAL_ITEM",
    targetTable: "rab_estimate_item",
    targetId: manualItem.id,
    newState: JSON.stringify(manualItem),
  });
  return manualItem;
}

export async function createRabBundleTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: z.output<typeof createRabBundleSchema>,
): Promise<typeof rabEstimateBundle.$inferSelect> {
  input = createRabBundleSchema.parse(input);
  await lockRabIdTx(tx, actor, input.rabEstimateId, "update:rab");
  await assertEditableRabTx(tx, input.rabEstimateId);
  const estimate = await tx.query.rabEstimate.findFirst({
    where: eq(rabEstimate.id, input.rabEstimateId),
    with: { bundles: true },
  });
  if (!estimate) throw new Error("RAB_NOT_FOUND");
  if (estimate.status !== "DRAFT") throw new Error("Paket hanya dapat dibuat pada RAB DRAFT.");

  const uniqueIds = [...new Set(input.itemIds)];
  if (uniqueIds.length < 2) throw new Error("Pilih minimal dua quotation line.");
  const items = await tx.query.rabEstimateItem.findMany({
    where: inArray(rabEstimateItem.id, uniqueIds),
  });
  if (items.length !== uniqueIds.length || items.some((item) => item.rabEstimateId !== estimate.id))
    throw new Error("Quotation line tidak valid.");
  if (items.some((item) => item.isHidden || item.bundleId))
    throw new Error("Line hidden atau sudah tergabung tidak dapat dipaketkan.");
  const [bundle] = await tx
    .insert(rabEstimateBundle)
    .values({
      rabEstimateId: estimate.id,
      clientLabel: input.clientLabel,
      description: input.description ?? null,
      quantity: input.quantity.toFixed(2),
      unit: input.unit,
      unitPrice: input.unitPrice.toFixed(2),
      lineTotal: rabLineTotal(input).toFixed(2),
      displayOrder: estimate.bundles.reduce((max, row) => Math.max(max, row.displayOrder), 0) + 1,
    })
    .returning();
  await tx
    .update(rabEstimateItem)
    .set({ bundleId: bundle.id, isBundle: true, updatedAt: new Date() })
    .where(inArray(rabEstimateItem.id, uniqueIds));
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "CREATE_RAB_BUNDLE",
    targetTable: "rab_estimate_bundle",
    targetId: bundle.id,
    newState: JSON.stringify({ ...bundle, itemIds: uniqueIds }),
  });
  return bundle;
}

export async function updateRabBundleTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: z.output<typeof updateRabBundleSchema>,
): Promise<typeof rabEstimateBundle.$inferSelect> {
  input = updateRabBundleSchema.parse(input);
  await assertEditableRabTx(tx, await lockRabBundleTx(tx, actor, input.bundleId));
  const bundle = await tx.query.rabEstimateBundle.findFirst({
    where: eq(rabEstimateBundle.id, input.bundleId),
    with: { estimate: true },
  });
  if (!bundle) throw new Error("RAB_BUNDLE_NOT_FOUND");
  if (bundle.estimate.status !== "DRAFT") throw new Error("Paket approved tidak dapat diubah.");

  const [row] = await tx
    .update(rabEstimateBundle)
    .set({
      clientLabel: input.clientLabel,
      description: input.description ?? null,
      quantity: input.quantity.toFixed(2),
      unit: input.unit,
      unitPrice: input.unitPrice.toFixed(2),
      lineTotal: rabLineTotal(input).toFixed(2),
      isHidden: input.isHidden ?? bundle.isHidden,
      updatedAt: new Date(),
    })
    .where(eq(rabEstimateBundle.id, bundle.id))
    .returning();
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "UPDATE_RAB_BUNDLE",
    targetTable: "rab_estimate_bundle",
    targetId: row.id,
    originalState: JSON.stringify(bundle),
    newState: JSON.stringify(row),
  });
  return row;
}

export async function deleteRabBundleTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: z.output<typeof deleteRabBundleSchema>,
): Promise<{ readonly id: string }> {
  input = deleteRabBundleSchema.parse(input);
  await assertEditableRabTx(tx, await lockRabBundleTx(tx, actor, input.bundleId));
  const bundle = await tx.query.rabEstimateBundle.findFirst({
    where: eq(rabEstimateBundle.id, input.bundleId),
    with: { estimate: true, items: true },
  });
  if (!bundle) throw new Error("RAB_BUNDLE_NOT_FOUND");
  if (bundle.estimate.status !== "DRAFT") throw new Error("Paket approved tidak dapat dibongkar.");

  await tx
    .update(rabEstimateItem)
    .set({ bundleId: null, isBundle: false, updatedAt: new Date() })
    .where(eq(rabEstimateItem.bundleId, bundle.id));
  await tx.delete(rabEstimateBundle).where(eq(rabEstimateBundle.id, bundle.id));
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "DELETE_RAB_BUNDLE",
    targetTable: "rab_estimate_bundle",
    targetId: bundle.id,
    originalState: JSON.stringify(bundle),
  });
  return { id: bundle.id };
}

export async function updateRabEstimateItemTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: z.output<typeof updateRabEstimateItemSchema>,
): Promise<typeof rabEstimateItem.$inferSelect> {
  const lineTotal = rabLineTotal(input);
  input = updateRabEstimateItemSchema.parse(input);
  await assertEditableRabTx(tx, await lockRabItemTx(tx, actor, input.rabEstimateItemId));
  const item = await tx.query.rabEstimateItem.findFirst({
    where: eq(rabEstimateItem.id, input.rabEstimateItemId),
    with: { estimate: true },
  });
  if (!item) throw new Error("RAB_ITEM_NOT_FOUND");
  const [row] = await tx
    .update(rabEstimateItem)
    .set({
      clientLabel: input.clientLabel,
      description: input.description ?? null,
      quantity: input.quantity.toFixed(2),
      unit: input.unit,
      unitPrice: input.unitPrice.toFixed(2),
      lineTotal: lineTotal.toFixed(2),
      itemNature: input.itemNature ?? item.itemNature,
      displayOrder: input.displayOrder ?? item.displayOrder,
      isHidden: input.isHidden ?? item.isHidden,
      isBundle: input.isBundle ?? item.isBundle,
      updatedAt: new Date(),
    })
    .where(eq(rabEstimateItem.id, item.id))
    .returning();
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "UPDATE_RAB_ITEM_DRAFT",
    targetTable: "rab_estimate_item",
    targetId: item.id,
    originalState: JSON.stringify(item),
    newState: JSON.stringify(row),
  });
  return row;
}

export async function approveRabEstimateTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: z.output<typeof approveRabEstimateSchema>,
): Promise<typeof rabEstimate.$inferSelect> {
  input = approveRabEstimateSchema.parse(input);
  await lockRabIdTx(tx, actor, input.rabEstimateId, "approve:rab");
  const estimate = await tx.query.rabEstimate.findFirst({
    where: eq(rabEstimate.id, input.rabEstimateId),
    with: {
      items: true,
      bundles: true,
    },
  });
  if (!estimate) throw new Error("RAB_NOT_FOUND");
  if (estimate.status !== "DRAFT") throw new Error("Hanya RAB DRAFT yang dapat di-approve.");

  const existingApproved = await tx.query.rabEstimate.findFirst({
    where: and(
      eq(rabEstimate.projectId, estimate.projectId),
      eq(rabEstimate.status, "APPROVED"),
      ne(rabEstimate.id, estimate.id),
    ),
  });
  if (existingApproved) {
    throw new Error("RAB approved sudah ada. Gunakan Change Order untuk revision berikutnya.");
  }
  const budget = await tx.query.projectBudgets.findFirst({
    where: eq(projectBudgets.projectId, estimate.projectId),
    with: {
      categories: true,
    },
  });
  const budgetCapRatio = budget ? Number(budget.budgetCapRatio) : 0.9;
  const derivation = calculateRabBudgetDerivation({
    items: estimate.items,
    bundles: estimate.bundles,
    budgetCapRatio,
  });
  const approvedValue = derivation.approvedValue;
  const [updated] = await tx
    .update(rabEstimate)
    .set({
      status: "APPROVED",
      approvedValue: approvedValue.toFixed(2),
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(rabEstimate.id, estimate.id))
    .returning();
  await tx
    .update(project)
    .set({
      totalContractValue: approvedValue.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(project.id, estimate.projectId));
  if (budget) {
    await tx
      .update(projectBudgets)
      .set({
        contractValue: derivation.approvedValue.toFixed(2),
        approvedRabValue: derivation.approvedValue.toFixed(2),
        internalBudget: derivation.internalBudget.toFixed(2),
        targetGrossAmount: derivation.targetGrossAmount.toFixed(2),
        targetGrossPercentage: derivation.targetGrossPercentage.toFixed(4),
        status: "APPROVED",
        updatedAt: new Date(),
      })
      .where(eq(projectBudgets.id, budget.id));

    for (const cat of budget.categories) {
      if (!cat.isManualOverride) {
        const catRatio = Number(cat.ratioPercentage);
        const allocatedAmount = derivation.internalBudget * catRatio;
        const actualAmount = Number(cat.actualAmount);
        const usedPercentage = allocatedAmount > 0 ? (actualAmount / allocatedAmount) * 100 : 0;

        await tx
          .update(projectBudgetCategory)
          .set({
            allocatedAmount: allocatedAmount.toFixed(2),
            remainingAmount: (allocatedAmount - actualAmount).toFixed(2),
            usedPercentage: usedPercentage.toFixed(4),
            status: getBudgetCategoryStatus(usedPercentage),
            updatedAt: new Date(),
          })
          .where(eq(projectBudgetCategory.id, cat.id));
      }
    }
  }
  const categoryPlanIds = estimate.items
    .map((item) => item.sourceProjectCategoryPlanItemId)
    .filter((id): id is string => Boolean(id));
  if (categoryPlanIds.length > 0) {
    await tx
      .update(projectCategoryPlanItem)
      .set({
        status: "LOCKED",
        lockedById: actor.userId,
        lockedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(inArray(projectCategoryPlanItem.id, categoryPlanIds));
  }
  if (estimate.sourceProjectRapId) {
    await tx
      .update(projectRap)
      .set({
        status: "LOCKED",
        lockedById: actor.userId,
        lockedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(projectRap.id, estimate.sourceProjectRapId));
  }
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "APPROVE_INITIAL_RAB",
    targetTable: "rab_estimate",
    targetId: updated.id,
    originalState: JSON.stringify(estimate),
    newState: JSON.stringify(updated),
  });
  await recordNotificationEvent(tx, {
    referenceType: "rab",
    referenceId: updated.id,
    projectId: updated.projectId,
    stage: "APPROVED",
    title: "RAB disetujui",
    message: "Persetujuan RAB telah dicatat.",
    permission: "view:rab",
    actionUrl: `/projects/${updated.projectId}`,
    actorId: actor.userId,
  });
  return updated;
}

export async function refreshRabLinkedSourcesTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: z.output<typeof refreshRabSourcesSchema>,
): Promise<{
  readonly rabEstimateId: string;
  readonly refreshedCount: number;
  readonly projectId: string;
}> {
  input = refreshRabSourcesSchema.parse(input);
  await lockRabIdTx(tx, actor, input.rabEstimateId, "update:rab");
  await assertEditableRabTx(tx, input.rabEstimateId);
  const estimate = await tx.query.rabEstimate.findFirst({
    where: eq(rabEstimate.id, input.rabEstimateId),
    with: { items: true },
  });
  if (!estimate) throw new Error("RAB_NOT_FOUND");
  if (estimate.status !== "DRAFT") throw new Error("Hanya RAB DRAFT yang dapat di-refresh.");

  const budget = await tx.query.projectBudgets.findFirst({
    where: eq(projectBudgets.projectId, estimate.projectId),
  });
  const targetGrossPercentage = Number(budget?.targetGrossPercentage ?? 10);
  const changes = await readRabSourceRefresh(tx, estimate, targetGrossPercentage);
  const refreshedCount = changes.length;
  for (const change of changes) {
    await tx
      .update(rabEstimateItem)
      .set({
        sourceLibraryItemId: change.sourceLibraryItemId,
        sourceRevision: change.sourceRevision,
        sourceUpdatedAt: change.sourceUpdatedAt,
        quantity: change.after.quantity.toFixed(2),
        unit: change.after.unit,
        unitPrice: change.after.unitPrice.toFixed(2),
        lineTotal: (change.after.quantity * change.after.unitPrice).toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(rabEstimateItem.id, change.itemId));
  }
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "REFRESH_RAB_LINKED_SOURCES",
    targetTable: "rab_estimate",
    targetId: estimate.id,
    newState: JSON.stringify({ refreshedCount }),
  });
  return { rabEstimateId: estimate.id, refreshedCount, projectId: estimate.projectId };
}

export async function createProjectChangeOrderTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: z.output<typeof createChangeOrderSchema>,
): Promise<typeof projectChangeOrder.$inferSelect> {
  input = createChangeOrderSchema.parse(input);
  await lockRabIdTx(tx, actor, input.baseRabEstimateId, "update:rab");
  const base = await tx.query.rabEstimate.findFirst({
    where: eq(rabEstimate.id, input.baseRabEstimateId),
  });
  const revised = await tx.query.rabEstimate.findFirst({
    where: eq(rabEstimate.id, input.revisedRabEstimateId),
    with: { items: true, bundles: true },
  });
  if (!base || !revised) throw new Error("RAB_NOT_FOUND");
  if (
    base.projectId !== revised.projectId ||
    base.status !== "APPROVED" ||
    revised.status !== "DRAFT"
  ) {
    throw new Error(
      "Change Order membutuhkan RAB base APPROVED dan revision DRAFT pada proyek yang sama.",
    );
  }
  if (revised.supersedesRabEstimateId !== base.id)
    throw new Error("Revision RAB tidak mereferensikan baseline yang dipilih.");

  const revisedValue = calculateQuotationTotal(revised.items, revised.bundles);
  const previousValue = Number(base.approvedValue);
  const previous = await tx.query.projectChangeOrder.findFirst({
    where: eq(projectChangeOrder.revisedRabEstimateId, revised.id),
  });
  if (previous) {
    if (!["DRAFT", "REJECTED"].includes(previous.status))
      throw new Error("Change Order yang telah dikonfirmasi klien tidak dapat ditimpa.");
    const [updated] = await tx
      .update(projectChangeOrder)
      .set({
        reason: input.reason,
        scopeSummary: input.scopeSummary,
        status: "DRAFT",
        previousContractValue: previousValue.toFixed(2),
        valueDelta: (revisedValue - previousValue).toFixed(2),
        revisedContractValue: revisedValue.toFixed(2),
        createdById: actor.userId,
        clientConfirmedAt: null,
        clientConfirmationReference: null,
        approvedById: null,
        approvedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(projectChangeOrder.id, previous.id))
      .returning();
    await tx.insert(auditLog).values({
      userId: actor.userId,
      action: "REVISE_CHANGE_ORDER_DRAFT",
      targetTable: "project_change_order",
      targetId: updated.id,
      originalState: JSON.stringify(previous),
      newState: JSON.stringify(updated),
    });
    return updated;
  }
  const [changeOrder] = await tx
    .insert(projectChangeOrder)
    .values({
      projectId: base.projectId,
      baseRabEstimateId: base.id,
      revisedRabEstimateId: revised.id,
      status: "DRAFT",
      reason: input.reason,
      scopeSummary: input.scopeSummary,
      previousContractValue: previousValue.toFixed(2),
      valueDelta: (revisedValue - previousValue).toFixed(2),
      revisedContractValue: revisedValue.toFixed(2),
      createdById: actor.userId,
    })
    .returning();
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "CREATE_CHANGE_ORDER",
    targetTable: "project_change_order",
    targetId: changeOrder.id,
    newState: JSON.stringify(changeOrder),
  });
  return changeOrder;
}

export async function confirmChangeOrderClientTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: z.output<typeof confirmChangeOrderClientSchema>,
): Promise<typeof projectChangeOrder.$inferSelect> {
  input = confirmChangeOrderClientSchema.parse(input);
  await lockChangeOrderTx(tx, actor, input.changeOrderId, "update:rab");
  const existing = await tx.query.projectChangeOrder.findFirst({
    where: eq(projectChangeOrder.id, input.changeOrderId),
  });
  if (!existing) throw new Error("CHANGE_ORDER_NOT_FOUND");
  if (!["DRAFT", "PENDING_CLIENT"].includes(existing.status))
    throw new Error("Status Change Order tidak dapat dikonfirmasi.");
  if (input.confirmedAt.getTime() > Date.now() + 60000)
    throw new Error("Tanggal konfirmasi klien belum terjadi.");
  const revised = await tx.query.rabEstimate.findFirst({
    where: eq(rabEstimate.id, existing.revisedRabEstimateId),
    with: { items: true, bundles: true },
  });
  const base = await tx.query.rabEstimate.findFirst({
    where: eq(rabEstimate.id, existing.baseRabEstimateId),
  });
  if (
    !revised ||
    !base ||
    revised.status !== "DRAFT" ||
    base.status !== "APPROVED" ||
    Math.abs(
      calculateQuotationTotal(revised.items, revised.bundles) -
        Number(existing.revisedContractValue),
    ) > 0.01
  )
    throw new Error(
      "Isi atau nilai revisi berubah. Perbarui draft Change Order sebelum mencatat konfirmasi klien.",
    );
  const rows = await tx
    .update(projectChangeOrder)
    .set({
      status: "PENDING_APPROVAL",
      clientConfirmedAt: input.confirmedAt,
      clientConfirmationReference: input.confirmationReference,
      updatedAt: new Date(),
    })
    .where(eq(projectChangeOrder.id, existing.id))
    .returning();
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "CONFIRM_CHANGE_ORDER_CLIENT",
    targetTable: "project_change_order",
    targetId: existing.id,
    originalState: JSON.stringify(existing),
    newState: JSON.stringify(rows[0]),
  });
  await recordNotificationEvent(tx, {
    referenceType: "change_order",
    referenceId: existing.id,
    projectId: existing.projectId,
    stage: `PENDING_APPROVAL:${rows[0].updatedAt.toISOString()}`,
    title: "Perubahan proyek menunggu persetujuan",
    message: "Konfirmasi klien telah dicatat.",
    permission: "approve:rab",
    actionRequired: true,
    actionUrl: `/projects/${existing.projectId}?tab=rab`,
    actorId: actor.userId,
  });
  return rows[0];
}

export async function voidRabRevisionTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: z.output<typeof voidRabRevisionSchema>,
): Promise<typeof rabEstimate.$inferSelect> {
  input = voidRabRevisionSchema.parse(input);
  await lockRabIdTx(tx, actor, input.rabEstimateId, "update:rab");
  const revision = await tx.query.rabEstimate.findFirst({
    where: eq(rabEstimate.id, input.rabEstimateId),
  });
  if (!revision) throw new Error("RAB_NOT_FOUND");
  assertRabRevisionCanBeVoided(revision);

  const linkedChangeOrder = await tx.query.projectChangeOrder.findFirst({
    where: eq(projectChangeOrder.revisedRabEstimateId, revision.id),
  });
  if (linkedChangeOrder?.status === "APPROVED") {
    throw new Error("Revisi yang sudah disetujui tidak dapat dibatalkan.");
  }
  const now = new Date();
  const [voided] = await tx
    .update(rabEstimate)
    .set({
      status: "VOID",
      voidReason: input.reason,
      voidedAt: now,
      voidedById: actor.userId,
      updatedAt: now,
    })
    .where(and(eq(rabEstimate.id, revision.id), eq(rabEstimate.status, "DRAFT")))
    .returning();
  if (!voided) throw new Error("Status revisi RAB sudah berubah. Muat ulang halaman.");
  let cancelledChangeOrder: ChangeOrder | null = null;
  if (linkedChangeOrder && isOpenChangeOrderStatus(linkedChangeOrder.status)) {
    const [cancelled] = await tx
      .update(projectChangeOrder)
      .set({
        status: "CANCELLED",
        updatedAt: now,
      })
      .where(eq(projectChangeOrder.id, linkedChangeOrder.id))
      .returning();
    cancelledChangeOrder = cancelled ?? null;
    if (cancelled) {
      await tx.insert(auditLog).values({
        userId: actor.userId,
        action: "CANCEL_CHANGE_ORDER_WITH_RAB_REVISION",
        targetTable: "project_change_order",
        targetId: cancelled.id,
        originalState: JSON.stringify(linkedChangeOrder),
        newState: JSON.stringify(cancelled),
      });
    }
  }
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "VOID_RAB_REVISION",
    targetTable: "rab_estimate",
    targetId: voided.id,
    originalState: JSON.stringify(revision),
    newState: JSON.stringify({
      ...voided,
      cancelledChangeOrderId: cancelledChangeOrder?.id ?? null,
    }),
  });
  await recordNotificationEvent(tx, {
    referenceType: "rab",
    referenceId: voided.id,
    projectId: voided.projectId,
    stage: "VOID",
    title: "Revisi RAB dibatalkan",
    message: "Revisi ini tidak lagi digunakan.",
    permission: "view:rab",
    actionUrl: `/projects/${voided.projectId}`,
    actorId: actor.userId,
  });
  if (cancelledChangeOrder)
    await recordNotificationEvent(tx, {
      referenceType: "change_order",
      referenceId: cancelledChangeOrder.id,
      projectId: voided.projectId,
      stage: "CANCELLED",
      title: "Perubahan proyek dibatalkan",
      message: "Revisi terkait telah dibatalkan.",
      permission: "view:rab",
      actionUrl: `/projects/${voided.projectId}`,
      actorId: actor.userId,
    });
  return voided;
}

export async function approveProjectChangeOrderTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: z.output<typeof approveChangeOrderSchema>,
): Promise<typeof projectChangeOrder.$inferSelect> {
  input = approveChangeOrderSchema.parse(input);
  await lockChangeOrderTx(tx, actor, input.changeOrderId, "approve:rab");
  const canEmergencyOverride = actorCan(actor, "override:self_approval");
  const changeOrder = await tx.query.projectChangeOrder.findFirst({
    where: eq(projectChangeOrder.id, input.changeOrderId),
  });
  if (!changeOrder) throw new Error("CHANGE_ORDER_NOT_FOUND");
  if (
    changeOrder.status !== "PENDING_APPROVAL" ||
    !changeOrder.clientConfirmedAt ||
    !changeOrder.clientConfirmationReference
  ) {
    throw new Error("Change Order belum memiliki konfirmasi client yang lengkap.");
  }

  const selfApproval = changeOrder.createdById === actor.userId;
  if (selfApproval && !(canEmergencyOverride && input.emergencyOverride && input.reason)) {
    throw new Error(
      "MAKER_CHECKER_REQUIRED: Change Order harus disetujui user lain. Owner dapat memakai emergency override dengan alasan.",
    );
  }
  const base = await tx.query.rabEstimate.findFirst({
    where: eq(rabEstimate.id, changeOrder.baseRabEstimateId),
  });
  const revised = await tx.query.rabEstimate.findFirst({
    where: eq(rabEstimate.id, changeOrder.revisedRabEstimateId),
    with: { items: true, bundles: true },
  });
  if (!base || !revised || base.status !== "APPROVED" || revised.status !== "DRAFT")
    throw new Error("RAB revision state sudah berubah.");
  const approvedValue = calculateQuotationTotal(revised.items, revised.bundles);
  if (Math.abs(approvedValue - Number(changeOrder.revisedContractValue)) > 0.01)
    throw new Error("Nilai RAB berubah setelah Change Order dibuat. Buat ulang Change Order.");
  await tx
    .update(rabEstimate)
    .set({ status: "SUPERSEDED", updatedAt: new Date() })
    .where(eq(rabEstimate.id, base.id));
  await tx
    .update(rabEstimate)
    .set({
      status: "APPROVED",
      approvedValue: approvedValue.toFixed(2),
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(rabEstimate.id, revised.id));
  await tx
    .update(project)
    .set({ totalContractValue: approvedValue.toFixed(2), updatedAt: new Date() })
    .where(eq(project.id, changeOrder.projectId));
  const budget = await tx.query.projectBudgets.findFirst({
    where: eq(projectBudgets.projectId, changeOrder.projectId),
    with: { categories: true },
  });
  if (budget) {
    const budgetCapRatio = Number(budget.budgetCapRatio);
    const derivation = calculateRabBudgetDerivation({
      items: revised.items,
      bundles: revised.bundles,
      budgetCapRatio,
    });

    await tx
      .update(projectBudgets)
      .set({
        contractValue: derivation.approvedValue.toFixed(2),
        approvedRabValue: derivation.approvedValue.toFixed(2),
        internalBudget: derivation.internalBudget.toFixed(2),
        targetGrossAmount: derivation.targetGrossAmount.toFixed(2),
        targetGrossPercentage: derivation.targetGrossPercentage.toFixed(4),
        updatedAt: new Date(),
      })
      .where(eq(projectBudgets.id, budget.id));
    for (const category of budget.categories) {
      if (category.isManualOverride) continue;
      const allocated = derivation.internalBudget * Number(category.ratioPercentage);
      const actual = Number(category.actualAmount);
      const used = allocated > 0 ? (actual / allocated) * 100 : actual > 0 ? 100 : 0;
      await tx
        .update(projectBudgetCategory)
        .set({
          allocatedAmount: allocated.toFixed(2),
          remainingAmount: (allocated - actual).toFixed(2),
          usedPercentage: used.toFixed(4),
          status: getBudgetCategoryStatus(used),
          updatedAt: new Date(),
        })
        .where(eq(projectBudgetCategory.id, category.id));
    }
  }
  if (revised.sourceProjectRapId) {
    const revisedRap = await tx.query.projectRap.findFirst({
      where: eq(projectRap.id, revised.sourceProjectRapId),
    });
    if (revisedRap?.supersedesProjectRapId) {
      await tx
        .update(projectRap)
        .set({ status: "SUPERSEDED", updatedAt: new Date() })
        .where(eq(projectRap.id, revisedRap.supersedesProjectRapId));
    }
    await tx
      .update(projectRap)
      .set({
        status: "LOCKED",
        lockedById: actor.userId,
        lockedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(projectRap.id, revised.sourceProjectRapId));
  }
  const planIds = revised.items
    .map((item) => item.sourceProjectCategoryPlanItemId)
    .filter((id): id is string => Boolean(id));
  if (planIds.length > 0) {
    const plans = await tx.query.projectCategoryPlanItem.findMany({
      where: inArray(projectCategoryPlanItem.id, planIds),
    });
    const supersededIds = plans
      .map((plan) => plan.supersedesProjectCategoryPlanItemId)
      .filter((id): id is string => Boolean(id));
    if (supersededIds.length > 0)
      await tx
        .update(projectCategoryPlanItem)
        .set({ status: "SUPERSEDED", updatedAt: new Date() })
        .where(inArray(projectCategoryPlanItem.id, supersededIds));
    await tx
      .update(projectCategoryPlanItem)
      .set({
        status: "LOCKED",
        lockedById: actor.userId,
        lockedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(inArray(projectCategoryPlanItem.id, planIds));
  }
  const [approved] = await tx
    .update(projectChangeOrder)
    .set({
      status: "APPROVED",
      approvedById: actor.userId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(projectChangeOrder.id, changeOrder.id))
    .returning();
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: selfApproval ? "EMERGENCY_SELF_APPROVE_CHANGE_ORDER" : "APPROVE_CHANGE_ORDER",
    targetTable: "project_change_order",
    targetId: approved.id,
    originalState: JSON.stringify(changeOrder),
    newState: JSON.stringify({
      ...approved,
      emergencyReason: selfApproval ? input.reason : null,
    }),
  });
  await recordNotificationEvent(tx, {
    referenceType: "change_order",
    referenceId: approved.id,
    projectId: approved.projectId,
    stage: "APPROVED",
    title: "Perubahan proyek disetujui",
    message: "Budget dan rencana proyek telah diperbarui.",
    permission: "view:rab",
    actionUrl: `/projects/${approved.projectId}`,
    actorId: actor.userId,
  });
  return approved;
}
