import { and, eq, inArray, lte } from "drizzle-orm";
import { configuredAttachmentOrigins } from "@atria/core/media/web-origins";

import type { SubmittedExpenseDraft } from "@backend/app/actions/finance/expense-draft-types";
import { db } from "@backend/db";
import { formDraft, projectCost, attachment } from "@backend/db/schema";
import { expenseDraftPayloadSchema } from "@atria/core/validations/expense-draft";

export const EXPENSE_DRAFT_FORM_TYPE = "EXPENSE_CREATE";
export const EXPENSE_DRAFT_SCHEMA_VERSION = 1;
const DRAFT_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export function nextExpenseDraftExpiry(): Date {
  return new Date(Date.now() + DRAFT_LIFETIME_MS);
}

export async function deleteExpenseDraftAttachment(
  fileId: string,
  ownerUserId: string,
): Promise<void> {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!privateKey || !fileId) return;
  const registered = await db.query.attachment
    .findFirst({ where: and(eq(attachment.id, fileId), eq(attachment.uploadedById, ownerUserId)) })
    .catch(() => undefined);
  if (!registered?.storageFileId || registered.referenceType !== "private_expense") return;
  // Keep an uploaded proof if a submitted cost already refers to it.
  const references = configuredAttachmentOrigins(process.env).map(
    (origin: string): string => new URL(`/api/media/attachments/${fileId}`, origin).href,
  );
  const inUse = await db.query.projectCost.findFirst({
    where: inArray(projectCost.receiptImageUrl, references),
    columns: { id: true },
  });
  if (inUse) return;
  const response = await fetch(
    `https://api.imagekit.io/v1/files/${encodeURIComponent(registered.storageFileId)}`,
    {
      method: "DELETE",
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}` },
    },
  );
  if (!response.ok && response.status !== 404) {
    throw new Error(`IMAGEKIT_DELETE_FAILED_${response.status}`);
  }
  await db.delete(attachment).where(eq(attachment.id, registered.id));
}

export async function cleanupExpiredExpenseDrafts(ownerUserId: string): Promise<void> {
  const expired = await db.query.formDraft.findMany({
    where: and(
      eq(formDraft.ownerUserId, ownerUserId),
      eq(formDraft.formType, EXPENSE_DRAFT_FORM_TYPE),
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
        await deleteExpenseDraftAttachment(parsed.data.receipt.fileId, ownerUserId);
      } catch (error) {
        console.error("Failed to remove expired draft attachment:", error);
      }
    }
  }
}

export async function getSubmittedExpenseDraftResult(
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
