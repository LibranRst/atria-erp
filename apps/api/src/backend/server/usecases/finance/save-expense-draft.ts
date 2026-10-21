import { assertExpenseAttachment } from "./expense-attachment";
import { and, eq } from "drizzle-orm";

import {
  EXPENSE_DRAFT_FORM_TYPE,
  EXPENSE_DRAFT_SCHEMA_VERSION,
  nextExpenseDraftExpiry,
} from "@backend/app/actions/finance/expense-draft-action-utils";
import type { ExpenseDraftRecord } from "@backend/app/actions/finance/expense-draft-types";
import { db } from "@backend/db";
import { formDraft } from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import { authorizeFieldRequestActor } from "@backend/server/usecases/finance/authorize-field-request";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  nextExpenseDraftRevision,
  saveExpenseDraftSchema,
  type SaveExpenseDraftInput,
  zodIssuesToDetails,
} from "@atria/core/validations/expense-draft";

export async function saveExpenseDraftUseCase(
  actor: Actor,
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
  const authResult = await authorizeFieldRequestActor({
    actor,
    permission: "create:cost",
    projectId: validation.data.payload.projectId || undefined,
  });
  if (!authResult.success) return authResult;
  try {
    const receipt = validation.data.payload.receipt;
    if (receipt)
      await assertExpenseAttachment(
        actor,
        validation.data.payload.projectId,
        receipt.url,
        receipt.fileId,
      );
  } catch {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message:
          "Bukti pengeluaran tidak sesuai dengan akun atau proyek. Unggah ulang bukti untuk draft ini.",
      },
    };
  }
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
