"use server";

import { and, desc, eq, lte } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { formDraft, vendorBill } from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertPermission, resolveRoleName } from "@/lib/auth/permissions";
import { assertProjectAccess } from "@/lib/auth/scoping";
import { createVendorBillTx } from "@/lib/finance/vendor-bill-write";
import type { ActionResponse } from "@/lib/types/action-response";
import {
  saveVendorBillDraftSchema,
  submitVendorBillDraftSchema,
  toVendorBillSubmission,
  vendorBillDraftIdSchema,
  vendorBillDraftPayloadSchema,
  zodIssuesToDetails,
  type SaveVendorBillDraftInput,
  type SubmitVendorBillDraftInput,
  type VendorBillDraftPayload,
} from "@/lib/validations/vendor-bill-draft";

const FORM_TYPE = "VENDOR_BILL_CREATE";
const SCHEMA_VERSION = 1;
const DRAFT_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export type VendorBillDraftRecord = {
  readonly id: string;
  readonly revision: number;
  readonly payload: VendorBillDraftPayload;
  readonly lastSavedAt: Date;
};

export type VendorBillDraftSummary = VendorBillDraftRecord & {
  readonly projectName: string;
};

export type SubmittedVendorBillDraft = {
  readonly draftId: string;
  readonly vendorBillId: string;
  readonly billNumber: string;
  readonly amount: number;
  readonly idempotent: boolean;
};

type ActionUser = { readonly id: string; readonly roleId?: string };

function nextExpiry(): Date {
  return new Date(Date.now() + DRAFT_LIFETIME_MS);
}

async function authorize(
  projectId?: string,
): Promise<ActionResponse<{ readonly user: ActionUser }>> {
  const session = await auth.api.getSession({ headers: { cookie: (await cookies()).toString() } });
  if (!session?.user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    await assertPermission(session.user, "create:vendor_bill");
    const roleName = await resolveRoleName(session.user.roleId);
    if (projectId && (roleName === "PROJECT_MANAGER" || roleName === "DESIGNER")) {
      await assertProjectAccess(projectId, session.user.id, roleName);
    }
    return { success: true, data: { user: { id: session.user.id, roleId: session.user.roleId } } };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: error instanceof Error ? error.message : "Akses ditolak.",
      },
    };
  }
}

async function expireDrafts(ownerUserId: string): Promise<void> {
  await db
    .update(formDraft)
    .set({ status: "DISCARDED", updatedAt: new Date() })
    .where(
      and(
        eq(formDraft.ownerUserId, ownerUserId),
        eq(formDraft.formType, FORM_TYPE),
        eq(formDraft.status, "ACTIVE"),
        lte(formDraft.expiresAt, new Date()),
      ),
    );
}

function record(
  row: typeof formDraft.$inferSelect,
  payload: VendorBillDraftPayload,
): VendorBillDraftRecord {
  return { id: row.id, revision: row.revision, payload, lastSavedAt: row.lastSavedAt };
}

export async function listVendorBillDrafts(): Promise<
  ActionResponse<readonly VendorBillDraftSummary[]>
> {
  const access = await authorize();
  if (!access.success) return access;
  await expireDrafts(access.data.user.id);
  const rows = await db.query.formDraft.findMany({
    where: and(
      eq(formDraft.ownerUserId, access.data.user.id),
      eq(formDraft.formType, FORM_TYPE),
      eq(formDraft.status, "ACTIVE"),
    ),
    with: { project: true },
    orderBy: [desc(formDraft.lastSavedAt)],
  });
  const result: VendorBillDraftSummary[] = [];
  for (const row of rows) {
    const payload = vendorBillDraftPayloadSchema.safeParse(row.payload);
    if (payload.success)
      result.push({
        ...record(row, payload.data),
        projectName: row.project?.name ?? "Proyek belum dipilih",
      });
  }
  return { success: true, data: result };
}

export async function getVendorBillDraft(
  input: unknown,
): Promise<ActionResponse<VendorBillDraftRecord>> {
  const parsed = vendorBillDraftIdSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Draft tagihan tidak valid.",
        details: zodIssuesToDetails(parsed.error),
      },
    };
  const access = await authorize();
  if (!access.success) return access;
  const row = await db.query.formDraft.findFirst({
    where: and(
      eq(formDraft.id, parsed.data.draftId),
      eq(formDraft.ownerUserId, access.data.user.id),
      eq(formDraft.formType, FORM_TYPE),
      eq(formDraft.status, "ACTIVE"),
    ),
  });
  if (!row || row.expiresAt <= new Date())
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Draft tidak ditemukan atau kedaluwarsa." },
    };
  const payload = vendorBillDraftPayloadSchema.safeParse(row.payload);
  if (!payload.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Isi draft tidak kompatibel." },
    };
  const scoped = await authorize(payload.data.projectId || undefined);
  if (!scoped.success) return scoped;
  return { success: true, data: record(row, payload.data) };
}

export async function saveVendorBillDraft(
  input: SaveVendorBillDraftInput,
): Promise<ActionResponse<VendorBillDraftRecord>> {
  const parsed = saveVendorBillDraftSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Periksa isi draft tagihan.",
        details: zodIssuesToDetails(parsed.error),
      },
    };
  const access = await authorize(parsed.data.payload.projectId || undefined);
  if (!access.success) return access;
  const now = new Date();
  if (!parsed.data.draftId) {
    const [created] = await db
      .insert(formDraft)
      .values({
        ownerUserId: access.data.user.id,
        formType: FORM_TYPE,
        projectId: parsed.data.payload.projectId || null,
        schemaVersion: SCHEMA_VERSION,
        revision: 1,
        payload: parsed.data.payload,
        status: "ACTIVE",
        lastSavedAt: now,
        expiresAt: nextExpiry(),
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return { success: true, data: record(created, parsed.data.payload) };
  }
  if (!parsed.data.expectedRevision)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Versi draft wajib disertakan." },
    };
  const [updated] = await db
    .update(formDraft)
    .set({
      projectId: parsed.data.payload.projectId || null,
      payload: parsed.data.payload,
      revision: parsed.data.expectedRevision + 1,
      schemaVersion: SCHEMA_VERSION,
      lastSavedAt: now,
      expiresAt: nextExpiry(),
      updatedAt: now,
    })
    .where(
      and(
        eq(formDraft.id, parsed.data.draftId),
        eq(formDraft.ownerUserId, access.data.user.id),
        eq(formDraft.formType, FORM_TYPE),
        eq(formDraft.status, "ACTIVE"),
        eq(formDraft.revision, parsed.data.expectedRevision),
      ),
    )
    .returning();
  if (!updated)
    return {
      success: false,
      error: {
        code: "CONFLICT",
        message: "Draft berubah di sesi lain. Muat versi server atau simpan sebagai draft baru.",
      },
    };
  return { success: true, data: record(updated, parsed.data.payload) };
}

export async function discardVendorBillDraft(
  input: unknown,
): Promise<ActionResponse<{ readonly draftId: string }>> {
  const parsed = vendorBillDraftIdSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Draft tagihan tidak valid." },
    };
  const access = await authorize();
  if (!access.success) return access;
  const [discarded] = await db
    .update(formDraft)
    .set({ status: "DISCARDED", updatedAt: new Date() })
    .where(
      and(
        eq(formDraft.id, parsed.data.draftId),
        eq(formDraft.ownerUserId, access.data.user.id),
        eq(formDraft.formType, FORM_TYPE),
        eq(formDraft.status, "ACTIVE"),
      ),
    )
    .returning({ id: formDraft.id });
  if (!discarded)
    return { success: false, error: { code: "NOT_FOUND", message: "Draft tidak ditemukan." } };
  return { success: true, data: { draftId: discarded.id } };
}

export async function submitVendorBillDraft(
  input: SubmitVendorBillDraftInput,
): Promise<ActionResponse<SubmittedVendorBillDraft>> {
  const parsed = submitVendorBillDraftSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Permintaan submit draft tidak valid.",
        details: zodIssuesToDetails(parsed.error),
      },
    };
  const access = await authorize();
  if (!access.success) return access;
  const existing = await db.query.formDraft.findFirst({
    where: and(
      eq(formDraft.id, parsed.data.draftId),
      eq(formDraft.ownerUserId, access.data.user.id),
      eq(formDraft.formType, FORM_TYPE),
    ),
  });
  if (!existing)
    return { success: false, error: { code: "NOT_FOUND", message: "Draft tidak ditemukan." } };
  if (existing.status === "CONSUMED" && existing.submissionGroupId) {
    const bill = await db.query.vendorBill.findFirst({
      where: eq(vendorBill.id, existing.submissionGroupId),
    });
    if (!bill)
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Tagihan hasil submit tidak ditemukan." },
      };
    return {
      success: true,
      data: {
        draftId: existing.id,
        vendorBillId: bill.id,
        billNumber: bill.billNumber,
        amount: Number(bill.amount),
        idempotent: true,
      },
    };
  }
  const payload = vendorBillDraftPayloadSchema.safeParse(existing.payload);
  if (!payload.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Isi draft tidak valid.",
        details: zodIssuesToDetails(payload.error),
      },
    };
  const submission = toVendorBillSubmission(payload.data);
  if (!submission.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Lengkapi tagihan sebelum diajukan.",
        details: zodIssuesToDetails(submission.error),
      },
    };
  const scoped = await authorize(submission.data.projectId);
  if (!scoped.success) return scoped;
  try {
    const bill = await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(formDraft)
        .set({ status: "SUBMITTING", updatedAt: new Date() })
        .where(
          and(
            eq(formDraft.id, parsed.data.draftId),
            eq(formDraft.ownerUserId, scoped.data.user.id),
            eq(formDraft.formType, FORM_TYPE),
            eq(formDraft.status, "ACTIVE"),
            eq(formDraft.revision, parsed.data.expectedRevision),
          ),
        )
        .returning();
      if (!claimed) throw new Error("DRAFT_CONFLICT");
      const created = await createVendorBillTx(tx, {
        ...submission.data,
        requestedById: scoped.data.user.id,
      });
      await tx
        .update(formDraft)
        .set({
          status: "CONSUMED",
          submissionGroupId: created.id,
          consumedAt: new Date(),
          revision: parsed.data.expectedRevision + 1,
          updatedAt: new Date(),
        })
        .where(eq(formDraft.id, claimed.id));
      return created;
    });
    revalidatePath("/expenses");
    revalidatePath(`/projects/${submission.data.projectId}`);
    return {
      success: true,
      data: {
        draftId: existing.id,
        vendorBillId: bill.id,
        billNumber: bill.billNumber,
        amount: Number(bill.amount),
        idempotent: false,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "DRAFT_CONFLICT")
      return {
        success: false,
        error: { code: "CONFLICT", message: "Draft berubah atau sudah diajukan dari sesi lain." },
      };
    if (message === "VENDOR_BILL_NUMBER_EXISTS")
      return {
        success: false,
        error: {
          code: "CONFLICT",
          message: "Nomor tagihan ini sudah terdaftar. Draft tetap aman.",
        },
      };
    return {
      success: false,
      error: {
        code: "TRANSACTION_FAILED",
        message: "Tagihan belum berhasil dibuat. Draft tetap tersedia untuk dicoba kembali.",
      },
    };
  }
}
