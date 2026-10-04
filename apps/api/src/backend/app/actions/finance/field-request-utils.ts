import { stockLinkValidationMessage } from "@backend/lib/material/stock-movement-links";
import { db } from "@backend/db";
import { approval, auditLog, role, user } from "@backend/db/schema";
import { eq } from "drizzle-orm";

import { ActionResponse } from "@atria/core/types/action-response";
import { getErrorMessage } from "@atria/core/utils/error-message";

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
  const notes = args.isOverrun
    ? `Pengeluaran lapangan melebihi plafon anggaran${args.label ? ` ${args.label}.` : " (Budget Overrun)."}`
    : "Nominal pengeluaran lapangan mencapai/melebihi Rp 5.000.000.";

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
      and(eq(table.referenceType, args.referenceType), eq(table.referenceId, args.referenceId)),
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

export function mapSubmitFieldRequestError(error: unknown): ActionResponse<never> {
  const errMsg = getErrorMessage(error, "Gagal mencatat pengajuan biaya lapangan.");
  const stockLinkMessage = stockLinkValidationMessage(errMsg);
  if (stockLinkMessage)
    return { success: false, error: { code: "VALIDATION_ERROR", message: stockLinkMessage } };
  const isMissingSupport = errMsg === "BUDGET_ITEM_NOT_FOUND" || errMsg === "OWNER_USER_NOT_FOUND";

  return {
    success: false,
    error: {
      code: isMissingSupport ? "NOT_FOUND" : "TRANSACTION_FAILED",
      message: isMissingSupport ? "Data pendukung anggaran atau Owner tidak ditemukan." : errMsg,
    },
  };
}

export function mapVerifyFieldRequestError(error: unknown): ActionResponse<never> {
  const errMsg = getErrorMessage(error, "Gagal memverifikasi biaya proyek.");
  if (errMsg === "PROJECT_COST_NOT_FOUND") {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Biaya proyek tidak ditemukan." },
    };
  }
  if (errMsg === "COST_NOT_IN_SUBMITTED_STATE") {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Biaya proyek tidak berada dalam status SUBMITTED." },
    };
  }
  return { success: false, error: { code: "TRANSACTION_FAILED", message: errMsg } };
}

export function mapApproveFieldRequestError(error: unknown): ActionResponse<never> {
  const errMsg = getErrorMessage(error, "Gagal memproses persetujuan biaya proyek.");
  if (errMsg === "PROJECT_COST_NOT_FOUND") {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Biaya proyek tidak ditemukan." },
    };
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
  if (errMsg === "MAKER_CHECKER_REQUIRED") {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message:
          "Pembuat transaksi tidak dapat menyetujui sendiri tanpa emergency override dan alasan audit.",
      },
    };
  }
  return { success: false, error: { code: "TRANSACTION_FAILED", message: errMsg } };
}

export function mapPayFieldRequestError(error: unknown): ActionResponse<never> {
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
        message: "Data keuangan yang dibutuhkan untuk transaksi tidak ditemukan.",
      },
    };
  }
  if (errMsg.startsWith("INSUFFICIENT_FUNDS")) {
    return {
      success: false,
      error: {
        code: "INSUFFICIENT_FUNDS",
        message: "Pencairan dibatalkan: Saldo akun bank kas kecil tidak mencukupi.",
      },
    };
  }
  if (errMsg === "COST_ALREADY_PAID") {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Pengeluaran lapangan ini sudah dibayarkan sebelumnya.",
      },
    };
  }
  if (errMsg === "COST_NOT_APPROVED") {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Pengeluaran lapangan harus berstatus APPROVED sebelum dapat dicairkan.",
      },
    };
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
  if (errMsg === "DUPLICATE_BANK_REFERENCE") {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Referensi mutasi bank sudah tercatat pada rekening ini.",
      },
    };
  }
  return { success: false, error: { code: "TRANSACTION_FAILED", message: errMsg } };
}

export function mapApproveVendorPaymentError(error: unknown): ActionResponse<never> {
  const errMsg = getErrorMessage(error, "Gagal memproses persetujuan pembayaran vendor.");
  if (errMsg === "PAYMENT_RECORD_NOT_FOUND") {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Data pembayaran vendor tidak ditemukan." },
    };
  }
  if (errMsg === "MAKER_CHECKER_REQUIRED") {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message:
          "Pembuat jadwal pembayaran tidak dapat menyetujui sendiri tanpa emergency override dan alasan audit.",
      },
    };
  }
  return { success: false, error: { code: "TRANSACTION_FAILED", message: errMsg } };
}
