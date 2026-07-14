import { db } from "@/db";
import { approval, auditLog, role, user } from "@/db/schema";
import { eq } from "drizzle-orm";

import { ActionResponse } from "@/lib/types/action-response";
import { getErrorMessage } from "@/lib/utils/error-message";

type FieldRequestTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function findOwnerUserIdTx(tx: FieldRequestTx): Promise<string> {
  const ownerRole = await tx.query.role.findFirst({
    where: eq(role.name, "owner"),
  });
  const ownerUser = ownerRole
    ? await tx.query.user.findFirst({ where: eq(user.roleId, ownerRole.id) })
    : null;

  if (!ownerUser) {
    throw new Error("OWNER_USER_NOT_FOUND");
  }

  return ownerUser.id;
}

export async function createProjectCostApprovalTx(
  tx: FieldRequestTx,
  args: {
    readonly projectCostId: string;
    readonly isOverrun: boolean;
    readonly label?: string;
  },
): Promise<void> {
  const approverId = await findOwnerUserIdTx(tx);
  const prefix = args.label ? `[Kategori: ${args.label}] ` : "";
  const notes = args.isOverrun
    ? `${prefix}Pengeluaran lapangan melebihi plafon anggaran${args.label ? "." : " (Budget Overrun)."}`
    : `${prefix}Nominal pengeluaran lapangan mencapai/melebihi Rp 5.000.000.`;

  await tx.insert(approval).values({
    approverId,
    referenceType: "project_cost",
    referenceId: args.projectCostId,
    status: "PENDING",
    notes,
    createdAt: new Date(),
  });
}

export async function upsertApprovalTx(
  tx: FieldRequestTx,
  args: {
    readonly approverId: string;
    readonly referenceType: "project_cost" | "vendor_payment";
    readonly referenceId: string;
    readonly status: "APPROVED" | "REJECTED";
    readonly notes?: string | null;
  },
): Promise<void> {
  const existing = await tx.query.approval.findFirst({
    where: (table, { and, eq }) =>
      and(
        eq(table.referenceType, args.referenceType),
        eq(table.referenceId, args.referenceId),
      ),
  });

  if (existing) {
    await tx
      .update(approval)
      .set({
        status: args.status,
        notes: args.notes || null,
      })
      .where(eq(approval.id, existing.id));
    return;
  }

  await tx.insert(approval).values({
    approverId: args.approverId,
    referenceType: args.referenceType,
    referenceId: args.referenceId,
    status: args.status,
    notes: args.notes || null,
    createdAt: new Date(),
  });
}

export async function writeFieldRequestAuditTx(
  tx: FieldRequestTx,
  args: {
    readonly userId: string;
    readonly action: string;
    readonly targetTable: string;
    readonly targetId: string;
    readonly originalState: object;
    readonly newState: object;
  },
): Promise<void> {
  await tx.insert(auditLog).values({
    userId: args.userId,
    action: args.action,
    targetTable: args.targetTable,
    targetId: args.targetId,
    originalState: JSON.stringify(args.originalState),
    newState: JSON.stringify(args.newState),
    createdAt: new Date(),
  });
}

export function mapSubmitFieldRequestError(
  error: unknown,
): ActionResponse<never> {
  const errMsg = getErrorMessage(error, "Gagal mencatat pengajuan biaya lapangan.");
  const isMissingSupport = errMsg === "BUDGET_ITEM_NOT_FOUND" || errMsg === "OWNER_USER_NOT_FOUND";

  return {
    success: false,
    error: {
      code: isMissingSupport ? "NOT_FOUND" : "TRANSACTION_FAILED",
      message: isMissingSupport ? "Data pendukung anggaran atau Owner tidak ditemukan." : errMsg,
    },
  };
}

export function mapVerifyFieldRequestError(
  error: unknown,
): ActionResponse<never> {
  const errMsg = getErrorMessage(error, "Gagal memverifikasi biaya proyek.");
  if (errMsg === "PROJECT_COST_NOT_FOUND") {
    return { success: false, error: { code: "NOT_FOUND", message: "Biaya proyek tidak ditemukan." } };
  }
  if (errMsg === "COST_NOT_IN_SUBMITTED_STATE") {
    return { success: false, error: { code: "FORBIDDEN", message: "Biaya proyek tidak berada dalam status SUBMITTED." } };
  }
  return { success: false, error: { code: "TRANSACTION_FAILED", message: errMsg } };
}

export function mapApproveFieldRequestError(
  error: unknown,
): ActionResponse<never> {
  const errMsg = getErrorMessage(error, "Gagal memproses persetujuan biaya proyek.");
  if (errMsg === "PROJECT_COST_NOT_FOUND") {
    return { success: false, error: { code: "NOT_FOUND", message: "Biaya proyek tidak ditemukan." } };
  }
  if (errMsg === "COST_NOT_IN_VERIFIED_STATE") {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Pengajuan biaya harus diverifikasi Finance Admin sebelum dapat disetujui Owner.",
      },
    };
  }
  return { success: false, error: { code: "TRANSACTION_FAILED", message: errMsg } };
}

export function mapPayFieldRequestError(
  error: unknown,
): ActionResponse<never> {
  const errMsg = getErrorMessage(error, "");
  if (
    errMsg === "PROJECT_COST_NOT_FOUND" ||
    errMsg === "BANK_ACCOUNT_NOT_FOUND" ||
    errMsg === "BUDGET_ITEM_NOT_FOUND"
  ) {
    return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Data record keuangan yang dibutuhkan untuk transaksi tidak ditemukan.",
      },
    };
  }
  if (errMsg === "INSUFFICIENT_FUNDS") {
    return {
      success: false,
      error: {
        code: "INSUFFICIENT_FUNDS",
        message: "Pencairan dibatalkan: Saldo akun bank kas kecil tidak mencukupi.",
      },
    };
  }
  if (errMsg === "COST_ALREADY_PAID") {
    return { success: false, error: { code: "FORBIDDEN", message: "Pengeluaran lapangan ini sudah dibayarkan sebelumnya." } };
  }
  if (errMsg === "COST_NOT_APPROVED") {
    return { success: false, error: { code: "FORBIDDEN", message: "Pengeluaran lapangan harus berstatus APPROVED sebelum dapat dicairkan." } };
  }
  if (errMsg === "APPROVAL_REQUIRED_BUT_PENDING") {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Pengeluaran lapangan memerlukan persetujuan Owner dan belum disetujui.",
      },
    };
  }
  return { success: false, error: { code: "TRANSACTION_FAILED", message: errMsg } };
}

export function mapApproveVendorPaymentError(
  error: unknown,
): ActionResponse<never> {
  const errMsg = getErrorMessage(error, "Gagal memproses persetujuan pembayaran vendor.");
  if (errMsg === "PAYMENT_RECORD_NOT_FOUND") {
    return { success: false, error: { code: "NOT_FOUND", message: "Record pembayaran vendor tidak ditemukan." } };
  }
  return { success: false, error: { code: "TRANSACTION_FAILED", message: errMsg } };
}
