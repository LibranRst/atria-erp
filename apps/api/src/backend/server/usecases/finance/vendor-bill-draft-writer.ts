import { and, eq } from "drizzle-orm";
import { formDraft, INSTANCE_TENANT_ID } from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import {
  assertFinancePermission,
  lockFinanceProject,
  type FinanceTransaction,
} from "./mutation-access";
import { assertProjectStatusIsOperational } from "@backend/lib/auth/scoping";
import { createVendorBillTx } from "@backend/lib/finance/vendor-bill-write";
import { authorizedPrivateAttachment } from "../media/private-attachments";
import {
  saveVendorBillDraftSchema,
  vendorBillDraftPayloadSchema,
  toVendorBillSubmission,
  submitVendorBillDraftSchema,
  type VendorBillDraftPayload,
} from "@atria/core/validations/vendor-bill-draft";

export const VENDOR_BILL_FORM_TYPE = "VENDOR_BILL_CREATE";
export async function validateInvoiceSourcesTx(
  tx: FinanceTransaction,
  actor: Actor,
  payload: VendorBillDraftPayload,
): Promise<void> {
  for (const url of payload.invoice?.urls ?? []) {
    const row = await authorizedPrivateAttachment(actor, url, "ai_chat", tx);
    if (row.uploadedById !== actor.userId)
      throw new Error("FORBIDDEN: Lampiran invoice bukan milik Anda.");
  }
}
export async function saveVendorBillDraftTx(
  tx: FinanceTransaction,
  actor: Actor,
  raw: unknown,
): Promise<typeof formDraft.$inferSelect> {
  assertFinancePermission(actor, "create:vendor_bill");
  const input = saveVendorBillDraftSchema.parse(raw);
  if (input.draftId)
    await tx
      .select()
      .from(formDraft)
      .where(
        and(
          eq(formDraft.id, input.draftId),
          eq(formDraft.ownerUserId, actor.userId),
          eq(formDraft.tenantId, INSTANCE_TENANT_ID),
        ),
      )
      .for("update");
  if (input.payload.projectId) {
    const project = await lockFinanceProject(tx, actor, input.payload.projectId);
    if (project.tenantId !== INSTANCE_TENANT_ID || !["DRAFT", "ACTIVE"].includes(project.status))
      throw new Error("FORBIDDEN: Proyek tidak tersedia untuk draft tagihan.");
  }
  await validateInvoiceSourcesTx(tx, actor, input.payload);
  const now = new Date(),
    expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (!input.draftId) {
    const [created] = await tx
      .insert(formDraft)
      .values({
        ownerUserId: actor.userId,
        formType: VENDOR_BILL_FORM_TYPE,
        projectId: input.payload.projectId || null,
        schemaVersion: 1,
        revision: 1,
        payload: input.payload,
        status: "ACTIVE",
        lastSavedAt: now,
        expiresAt,
        updatedAt: now,
      })
      .returning();
    return created;
  }
  if (!input.expectedRevision) throw new Error("DRAFT_CONFLICT");
  const [updated] = await tx
    .update(formDraft)
    .set({
      projectId: input.payload.projectId || null,
      payload: input.payload,
      revision: input.expectedRevision + 1,
      lastSavedAt: now,
      expiresAt,
      updatedAt: now,
    })
    .where(
      and(
        eq(formDraft.id, input.draftId),
        eq(formDraft.tenantId, INSTANCE_TENANT_ID),
        eq(formDraft.ownerUserId, actor.userId),
        eq(formDraft.formType, VENDOR_BILL_FORM_TYPE),
        eq(formDraft.status, "ACTIVE"),
        eq(formDraft.revision, input.expectedRevision),
      ),
    )
    .returning();
  if (!updated) throw new Error("DRAFT_CONFLICT");
  return updated;
}
export async function submitVendorBillDraftTx(
  tx: FinanceTransaction,
  actor: Actor,
  raw: unknown,
): Promise<{
  draftId: string;
  vendorBillId: string;
  billNumber: string;
  amount: number;
  idempotent: boolean;
}> {
  assertFinancePermission(actor, "create:vendor_bill");
  const input = submitVendorBillDraftSchema.parse(raw);
  const [draft] = await tx
    .select()
    .from(formDraft)
    .where(
      and(
        eq(formDraft.id, input.draftId),
        eq(formDraft.tenantId, INSTANCE_TENANT_ID),
        eq(formDraft.ownerUserId, actor.userId),
        eq(formDraft.formType, VENDOR_BILL_FORM_TYPE),
      ),
    )
    .for("update");
  if (!draft || !draft.projectId) throw new Error("DRAFT_CONFLICT");
  const project = await lockFinanceProject(tx, actor, draft.projectId);
  if (project.tenantId !== INSTANCE_TENANT_ID) throw new Error("FORBIDDEN: Proyek tidak tersedia.");
  assertProjectStatusIsOperational(project.status);
  if (draft.status === "CONSUMED" && draft.submissionGroupId) {
    const existing = await tx.query.vendorBill.findFirst({
      where: (t, { and: all, eq: equal }) =>
        all(
          equal(t.id, draft.submissionGroupId!),
          equal(t.tenantId, INSTANCE_TENANT_ID),
          equal(t.projectId, project.id),
        ),
    });
    if (!existing) throw new Error("DRAFT_CONFLICT");
    return {
      draftId: draft.id,
      vendorBillId: existing.id,
      billNumber: existing.billNumber,
      amount: Number(existing.amount),
      idempotent: true,
    };
  }
  if (
    draft.status !== "ACTIVE" ||
    draft.revision !== input.expectedRevision ||
    draft.expiresAt <= new Date()
  )
    throw new Error("DRAFT_CONFLICT");
  const payload = vendorBillDraftPayloadSchema.parse(draft.payload);
  await validateInvoiceSourcesTx(tx, actor, payload);
  const submission = toVendorBillSubmission(payload);
  if (!submission.success) throw new Error("VENDOR_BILL_INCOMPLETE");
  const created = await createVendorBillTx(tx, { ...submission.data, requestedById: actor.userId });
  await tx
    .update(formDraft)
    .set({
      status: "CONSUMED",
      submissionGroupId: created.id,
      consumedAt: new Date(),
      revision: draft.revision + 1,
      updatedAt: new Date(),
    })
    .where(eq(formDraft.id, draft.id));
  return {
    draftId: draft.id,
    vendorBillId: created.id,
    billNumber: created.billNumber,
    amount: Number(created.amount),
    idempotent: false,
  };
}
