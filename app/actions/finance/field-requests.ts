"use server";

import { db } from "@/db";
import { projectCost, bankAccount, cashTransaction, projectBudgetItem, auditLog, approval, user, vendorPayment } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { assertPermission, resolveRoleName } from "@/lib/auth/permissions";
import { assertProjectAccess } from "@/lib/auth/scoping";
import { ActionResponse } from "@/lib/types/action-response";
import { submitFieldRequestSchema, ApproveFieldRequestInput, approveFieldRequestSchema, SubmitFieldRequestInput } from "@/lib/validations/finance";
import crypto from "crypto";

/**
 * PM mengajukan biaya pengeluaran lapangan baru (Project Cost / Field Claim).
 */
export async function submitFieldRequest(
  input: SubmitFieldRequestInput
): Promise<ActionResponse<typeof projectCost.$inferSelect>> {
  const validation = submitFieldRequestSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Parameter pengajuan biaya lapangan tidak valid." },
    };
  }

  const { projectId, projectBudgetItemId, amount, description, receiptImageUrl } = validation.data;

  try {
    const session = await auth.api.getSession({
      headers: {
        cookie: (await (await import("next/headers")).cookies()).toString(),
      },
    });

    if (!session || !session.user) {
      return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
    }

    try {
      await assertPermission(session.user, "create:cost");
    } catch (err) {
      return { success: false, error: { code: "FORBIDDEN", message: err instanceof Error ? err.message : "Akses ditolak." } };
    }

    // PM scoping check
    try {
      const userRoleName = await resolveRoleName(session.user.roleId);
      await assertProjectAccess(projectId, session.user.id, userRoleName);
    } catch (err) {
      return { success: false, error: { code: "FORBIDDEN", message: err instanceof Error ? err.message : "Akses ditolak." } };
    }

    const result = await db.transaction(async (tx) => {
      // 1. Fetch budget item to check overrun
      const budgetItem = await tx.query.projectBudgetItem.findFirst({
        where: eq(projectBudgetItem.id, projectBudgetItemId),
      });

      if (!budgetItem) {
        throw new Error("BUDGET_ITEM_NOT_FOUND");
      }

      const allocated = Number(budgetItem.allocatedAmount);
      const spent = Number(budgetItem.actualSpent);
      const isOverrun = (spent + amount) > allocated;
      const requiresApproval = amount >= 5000000 || isOverrun;

      const projectCostId = crypto.randomUUID();

      // 2. If requires Owner approval, insert approval record
      if (requiresApproval) {
        const ownerUser = await tx.query.user.findFirst({
          where: eq(user.roleId, "00000000-0000-0000-0000-000000000001"), // OWNER role UUID
        });

        if (!ownerUser) {
          throw new Error("OWNER_USER_NOT_FOUND");
        }

        const notes = isOverrun 
          ? "Pengeluaran lapangan melebihi plafon anggaran (Budget Overrun)." 
          : "Nominal pengeluaran lapangan mencapai/melebihi Rp 5.000.000.";

        await tx.insert(approval).values({
          approverId: ownerUser.id,
          referenceType: "project_cost",
          referenceId: projectCostId,
          status: "PENDING",
          notes,
          createdAt: new Date(),
        });
      }

      // 3. Insert project_cost record
      const [cost] = await tx
        .insert(projectCost)
        .values({
          id: projectCostId,
          projectId,
          projectBudgetItemId,
          requestedById: session.user.id,
          amount: amount.toFixed(2),
          description,
          receiptImageUrl: receiptImageUrl || null,
          status: "SUBMITTED",
          budgetOverrun: isOverrun,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return cost;
    });

    return {
      success: true,
      data: result,
    };
  } catch (error: any) {
    let errorCode: "NOT_FOUND" | "TRANSACTION_FAILED" | "INTERNAL_SERVER_ERROR" = "INTERNAL_SERVER_ERROR";
    let displayMessage = error.message;

    if (error.message === "BUDGET_ITEM_NOT_FOUND" || error.message === "OWNER_USER_NOT_FOUND") {
      errorCode = "NOT_FOUND";
      displayMessage = "Data pendukung anggaran atau Owner tidak ditemukan.";
    } else {
      errorCode = "TRANSACTION_FAILED";
      displayMessage = error.message || "Gagal mencatat pengajuan biaya lapangan.";
    }

    return {
      success: false,
      error: { code: errorCode, message: displayMessage },
    };
  }
}

/**
 * Admin atau PM Senior memverifikasi biaya lapangan (dari SUBMITTED ke VERIFIED).
 */
export async function verifyFieldRequest(
  projectCostId: string
): Promise<ActionResponse<typeof projectCost.$inferSelect>> {
  try {
    const session = await auth.api.getSession({
      headers: {
        cookie: (await (await import("next/headers")).cookies()).toString(),
      },
    });

    if (!session || !session.user) {
      return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
    }

    try {
      await assertPermission(session.user, "update:cost");
    } catch (err) {
      return { success: false, error: { code: "FORBIDDEN", message: err instanceof Error ? err.message : "Akses ditolak." } };
    }

    const result = await db.transaction(async (tx) => {
      const cost = await tx.query.projectCost.findFirst({
        where: eq(projectCost.id, projectCostId),
      });

      if (!cost) {
        throw new Error("PROJECT_COST_NOT_FOUND");
      }

      if (cost.status !== "SUBMITTED") {
        throw new Error("COST_NOT_IN_SUBMITTED_STATE");
      }

      const [updatedCost] = await tx
        .update(projectCost)
        .set({
          status: "VERIFIED",
          verifiedById: session.user.id,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(projectCost.id, projectCostId))
        .returning();

      // Write to audit log
      await tx.insert(auditLog).values({
        userId: session.user.id,
        action: "VERIFY_FIELD_REQUEST",
        targetTable: "project_cost",
        targetId: projectCostId,
        originalState: JSON.stringify({ status: cost.status }),
        newState: JSON.stringify({ status: "VERIFIED" }),
        createdAt: new Date(),
      });

      return updatedCost;
    });

    return {
      success: true,
      data: result,
    };
  } catch (error: any) {
    let errorCode: "NOT_FOUND" | "FORBIDDEN" | "TRANSACTION_FAILED" = "TRANSACTION_FAILED";
    let displayMessage = error.message;

    if (error.message === "PROJECT_COST_NOT_FOUND") {
      errorCode = "NOT_FOUND";
      displayMessage = "Biaya proyek tidak ditemukan.";
    } else if (error.message === "COST_NOT_IN_SUBMITTED_STATE") {
      errorCode = "FORBIDDEN";
      displayMessage = "Biaya proyek tidak berada dalam status SUBMITTED.";
    }

    return {
      success: false,
      error: { code: errorCode, message: displayMessage },
    };
  }
}

/**
 * Owner menyetujui atau menolak pengajuan pengeluaran lapangan.
 */
export async function approveFieldRequest(
  input: ApproveFieldRequestInput
): Promise<ActionResponse<typeof projectCost.$inferSelect>> {
  const validation = approveFieldRequestSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Parameter persetujuan tidak valid." },
    };
  }

  const { projectCostId, status, notes } = validation.data;

  try {
    const session = await auth.api.getSession({
      headers: {
        cookie: (await (await import("next/headers")).cookies()).toString(),
      },
    });

    if (!session || !session.user) {
      return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
    }

    try {
      await assertPermission(session.user, "approve:cost");
    } catch (err) {
      return { success: false, error: { code: "FORBIDDEN", message: err instanceof Error ? err.message : "Akses ditolak." } };
    }

    const result = await db.transaction(async (tx) => {
      const cost = await tx.query.projectCost.findFirst({
        where: eq(projectCost.id, projectCostId),
      });

      if (!cost) {
        throw new Error("PROJECT_COST_NOT_FOUND");
      }

      // Sync status in the approval table if one exists
      const appRecord = await tx.query.approval.findFirst({
        where: and(
          eq(approval.referenceType, "project_cost"),
          eq(approval.referenceId, projectCostId)
        ),
      });

      if (appRecord) {
        await tx
          .update(approval)
          .set({
            status,
            notes: notes || null,
          })
          .where(eq(approval.id, appRecord.id));
      } else {
        // If there was no approval record (e.g. amount < 5M and no overrun) but Owner decides to approve/reject anyway
        await tx.insert(approval).values({
          approverId: session.user.id,
          referenceType: "project_cost",
          referenceId: projectCostId,
          status,
          notes: notes || null,
          createdAt: new Date(),
        });
      }

      const [updatedCost] = await tx
        .update(projectCost)
        .set({
          status,
          approvedById: session.user.id,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(projectCost.id, projectCostId))
        .returning();

      // Write to audit log
      await tx.insert(auditLog).values({
        userId: session.user.id,
        action: status === "APPROVED" ? "APPROVE_FIELD_REQUEST" : "REJECT_FIELD_REQUEST",
        targetTable: "project_cost",
        targetId: projectCostId,
        originalState: JSON.stringify({ status: cost.status }),
        newState: JSON.stringify({ status }),
        createdAt: new Date(),
      });

      return updatedCost;
    });

    return {
      success: true,
      data: result,
    };
  } catch (error: any) {
    let errorCode: "NOT_FOUND" | "TRANSACTION_FAILED" = "TRANSACTION_FAILED";
    let displayMessage = error.message;

    if (error.message === "PROJECT_COST_NOT_FOUND") {
      errorCode = "NOT_FOUND";
      displayMessage = "Biaya proyek tidak ditemukan.";
    }

    return {
      success: false,
      error: { code: errorCode, message: displayMessage },
    };
  }
}

/**
 * Finance Admin atau Owner melakukan pelunasan biaya lapangan dari kas kecil (Petty Cash).
 */
export async function payFieldRequest(
  projectCostId: string,
  bankAccountId: string,
  referenceNumber: string
): Promise<ActionResponse<{ costId: string; nextBalance: number }>> {
  try {
    const session = await auth.api.getSession({
      headers: {
        cookie: (await (await import("next/headers")).cookies()).toString(),
      },
    });

    if (!session || !session.user) {
      return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
    }

    try {
      await assertPermission(session.user, "pay:cost");
    } catch (err) {
      return { success: false, error: { code: "FORBIDDEN", message: err instanceof Error ? err.message : "Akses ditolak." } };
    }

    const result = await db.transaction(async (tx) => {
      // 1. Fetch and Lock projectCost row
      const [cost] = await tx
        .select()
        .from(projectCost)
        .where(eq(projectCost.id, projectCostId))
        .for("update");

      if (!cost) {
        throw new Error("PROJECT_COST_NOT_FOUND");
      }

      if (cost.status === "PAID") {
        throw new Error("COST_ALREADY_PAID");
      }

      const amount = Number(cost.amount);
      const requiresApproval = amount >= 5000000 || cost.budgetOverrun;

      // 2. Verify approval status if required
      if (requiresApproval) {
        const appRecord = await tx.query.approval.findFirst({
          where: and(
            eq(approval.referenceType, "project_cost"),
            eq(approval.referenceId, projectCostId)
          ),
        });

        if (!appRecord || appRecord.status !== "APPROVED") {
          throw new Error("APPROVAL_REQUIRED_BUT_PENDING");
        }
      }

      // 3. Fetch and Lock bankAccount row
      const [account] = await tx
        .select()
        .from(bankAccount)
        .where(eq(bankAccount.id, bankAccountId))
        .for("update");

      if (!account) {
        throw new Error("BANK_ACCOUNT_NOT_FOUND");
      }

      const oldBalance = Number(account.balance);
      if (oldBalance < amount) {
        throw new Error("INSUFFICIENT_FUNDS");
      }

      const newBalance = oldBalance - amount;

      // 4. Update bank account balance
      const updatedRows = await tx
        .update(bankAccount)
        .set({
          balance: newBalance.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(bankAccount.id, bankAccountId))
        .returning();

      if (updatedRows.length !== 1) {
        throw new Error("BALANCE_UPDATE_MISMATCH");
      }

      // 5. Write to ledger (cash_transaction - CREDIT)
      const [ledgerTx] = await tx
        .insert(cashTransaction)
        .values({
          bankAccountId,
          type: "CREDIT",
          category: "field_claim",
          amount: amount.toFixed(2),
          description: `Realisasi biaya lapangan: ${cost.description} (Ref: ${referenceNumber})`,
          reconciled: true,
          reconciliationDate: new Date(),
          reconciledById: session.user.id,
          referenceType: "project_cost",
          referenceId: cost.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // 6. Update projectCost status
      await tx
        .update(projectCost)
        .set({
          status: "PAID",
          bankAccountId,
          cashTransactionId: ledgerTx.id,
          paidById: session.user.id,
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(projectCost.id, projectCostId));

      // 7. Update budget item actualSpent
      const budgetItem = await tx.query.projectBudgetItem.findFirst({
        where: eq(projectBudgetItem.id, cost.projectBudgetItemId),
      });

      if (!budgetItem) {
        throw new Error("BUDGET_ITEM_NOT_FOUND");
      }

      const currentSpent = Number(budgetItem.actualSpent);
      const nextSpent = currentSpent + amount;

      await tx
        .update(projectBudgetItem)
        .set({
          actualSpent: nextSpent.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(projectBudgetItem.id, cost.projectBudgetItemId));

      // 8. Write audit log
      await tx.insert(auditLog).values({
        userId: session.user.id,
        action: "PAY_FIELD_REQUEST",
        targetTable: "project_cost",
        targetId: projectCostId,
        originalState: JSON.stringify({
          balance: oldBalance.toFixed(2),
          costStatus: cost.status,
          actualSpent: currentSpent.toFixed(2),
        }),
        newState: JSON.stringify({
          balance: newBalance.toFixed(2),
          costStatus: "PAID",
          actualSpent: nextSpent.toFixed(2),
          cashTransactionId: ledgerTx.id,
        }),
        createdAt: new Date(),
      });

      return { costId: cost.id, nextBalance: newBalance };
    });

    return {
      success: true,
      data: result,
    };
  } catch (error: any) {
    const errMsg = error.message || "";
    let code: "NOT_FOUND" | "INSUFFICIENT_FUNDS" | "FORBIDDEN" | "TRANSACTION_FAILED" = "TRANSACTION_FAILED";
    let displayMessage = errMsg;

    if (
      errMsg === "PROJECT_COST_NOT_FOUND" ||
      errMsg === "BANK_ACCOUNT_NOT_FOUND" ||
      errMsg === "BUDGET_ITEM_NOT_FOUND"
    ) {
      code = "NOT_FOUND";
      displayMessage = "Data record keuangan yang dibutuhkan untuk transaksi tidak ditemukan.";
    } else if (errMsg === "INSUFFICIENT_FUNDS") {
      code = "INSUFFICIENT_FUNDS";
      displayMessage = "Pencairan dibatalkan: Saldo akun bank kas kecil tidak mencukupi.";
    } else if (errMsg === "COST_ALREADY_PAID" || errMsg === "APPROVAL_REQUIRED_BUT_PENDING") {
      code = "FORBIDDEN";
      displayMessage = errMsg === "COST_ALREADY_PAID"
        ? "Pengeluaran lapangan ini sudah dibayarkan sebelumnya."
        : "Pengeluaran lapangan memerlukan persetujuan Owner dan belum disetujui.";
    }

    return {
      success: false,
      error: { code, message: displayMessage },
    };
  }
}

/**
 * Owner menyetujui atau menolak permohonan pembayaran vendor yang dipending.
 */
export async function approveVendorPayment(
  vendorPaymentId: string,
  notes?: string,
  status: "APPROVED" | "REJECTED" = "APPROVED"
): Promise<ActionResponse<{ paymentId: string; status: string }>> {
  try {
    const session = await auth.api.getSession({
      headers: {
        cookie: (await (await import("next/headers")).cookies()).toString(),
      },
    });

    if (!session || !session.user) {
      return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
    }

    const userRoleName = await resolveRoleName(session.user.roleId);
    if (userRoleName !== "OWNER") {
      return { success: false, error: { code: "FORBIDDEN", message: "Hanya Owner yang dapat menyetujui/menolak pembayaran vendor." } };
    }

    const result = await db.transaction(async (tx) => {
      const payment = await tx.query.vendorPayment.findFirst({
        where: eq(vendorPayment.id, vendorPaymentId),
      });

      if (!payment) {
        throw new Error("PAYMENT_RECORD_NOT_FOUND");
      }

      const appRecord = await tx.query.approval.findFirst({
        where: and(
          eq(approval.referenceType, "vendor_payment"),
          eq(approval.referenceId, vendorPaymentId)
        ),
      });

      if (appRecord) {
        await tx
          .update(approval)
          .set({
            status,
            notes: notes || null,
          })
          .where(eq(approval.id, appRecord.id));
      } else {
        // If there was no approval record but Owner decides to approve/reject it explicitly
        await tx.insert(approval).values({
          approverId: session.user.id,
          referenceType: "vendor_payment",
          referenceId: vendorPaymentId,
          status,
          notes: notes || null,
          createdAt: new Date(),
        });
      }

      // Update vendor_payment status if rejected
      if (status === "REJECTED") {
        await tx
          .update(vendorPayment)
          .set({
            status: "FAILED",
            referenceNumber: notes || "Ditolak oleh Owner",
            paymentDate: new Date(),
          })
          .where(eq(vendorPayment.id, vendorPaymentId));
      }

      // Write audit log
      await tx.insert(auditLog).values({
        userId: session.user.id,
        action: status === "APPROVED" ? "APPROVE_VENDOR_PAYMENT" : "REJECT_VENDOR_PAYMENT",
        targetTable: "vendor_payment",
        targetId: vendorPaymentId,
        originalState: JSON.stringify({ paymentStatus: payment.status }),
        newState: JSON.stringify({ paymentStatus: payment.status, approved: status === "APPROVED", status }),
        createdAt: new Date(),
      });

      return { paymentId: vendorPaymentId, status };
    });

    return {
      success: true,
      data: result,
    };
  } catch (error: any) {
    let errorCode: "NOT_FOUND" | "TRANSACTION_FAILED" = "TRANSACTION_FAILED";
    let displayMessage = error.message;

    if (error.message === "PAYMENT_RECORD_NOT_FOUND") {
      errorCode = "NOT_FOUND";
      displayMessage = "Record pembayaran vendor tidak ditemukan.";
    }

    return {
      success: false,
      error: { code: errorCode, message: displayMessage },
    };
  }
}
