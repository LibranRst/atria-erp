import { resolveActor } from "@backend/server/actor";
import {
  saveVendorBillDraftTx,
  submitVendorBillDraftTx,
} from "@backend/server/usecases/finance/vendor-bill-draft-writer";
import { getRoleDataScopeByName } from "@backend/lib/auth/role-access";

import { and, desc, eq, lte } from "drizzle-orm";
import { cookies } from "@runtime/request-context";
import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";

import { db } from "@backend/db";
import { formDraft } from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { assertPermission, resolveRoleName } from "@backend/lib/auth/permissions";
import { assertProjectAccess } from "@backend/lib/auth/scoping";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  saveVendorBillDraftSchema,
  submitVendorBillDraftSchema,
  vendorBillDraftIdSchema,
  vendorBillDraftPayloadSchema,
  zodIssuesToDetails,
  type SaveVendorBillDraftInput,
  type SubmitVendorBillDraftInput,
  type VendorBillDraftPayload,
} from "@atria/core/validations/vendor-bill-draft";

const FORM_TYPE = "VENDOR_BILL_CREATE";

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

async function authorize(
  projectId?: string,
): Promise<ActionResponse<{ readonly user: ActionUser }>> {
  const session = await auth.api.getSession({ headers: { cookie: (await cookies()).toString() } });
  if (!session?.user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    await assertPermission(session.user, "create:vendor_bill");
    const roleName = await resolveRoleName(session.user.roleId);
    if (projectId && (await getRoleDataScopeByName(roleName)) === "ASSIGNED") {
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
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const row = await db.transaction((tx) => saveVendorBillDraftTx(tx, actor, parsed.data));
    return { success: true, data: record(row, parsed.data.payload) };
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        code:
          error instanceof Error && error.message.startsWith("FORBIDDEN")
            ? "FORBIDDEN"
            : "CONFLICT",
        message: "Draft berubah atau akses tidak tersedia. Periksa draft terbaru.",
      },
    };
  }
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
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction((tx) => submitVendorBillDraftTx(tx, actor, parsed.data));
    revalidatePath("/expenses");
    return { success: true, data: result };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    return {
      success: false,
      error: {
        code: message.startsWith("FORBIDDEN")
          ? "FORBIDDEN"
          : message === "VENDOR_BILL_INCOMPLETE"
            ? "VALIDATION_ERROR"
            : "CONFLICT",
        message:
          message === "VENDOR_BILL_NUMBER_EXISTS"
            ? "Nomor tagihan ini sudah terdaftar. Draft tetap aman."
            : message === "VENDOR_BILL_INCOMPLETE"
              ? "Lengkapi tagihan sebelum diajukan."
              : "Draft, sumber atau akses berubah. Periksa draft terbaru; draft tetap aman.",
      },
    };
  }
}
