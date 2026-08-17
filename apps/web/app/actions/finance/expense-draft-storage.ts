"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { authorizeFieldRequestAction } from "@/app/actions/finance/field-request-auth";
import {
  cleanupExpiredExpenseDrafts,
  deleteExpenseDraftAttachment,
  EXPENSE_DRAFT_FORM_TYPE,
  EXPENSE_DRAFT_SCHEMA_VERSION,
  nextExpenseDraftExpiry,
} from "@/app/actions/finance/expense-draft-action-utils";
import type {
  ExpenseDraftRecord,
  ExpenseDraftSummary,
} from "@/app/actions/finance/expense-draft-types";
import { db } from "@/db";
import { formDraft } from "@/db/schema";
import type { ActionResponse } from "@/lib/types/action-response";
import {
  expenseDraftIdSchema,
  expenseDraftPayloadSchema,
  nextExpenseDraftRevision,
  saveExpenseDraftSchema,
  type SaveExpenseDraftInput,
  zodIssuesToDetails,
} from "@/lib/validations/expense-draft";

export async function listExpenseDrafts(): Promise<ActionResponse<readonly ExpenseDraftSummary[]>> {
  const authResult = await authorizeFieldRequestAction({ permission: "create:cost" });
  if (!authResult.success) return authResult;
  const ownerUserId = authResult.data.user.id;
  await cleanupExpiredExpenseDrafts(ownerUserId);
  const drafts = await db.query.formDraft.findMany({
    where: and(
      eq(formDraft.ownerUserId, ownerUserId),
      eq(formDraft.formType, EXPENSE_DRAFT_FORM_TYPE),
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
      eq(formDraft.formType, EXPENSE_DRAFT_FORM_TYPE),
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
        formType: EXPENSE_DRAFT_FORM_TYPE,
        projectId: validation.data.payload.projectId || null,
        schemaVersion: EXPENSE_DRAFT_SCHEMA_VERSION,
        revision: 1,
        payload: validation.data.payload,
        status: "ACTIVE",
        lastSavedAt: now,
        expiresAt: nextExpenseDraftExpiry(),
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
      schemaVersion: EXPENSE_DRAFT_SCHEMA_VERSION,
      lastSavedAt: now,
      expiresAt: nextExpenseDraftExpiry(),
      updatedAt: now,
    })
    .where(
      and(
        eq(formDraft.id, validation.data.draftId),
        eq(formDraft.ownerUserId, authResult.data.user.id),
        eq(formDraft.formType, EXPENSE_DRAFT_FORM_TYPE),
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
      eq(formDraft.formType, EXPENSE_DRAFT_FORM_TYPE),
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
      await deleteExpenseDraftAttachment(payload.data.receipt.fileId);
    } catch (error) {
      console.error("Failed to remove discarded draft attachment:", error);
    }
  }
  revalidatePath("/expenses");
  return { success: true, data: { draftId: draft.id } };
}
