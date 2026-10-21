import { db } from "@backend/db";
import {
  aiProposalConfirmation,
  INSTANCE_TENANT_ID,
  projectBudgets,
  projectBudgetCategory,
  expenseCategory,
  projectCategoryPlanItem,
  itemPriceLibrary,
  vendor,
} from "@backend/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { resolveActor, type Actor } from "@backend/server/actor";
import { readOwnedStoredProposal } from "@backend/server/usecases/ai/stored-proposal";
import { confirmMutation } from "@backend/server/usecases/ai/confirm-mutation";
import {
  canPlanPackages,
  assertPackageScope,
  readPackageContext,
  buildPackageProposal,
  packageFields,
  packageFailure,
  PackageError,
} from "@backend/server/usecases/ai/category-plan-context";
import {
  lockPackageProjectTx,
  createPackageTx,
  updatePackageTx,
  copyPackageTemplateTx,
} from "@backend/server/usecases/project/category-plan-writer";
import type { FinanceTransaction } from "@backend/server/usecases/finance/mutation-access";
import {
  CATEGORY_PLAN_KIND,
  packageIdentitySchema,
  packageProposalSchema,
  packageReceiptSchema,
  type PackageProposal,
  type PackageView,
  type PackageReceipt,
} from "@atria/core/ai/category-plan";
import type { ActionResponse } from "@atria/core/types/action-response";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
import type { z } from "zod";

type Identity = z.infer<typeof packageIdentitySchema>;
async function owned(
  connection: Pick<FinanceTransaction, "query">,
  actor: Actor,
  input: Identity,
): Promise<{ proposal: PackageProposal; expiresAt: number }> {
  try {
    return await readOwnedStoredProposal(
      connection,
      actor,
      input,
      "proposeCategoryPlanPackages",
      packageProposalSchema,
    );
  } catch {
    throw new PackageError("NOT_FOUND", "Usulan paket tidak ditemukan pada percakapan Anda.");
  }
}
const denied: ActionResponse<never> = {
  success: false,
  error: { code: "FORBIDDEN", message: "Akses chat dan perencanaan budget proyek diperlukan." },
};
export async function getAiCategoryPlanProposal(
  input: unknown,
): Promise<ActionResponse<PackageView>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!canPlanPackages(actor)) return denied;
  const identity = packageIdentitySchema.safeParse(input);
  if (!identity.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Identitas usulan tidak valid." },
    };
  try {
    const stored = await owned(db, actor, identity.data);
    await assertPackageScope(actor, stored.proposal.projectId);
    const receipt = await db.query.aiProposalConfirmation.findFirst({
      where: and(
        eq(aiProposalConfirmation.tenantId, INSTANCE_TENANT_ID),
        eq(aiProposalConfirmation.userId, actor.userId),
        eq(aiProposalConfirmation.conversationId, identity.data.conversationId),
        eq(aiProposalConfirmation.toolCallId, identity.data.toolCallId),
        eq(aiProposalConfirmation.proposalType, CATEGORY_PLAN_KIND),
      ),
    });
    if (receipt)
      return {
        success: true,
        data: {
          proposal: stored.proposal,
          status: "CONFIRMED",
          confirmedAt: receipt.createdAt.toISOString(),
        },
      };
    if (stored.expiresAt <= Date.now())
      return {
        success: true,
        data: { proposal: stored.proposal, status: "EXPIRED", confirmedAt: null },
      };
    let status: PackageView["status"] = "STALE";
    try {
      const state = await readPackageContext(
        actor,
        stored.proposal.projectId,
        stored.proposal.request,
      );
      if (
        state.fingerprint === stored.proposal.expectedContext &&
        JSON.stringify(
          buildPackageProposal(
            stored.proposal.request,
            state,
            stored.proposal.rows.map((r) => r.rowId),
          ),
        ) === JSON.stringify(stored.proposal)
      )
        status = "READY";
    } catch (error: unknown) {
      if (error instanceof PackageError && error.code === "FORBIDDEN") throw error;
    }
    return { success: true, data: { proposal: stored.proposal, status, confirmedAt: null } };
  } catch (error: unknown) {
    return packageFailure(error);
  }
}
export async function confirmAiCategoryPlanProposal(
  input: unknown,
): Promise<ActionResponse<PackageReceipt>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!canPlanPackages(actor)) return denied;
  const identity = packageIdentitySchema.safeParse(input);
  if (!identity.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Konfirmasi hanya menerima identitas usulan server.",
      },
    };
  let stored: Awaited<ReturnType<typeof owned>>;
  try {
    stored = await owned(db, actor, identity.data);
    await assertPackageScope(actor, stored.proposal.projectId);
  } catch (error: unknown) {
    return packageFailure(error);
  }
  const result = await confirmMutation(
    actor,
    identity.data,
    CATEGORY_PLAN_KIND,
    async (tx) => {
      const fresh = await owned(tx, actor, identity.data);
      const proposal = fresh.proposal;
      if (fresh.expiresAt <= Date.now())
        throw new PackageError("CONFLICT", "Usulan paket sudah kedaluwarsa. Minta usulan terbaru.");
      await lockPackageProjectTx(tx, actor, proposal.projectId);
      const budgets = await tx
        .select()
        .from(projectBudgets)
        .where(
          and(
            eq(projectBudgets.projectId, proposal.projectId),
            eq(projectBudgets.tenantId, INSTANCE_TENANT_ID),
          ),
        )
        .for("share");
      const budget = budgets[0];
      if (!budget) throw new PackageError("CONFLICT", "Budget proyek berubah.");
      const cats = await tx
        .select()
        .from(projectBudgetCategory)
        .where(eq(projectBudgetCategory.projectBudgetId, budget.id))
        .orderBy(asc(projectBudgetCategory.id))
        .for("share");
      const catIds = cats.map((c) => c.expenseCategoryId);
      if (catIds.length)
        await tx
          .select({ id: expenseCategory.id })
          .from(expenseCategory)
          .where(inArray(expenseCategory.id, catIds))
          .orderBy(asc(expenseCategory.id))
          .for("share");
      await tx
        .select({ id: projectCategoryPlanItem.id })
        .from(projectCategoryPlanItem)
        .where(
          and(
            eq(projectCategoryPlanItem.projectId, proposal.projectId),
            eq(projectCategoryPlanItem.tenantId, INSTANCE_TENANT_ID),
          ),
        )
        .orderBy(asc(projectCategoryPlanItem.id))
        .for("update");
      const libraryIds = [
        ...new Set(
          proposal.rows.flatMap((r) =>
            r.after.sourceLibraryItemId ? [r.after.sourceLibraryItemId] : [],
          ),
        ),
      ].sort();
      if (libraryIds.length)
        await tx
          .select({ id: itemPriceLibrary.id })
          .from(itemPriceLibrary)
          .where(inArray(itemPriceLibrary.id, libraryIds))
          .orderBy(asc(itemPriceLibrary.id))
          .for("share");
      const vendorIds = [
        ...new Set(
          proposal.rows.flatMap((r) =>
            [r.before?.vendorId, r.after.vendorId].filter((id): id is string => Boolean(id)),
          ),
        ),
      ].sort();
      if (vendorIds.length)
        await tx
          .select({ id: vendor.id })
          .from(vendor)
          .where(inArray(vendor.id, vendorIds))
          .orderBy(asc(vendor.id))
          .for("share");
      const state = await readPackageContext(actor, proposal.projectId, proposal.request, tx);
      if (
        state.fingerprint !== proposal.expectedContext ||
        JSON.stringify(
          buildPackageProposal(
            proposal.request,
            state,
            proposal.rows.map((r) => r.rowId),
          ),
        ) !== JSON.stringify(proposal)
      )
        throw new PackageError(
          "CONFLICT",
          "Paket, budget atau referensi berubah. Minta preview terbaru.",
        );
      const items: PackageReceipt["items"] = [];
      for (const [index, row] of proposal.rows.entries()) {
        const category = proposal.budgets.find((b) => b.category === row.category);
        if (!category) throw new PackageError("VALIDATION_ERROR", "Kategori usulan tidak valid.");
        const request = proposal.request.rows[index];
        let id: string;
        if (row.action === "UPDATE" && row.itemId) {
          const updated = await updatePackageTx(tx, actor, {
            projectId: proposal.projectId,
            projectBudgetCategoryId: category.categoryId,
            projectCategoryPlanItemId: row.itemId,
            ...packageFields(row.after),
            status: "DRAFT",
          });
          id = updated.id;
        } else if (request?.action === "CREATE" && request.draft.source === "LIBRARY") {
          const created = await copyPackageTemplateTx(
            tx,
            actor,
            {
              projectId: proposal.projectId,
              projectBudgetCategoryId: category.categoryId,
              itemPriceLibraryId: request.draft.libraryId,
              area: request.draft.area,
              quantity: request.draft.quantity,
              overrideUnitCost: request.draft.overrideUnitCost,
              overrideReason: request.draft.overrideReason,
            },
            row.rowId,
          );
          id = created.id;
        } else {
          const created = await createPackageTx(
            tx,
            actor,
            {
              projectId: proposal.projectId,
              projectBudgetCategoryId: category.categoryId,
              ...packageFields(row.after),
            },
            undefined,
            row.rowId,
          );
          id = created.id;
        }
        items.push({ rowId: row.rowId, itemId: id, action: row.action });
      }
      return { documentId: items[0].itemId, result: { items } };
    },
    packageFailure,
  );
  if (!result.success) return result;
  revalidateWorkspacePath(`/projects/${stored.proposal.projectId}`);
  return {
    success: true,
    data: packageReceiptSchema.parse({
      items: stored.proposal.rows.map((row) => ({
        rowId: row.rowId,
        itemId: row.itemId ?? row.rowId,
        action: row.action,
      })),
      alreadyConfirmed: result.data.kind === "already",
    }),
  };
}
