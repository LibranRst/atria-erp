import "server-only";

import crypto from "crypto";
import { and, eq } from "drizzle-orm";

import {
  EXPENSE_DRAFT_FORM_TYPE,
  getSubmittedExpenseDraftResult,
} from "@/app/actions/finance/expense-draft-action-utils";
import type { SubmittedExpenseDraft } from "@/app/actions/finance/expense-draft-types";
import { createSubmittedFieldRequestTx } from "@/app/actions/finance/field-request-submit";
import { writeFieldRequestAuditTx } from "@/app/actions/finance/field-request-utils";
import { db } from "@/db";
import { formDraft, projectCost } from "@/db/schema";
import type { Actor } from "@/server/actor";
import { authorizeFieldRequestActor } from "@/server/usecases/finance/authorize-field-request";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  expenseDraftPayloadSchema,
  nextExpenseDraftRevision,
  submitExpenseDraftSchema,
  type SubmitExpenseDraftInput,
  toExpenseSubmission,
  zodIssuesToDetails,
} from "@atria/core/validations/expense-draft";
import { submitFieldRequestsSchema } from "@atria/core/validations/finance";

const expenseDraftBusinessMessages: Readonly<Record<string, string>> = {
  STOCK_HANDLING_ONLY_ALLOWED_FOR_MATERIAL_CATEGORY:
    "Aksi stok hanya dapat digunakan pada kategori Material.",
  MATERIAL_LINK_ONLY_ALLOWED_FOR_MATERIAL_CATEGORY:
    "Tautan material hanya dapat digunakan pada kategori Material.",
  CATEGORY_PLAN_LINK_NOT_ALLOWED:
    "Paket kerja tidak sesuai dengan kategori atau proyek yang dipilih.",
  PROJECT_BUDGET_CATEGORY_NOT_FOUND:
    "Kategori budget proyek tidak ditemukan. Muat ulang form lalu pilih kategori kembali.",
};

export type SubmittedExpenseDraftResult = SubmittedExpenseDraft & {
  readonly projectId: string;
};

export async function submitExpenseDraftUseCase(
  actor: Actor,
  input: SubmitExpenseDraftInput,
): Promise<ActionResponse<SubmittedExpenseDraftResult>> {
  const validation = submitExpenseDraftSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Permintaan submit draft tidak valid.",
        details: zodIssuesToDetails(validation.error),
      },
    };
  }
  const authResult = await authorizeFieldRequestActor({ actor, permission: "create:cost" });
  if (!authResult.success) return authResult;
  const existing = await db.query.formDraft.findFirst({
    where: and(
      eq(formDraft.id, validation.data.draftId),
      eq(formDraft.ownerUserId, authResult.data.user.id),
      eq(formDraft.formType, EXPENSE_DRAFT_FORM_TYPE),
    ),
  });
  if (!existing) {
    return { success: false, error: { code: "NOT_FOUND", message: "Draft tidak ditemukan." } };
  }
  const draftPayload = expenseDraftPayloadSchema.safeParse(existing.payload);
  if (!draftPayload.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Draft berisi data yang tidak valid.",
        details: zodIssuesToDetails(draftPayload.error),
      },
    };
  }
  if (existing.status === "CONSUMED" && existing.submissionGroupId) {
    return {
      success: true,
      data: {
        ...(await getSubmittedExpenseDraftResult(existing.id, existing.submissionGroupId, true)),
        projectId: draftPayload.data.projectId,
      },
    };
  }
  const submission = submitFieldRequestsSchema.safeParse(toExpenseSubmission(draftPayload.data));
  if (!submission.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Lengkapi item sebelum mengajukan pengeluaran.",
        details: zodIssuesToDetails(submission.error),
      },
    };
  }
  const scoped = await authorizeFieldRequestActor({
    actor,
    permission: "create:cost",
    projectId: submission.data.projectId,
  });
  if (!scoped.success) return scoped;

  try {
    const result = await db.transaction(async (tx) => {
      const receiptGroupId = crypto.randomUUID();
      const [claimed] = await tx
        .update(formDraft)
        .set({ status: "SUBMITTING", updatedAt: new Date() })
        .where(
          and(
            eq(formDraft.id, validation.data.draftId),
            eq(formDraft.ownerUserId, scoped.data.user.id),
            eq(formDraft.status, "ACTIVE"),
            eq(formDraft.revision, validation.data.expectedRevision),
          ),
        )
        .returning();
      if (!claimed) {
        const consumed = await tx.query.formDraft.findFirst({
          where: and(
            eq(formDraft.id, validation.data.draftId),
            eq(formDraft.ownerUserId, scoped.data.user.id),
          ),
        });
        if (consumed?.status === "CONSUMED" && consumed.submissionGroupId) {
          return { duplicateGroupId: consumed.submissionGroupId, costs: [] };
        }
        throw new Error("DRAFT_CONFLICT");
      }

      const costs: Array<typeof projectCost.$inferSelect> = [];
      for (const item of submission.data.items) {
        const cost = await createSubmittedFieldRequestTx(tx, {
          projectId: submission.data.projectId,
          requestedById: scoped.data.user.id,
          receiptImageUrl: submission.data.receiptImageUrl,
          receiptGroupId,
          item,
          includeApprovalCategoryLabel: true,
        });
        costs.push(cost);
        await writeFieldRequestAuditTx(tx, {
          userId: scoped.data.user.id,
          action: "SUBMIT_EXPENSE_DRAFT",
          targetTable: "project_cost",
          targetId: cost.id,
          originalState: { draftId: validation.data.draftId },
          newState: {
            status: cost.status,
            projectId: cost.projectId,
            amount: cost.amount,
            receiptGroupId,
          },
        });
      }
      await tx
        .update(formDraft)
        .set({
          status: "CONSUMED",
          submissionGroupId: receiptGroupId,
          consumedAt: new Date(),
          revision: nextExpenseDraftRevision(validation.data.expectedRevision),
          updatedAt: new Date(),
        })
        .where(eq(formDraft.id, validation.data.draftId));
      return { duplicateGroupId: null, costs };
    });

    if (result.duplicateGroupId) {
      return {
        success: true,
        data: {
          ...(await getSubmittedExpenseDraftResult(
            validation.data.draftId,
            result.duplicateGroupId,
            true,
          )),
          projectId: submission.data.projectId,
        },
      };
    }
    const receiptGroupId = result.costs[0]?.receiptGroupId;
    if (!receiptGroupId) throw new Error("MISSING_RECEIPT_GROUP");
    return {
      success: true,
      data: {
        draftId: validation.data.draftId,
        receiptGroupId,
        projectCostIds: result.costs.map((cost) => cost.id),
        itemCount: result.costs.length,
        totalAmount: result.costs.reduce((total, cost) => total + Number(cost.amount), 0),
        idempotent: false,
        projectId: submission.data.projectId,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message === "DRAFT_CONFLICT") {
      return {
        success: false,
        error: { code: "CONFLICT", message: "Draft berubah atau sudah diajukan dari sesi lain." },
      };
    }
    const errorMessage = error instanceof Error ? error.message : "";
    return {
      success: false,
      error: {
        code: "TRANSACTION_FAILED",
        message:
          expenseDraftBusinessMessages[errorMessage] ??
          "Pengeluaran belum berhasil diajukan. Draft tetap aman untuk dicoba kembali.",
      },
    };
  }
}
