"use server";

import crypto from "crypto";
import { and, desc, eq, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { authorizeFieldRequestAction } from "@/app/actions/finance/field-request-auth";
import { createSubmittedFieldRequestTx } from "@/app/actions/finance/field-request-submit";
import { writeFieldRequestAuditTx } from "@/app/actions/finance/field-request-utils";
import { db } from "@/db";
import { formDraft, projectCost } from "@/db/schema";
import type { ActionResponse } from "@/lib/types/action-response";
import {
  expenseDraftIdSchema,
  expenseDraftPayloadSchema,
  saveExpenseDraftSchema,
  submitExpenseDraftSchema,
  nextExpenseDraftRevision,
  toExpenseSubmission,
  zodIssuesToDetails,
  type ExpenseDraftPayloadInput,
  type SaveExpenseDraftInput,
  type SubmitExpenseDraftInput,
} from "@/lib/validations/expense-draft";
import { submitFieldRequestsSchema } from "@/lib/validations/finance";

const FORM_TYPE = "EXPENSE_CREATE";
const SCHEMA_VERSION = 1;
const DRAFT_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export type ExpenseDraftSummary = {
  readonly id: string;
  readonly revision: number;
  readonly projectId: string;
  readonly projectName: string;
  readonly itemCount: number;
  readonly totalAmount: number;
  readonly hasReceipt: boolean;
  readonly lastSavedAt: Date;
};

export type ExpenseDraftRecord = {
  readonly id: string;
  readonly revision: number;
  readonly payload: ExpenseDraftPayloadInput;
  readonly lastSavedAt: Date;
};

export type SubmittedExpenseDraft = {
  readonly draftId: string;
  readonly receiptGroupId: string;
  readonly projectCostIds: readonly string[];
  readonly itemCount: number;
  readonly totalAmount: number;
  readonly idempotent: boolean;
};

function nextExpiry(): Date {
  return new Date(Date.now() + DRAFT_LIFETIME_MS);
}

async function deleteImageKitFile(fileId: string): Promise<void> {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!privateKey || !fileId) return;

  const response = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`IMAGEKIT_DELETE_FAILED_${response.status}`);
  }
}

async function cleanupExpiredDrafts(ownerUserId: string): Promise<void> {
  const expired = await db.query.formDraft.findMany({
    where: and(
      eq(formDraft.ownerUserId, ownerUserId),
      eq(formDraft.formType, FORM_TYPE),
      eq(formDraft.status, "ACTIVE"),
      lte(formDraft.expiresAt, new Date()),
    ),
  });

  for (const draft of expired) {
    const parsed = expenseDraftPayloadSchema.safeParse(draft.payload);
    await db
      .update(formDraft)
      .set({ status: "DISCARDED", updatedAt: new Date() })
      .where(
        and(
          eq(formDraft.id, draft.id),
          eq(formDraft.ownerUserId, ownerUserId),
          eq(formDraft.status, "ACTIVE"),
        ),
      );

    if (parsed.success && parsed.data.receipt?.fileId) {
      try {
        await deleteImageKitFile(parsed.data.receipt.fileId);
      } catch (error) {
        console.error("Failed to remove expired draft attachment:", error);
      }
    }
  }
}

async function submittedResult(
  draftId: string,
  receiptGroupId: string,
  idempotent: boolean,
): Promise<SubmittedExpenseDraft> {
  const costs = await db.query.projectCost.findMany({
    where: eq(projectCost.receiptGroupId, receiptGroupId),
  });
  return {
    draftId,
    receiptGroupId,
    projectCostIds: costs.map((cost) => cost.id),
    itemCount: costs.length,
    totalAmount: costs.reduce((total, cost) => total + Number(cost.amount), 0),
    idempotent,
  };
}

export async function listExpenseDrafts(): Promise<ActionResponse<readonly ExpenseDraftSummary[]>> {
  const authResult = await authorizeFieldRequestAction({ permission: "create:cost" });
  if (!authResult.success) return authResult;
  const ownerUserId = authResult.data.user.id;

  await cleanupExpiredDrafts(ownerUserId);
  const drafts = await db.query.formDraft.findMany({
    where: and(
      eq(formDraft.ownerUserId, ownerUserId),
      eq(formDraft.formType, FORM_TYPE),
      eq(formDraft.status, "ACTIVE"),
    ),
    with: { project: true },
    orderBy: [desc(formDraft.lastSavedAt)],
  });

  const summaries: ExpenseDraftSummary[] = [];
  for (const draft of drafts) {
    const parsed = expenseDraftPayloadSchema.safeParse(draft.payload);
    if (!parsed.success) continue;
    summaries.push({
      id: draft.id,
      revision: draft.revision,
      projectId: parsed.data.projectId,
      projectName: draft.project?.name ?? "Proyek belum dipilih",
      itemCount: parsed.data.lines.length,
      totalAmount: parsed.data.lines.reduce((total, line) => total + Number(line.amount || 0), 0),
      hasReceipt: Boolean(parsed.data.receipt),
      lastSavedAt: draft.lastSavedAt,
    });
  }
  return { success: true, data: summaries };
}

export async function getExpenseDraft(input: unknown): Promise<ActionResponse<ExpenseDraftRecord>> {
  const validation = expenseDraftIdSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Draft pengeluaran tidak valid.",
        details: zodIssuesToDetails(validation.error),
      },
    };
  }
  const authResult = await authorizeFieldRequestAction({ permission: "create:cost" });
  if (!authResult.success) return authResult;
  const draft = await db.query.formDraft.findFirst({
    where: and(
      eq(formDraft.id, validation.data.draftId),
      eq(formDraft.ownerUserId, authResult.data.user.id),
      eq(formDraft.formType, FORM_TYPE),
      eq(formDraft.status, "ACTIVE"),
    ),
  });
  if (!draft || draft.expiresAt <= new Date()) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Draft tidak ditemukan atau sudah kedaluwarsa." },
    };
  }
  const payload = expenseDraftPayloadSchema.safeParse(draft.payload);
  if (!payload.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Isi draft tidak lagi kompatibel." },
    };
  }
  if (payload.data.projectId) {
    const scoped = await authorizeFieldRequestAction({
      permission: "create:cost",
      projectId: payload.data.projectId,
    });
    if (!scoped.success) return scoped;
  }
  return {
    success: true,
    data: {
      id: draft.id,
      revision: draft.revision,
      payload: payload.data,
      lastSavedAt: draft.lastSavedAt,
    },
  };
}

export async function saveExpenseDraft(
  input: SaveExpenseDraftInput,
): Promise<ActionResponse<ExpenseDraftRecord>> {
  const validation = saveExpenseDraftSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Periksa kembali isi draft pengeluaran.",
        details: zodIssuesToDetails(validation.error),
      },
    };
  }
  const authResult = await authorizeFieldRequestAction({
    permission: "create:cost",
    projectId: validation.data.payload.projectId || undefined,
  });
  if (!authResult.success) return authResult;
  const now = new Date();

  if (!validation.data.draftId) {
    const [created] = await db
      .insert(formDraft)
      .values({
        ownerUserId: authResult.data.user.id,
        formType: FORM_TYPE,
        projectId: validation.data.payload.projectId || null,
        schemaVersion: SCHEMA_VERSION,
        revision: 1,
        payload: validation.data.payload,
        status: "ACTIVE",
        lastSavedAt: now,
        expiresAt: nextExpiry(),
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return {
      success: true,
      data: {
        id: created.id,
        revision: created.revision,
        payload: validation.data.payload,
        lastSavedAt: created.lastSavedAt,
      },
    };
  }

  if (!validation.data.expectedRevision) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Versi draft wajib disertakan." },
    };
  }
  const nextRevision = nextExpenseDraftRevision(validation.data.expectedRevision);
  const [updated] = await db
    .update(formDraft)
    .set({
      projectId: validation.data.payload.projectId || null,
      payload: validation.data.payload,
      revision: nextRevision,
      schemaVersion: SCHEMA_VERSION,
      lastSavedAt: now,
      expiresAt: nextExpiry(),
      updatedAt: now,
    })
    .where(
      and(
        eq(formDraft.id, validation.data.draftId),
        eq(formDraft.ownerUserId, authResult.data.user.id),
        eq(formDraft.formType, FORM_TYPE),
        eq(formDraft.status, "ACTIVE"),
        eq(formDraft.revision, validation.data.expectedRevision),
      ),
    )
    .returning();

  if (!updated) {
    return {
      success: false,
      error: {
        code: "CONFLICT",
        message: "Draft berubah di sesi lain. Muat versi terbaru atau simpan sebagai salinan baru.",
      },
    };
  }
  return {
    success: true,
    data: {
      id: updated.id,
      revision: updated.revision,
      payload: validation.data.payload,
      lastSavedAt: updated.lastSavedAt,
    },
  };
}

export async function discardExpenseDraft(
  input: unknown,
): Promise<ActionResponse<{ readonly draftId: string }>> {
  const validation = expenseDraftIdSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Draft pengeluaran tidak valid." },
    };
  }
  const authResult = await authorizeFieldRequestAction({ permission: "create:cost" });
  if (!authResult.success) return authResult;
  const draft = await db.query.formDraft.findFirst({
    where: and(
      eq(formDraft.id, validation.data.draftId),
      eq(formDraft.ownerUserId, authResult.data.user.id),
      eq(formDraft.formType, FORM_TYPE),
      eq(formDraft.status, "ACTIVE"),
    ),
  });
  if (!draft) {
    return { success: false, error: { code: "NOT_FOUND", message: "Draft tidak ditemukan." } };
  }
  const payload = expenseDraftPayloadSchema.safeParse(draft.payload);
  await db
    .update(formDraft)
    .set({ status: "DISCARDED", updatedAt: new Date() })
    .where(and(eq(formDraft.id, draft.id), eq(formDraft.status, "ACTIVE")));
  if (payload.success && payload.data.receipt?.fileId) {
    try {
      await deleteImageKitFile(payload.data.receipt.fileId);
    } catch (error) {
      console.error("Failed to remove discarded draft attachment:", error);
    }
  }
  revalidatePath("/expenses");
  return { success: true, data: { draftId: draft.id } };
}

export async function submitExpenseDraft(
  input: SubmitExpenseDraftInput,
): Promise<ActionResponse<SubmittedExpenseDraft>> {
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
  const authResult = await authorizeFieldRequestAction({ permission: "create:cost" });
  if (!authResult.success) return authResult;
  const existing = await db.query.formDraft.findFirst({
    where: and(
      eq(formDraft.id, validation.data.draftId),
      eq(formDraft.ownerUserId, authResult.data.user.id),
      eq(formDraft.formType, FORM_TYPE),
    ),
  });
  if (!existing) {
    return { success: false, error: { code: "NOT_FOUND", message: "Draft tidak ditemukan." } };
  }
  if (existing.status === "CONSUMED" && existing.submissionGroupId) {
    return {
      success: true,
      data: await submittedResult(existing.id, existing.submissionGroupId, true),
    };
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
  const scoped = await authorizeFieldRequestAction({
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
        data: await submittedResult(validation.data.draftId, result.duplicateGroupId, true),
      };
    }
    const receiptGroupId = result.costs[0]?.receiptGroupId;
    if (!receiptGroupId) throw new Error("MISSING_RECEIPT_GROUP");
    revalidatePath("/expenses");
    revalidatePath(`/projects/${submission.data.projectId}`);
    return {
      success: true,
      data: {
        draftId: validation.data.draftId,
        receiptGroupId,
        projectCostIds: result.costs.map((cost) => cost.id),
        itemCount: result.costs.length,
        totalAmount: result.costs.reduce((total, cost) => total + Number(cost.amount), 0),
        idempotent: false,
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
    const businessMessages: Record<string, string> = {
      STOCK_HANDLING_ONLY_ALLOWED_FOR_MATERIAL_CATEGORY:
        "Aksi stok hanya dapat digunakan pada kategori Material.",
      MATERIAL_LINK_ONLY_ALLOWED_FOR_MATERIAL_CATEGORY:
        "Tautan material hanya dapat digunakan pada kategori Material.",
      CATEGORY_PLAN_LINK_NOT_ALLOWED:
        "Paket kerja tidak sesuai dengan kategori atau proyek yang dipilih.",
      PROJECT_BUDGET_CATEGORY_NOT_FOUND:
        "Kategori budget proyek tidak ditemukan. Muat ulang form lalu pilih kategori kembali.",
    };
    return {
      success: false,
      error: {
        code: "TRANSACTION_FAILED",
        message:
          businessMessages[errorMessage] ??
          "Pengeluaran belum berhasil diajukan. Draft tetap aman untuk dicoba kembali.",
      },
    };
  }
}
