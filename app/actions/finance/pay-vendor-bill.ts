"use server";

import { db } from "@/db";
import {
  vendorBill,
  vendorPayment,
  bankAccount,
  project,
  projectBudgetCategory,
  projectExpenses,
  auditLog,
  approval,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { assertPermission } from "@/lib/auth/permissions";
import { ActionResponse } from "@/lib/types/action-response";
import { payVendorBillSchema, PayVendorBillInput } from "@/lib/validations/finance";
import { getErrorMessage } from "@/lib/utils/error-message";
import { syncProjectBudgetCategory } from "@/lib/budget/budget-sync";
import { mutateBalance } from "@/lib/finance/balance-mutation";
import { assertProjectStatusIsOperational } from "@/lib/auth/scoping";

export async function payVendorBill(
  input: PayVendorBillInput,
): Promise<ActionResponse<{ paymentId: string; nextBalance: number }>> {
  const validation = payVendorBillSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Form pembayaran tidak lengkap." },
    };
  }

  const { vendorPaymentId, referenceNumber, bankAccountId } = validation.data;

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
      await assertPermission(session.user, "pay:vendor_bill");
    } catch (err) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: err instanceof Error ? err.message : "Akses ditolak.",
        },
      };
    }

    // Execute inside a database transaction block (Option A)
    const result = await db.transaction(async (tx) => {
      // 1. Fetch and Lock the vendor payment record
      const [payment] = await tx
        .select()
        .from(vendorPayment)
        .where(eq(vendorPayment.id, vendorPaymentId))
        .for("update");

      if (!payment) {
        throw new Error("PAYMENT_RECORD_NOT_FOUND");
      }

      if (payment.status !== "PENDING") {
        throw new Error(
          payment.status === "COMPLETED" ? "PAYMENT_ALREADY_COMPLETED" : "PAYMENT_NOT_PENDING",
        );
      }

      // 2. Fetch and lock the vendor bill so concurrent payments cannot overpay it.
      const [bill] = await tx
        .select()
        .from(vendorBill)
        .where(eq(vendorBill.id, payment.vendorBillId))
        .for("update");

      if (!bill) {
        throw new Error("VENDOR_BILL_NOT_FOUND");
      }

      const [billProject] = await tx
        .select({ status: project.status })
        .from(project)
        .where(eq(project.id, bill.projectId))
        .for("update");
      assertProjectStatusIsOperational(billProject?.status);

      // 3. Fetch the canonical budget category for overrun checks.
      const budgetCategory = await tx.query.projectBudgetCategory.findFirst({
        where: eq(projectBudgetCategory.id, bill.projectBudgetCategoryId),
      });

      if (!budgetCategory) {
        throw new Error("PROJECT_BUDGET_CATEGORY_NOT_FOUND");
      }

      // 4. Verify Approval status if payment amount >= 5M or causes budget overrun
      const paymentAmount = Number(payment.amountPaid);
      const completedPayments = await tx
        .select({ amountPaid: vendorPayment.amountPaid })
        .from(vendorPayment)
        .where(
          and(
            eq(vendorPayment.vendorBillId, payment.vendorBillId),
            eq(vendorPayment.status, "COMPLETED"),
          ),
        );
      const paidBefore = completedPayments.reduce((sum, row) => sum + Number(row.amountPaid), 0);
      if (paymentAmount > Number(bill.amount) - paidBefore + 0.001) {
        throw new Error("PAYMENT_EXCEEDS_VENDOR_BILL_OUTSTANDING");
      }
      const allocated = Number(budgetCategory.allocatedAmount);
      const spent = Number(budgetCategory.actualAmount);
      const isOverrun = spent > allocated;
      const requiresApproval = paymentAmount >= 5000000 || isOverrun;

      if (requiresApproval) {
        const appRecord = await tx.query.approval.findFirst({
          where: and(
            eq(approval.referenceType, "vendor_payment"),
            eq(approval.referenceId, payment.id),
          ),
        });

        if (!appRecord) {
          throw new Error("APPROVAL_RECORD_MISSING");
        }

        if (appRecord.status !== "APPROVED") {
          throw new Error("APPROVAL_REQUIRED_BUT_PENDING");
        }
      }

      const targetBankAccountId = bankAccountId || payment.bankAccountId;

      const accountBefore = await tx.query.bankAccount.findFirst({
        where: eq(bankAccount.id, targetBankAccountId),
      });
      if (!accountBefore) throw new Error("BANK_ACCOUNT_NOT_FOUND");
      const oldBalance = Number(accountBefore.balance);
      const ledgerTx = await mutateBalance({
        tx,
        bankAccountId: targetBankAccountId,
        type: "CREDIT",
        amount: paymentAmount.toFixed(2),
        category: "vendor_payment",
        description: `Bayar tagihan Vendor Bill #${bill.billNumber} (Ref: ${referenceNumber})`,
        referenceType: "vendor_payment",
        referenceId: payment.id,
        userId: session.user.id,
        transactionDate: payment.paymentDate,
      });
      const accountAfter = await tx.query.bankAccount.findFirst({
        where: eq(bankAccount.id, targetBankAccountId),
      });
      if (!accountAfter) throw new Error("BANK_ACCOUNT_NOT_FOUND");
      const newBalance = Number(accountAfter.balance);

      // 8. Update vendor payment details
      await tx
        .update(vendorPayment)
        .set({
          bankAccountId: targetBankAccountId,
          cashTransactionId: ledgerTx.id,
          status: "COMPLETED",
          referenceNumber,
          paymentDate: payment.paymentDate,
        })
        .where(eq(vendorPayment.id, vendorPaymentId));

      // 9. Update vendor bill status to PAID or PARTIALLY_PAID
      const totalPaidAmount = paidBefore + paymentAmount;

      const billAmount = Number(bill.amount);
      const nextBillStatus = totalPaidAmount >= billAmount ? "PAID" : "PARTIALLY_PAID";

      await tx
        .update(vendorBill)
        .set({
          status: nextBillStatus,
          updatedAt: new Date(),
        })
        .where(eq(vendorBill.id, payment.vendorBillId));

      await tx
        .update(projectExpenses)
        .set({
          paymentStatus: nextBillStatus === "PAID" ? "PAID" : "PARTIALLY_PAID",
          updatedAt: new Date(),
        })
        .where(eq(projectExpenses.vendorBillId, bill.id));

      await syncProjectBudgetCategory({
        tx,
        projectBudgetCategoryId: bill.projectBudgetCategoryId,
      });

      // 11. Write Audit Log
      await tx.insert(auditLog).values({
        userId: session.user.id,
        action: "PAY_VENDOR_BILL",
        targetTable: "vendor_payment",
        targetId: payment.id,
        originalState: JSON.stringify({
          balance: oldBalance.toFixed(2),
          paymentStatus: payment.status,
          billStatus: bill.status,
          canonicalCategoryActual: budgetCategory.actualAmount,
        }),
        newState: JSON.stringify({
          balance: newBalance.toFixed(2),
          paymentStatus: "COMPLETED",
          billStatus: nextBillStatus,
          canonicalCategoryActual: budgetCategory.actualAmount,
          cashTransactionId: ledgerTx.id,
        }),
        createdAt: new Date(),
      });

      return { paymentId: payment.id, nextBalance: newBalance };
    });

    return {
      success: true,
      data: result,
    };
  } catch (error: unknown) {
    const errMsg = getErrorMessage(error, "");
    let code: "NOT_FOUND" | "INSUFFICIENT_FUNDS" | "FORBIDDEN" | "TRANSACTION_FAILED" =
      "TRANSACTION_FAILED";
    let displayMessage = errMsg;

    if (
      errMsg === "PAYMENT_RECORD_NOT_FOUND" ||
      errMsg === "BANK_ACCOUNT_NOT_FOUND" ||
      errMsg === "VENDOR_BILL_NOT_FOUND" ||
      errMsg === "PROJECT_BUDGET_CATEGORY_NOT_FOUND"
    ) {
      code = "NOT_FOUND";
      displayMessage = "Data record keuangan yang dibutuhkan untuk transaksi tidak ditemukan.";
    } else if (errMsg.startsWith("INSUFFICIENT_FUNDS")) {
      code = "INSUFFICIENT_FUNDS";
      displayMessage = "Pencairan dibatalkan: Saldo akun bank perusahaan tidak mencukupi.";
    } else if (
      errMsg === "PAYMENT_ALREADY_COMPLETED" ||
      errMsg === "PAYMENT_NOT_PENDING" ||
      errMsg === "PAYMENT_EXCEEDS_VENDOR_BILL_OUTSTANDING" ||
      errMsg === "APPROVAL_REQUIRED_BUT_PENDING" ||
      errMsg === "APPROVAL_RECORD_MISSING"
    ) {
      code = "FORBIDDEN";
      displayMessage =
        errMsg === "PAYMENT_ALREADY_COMPLETED"
          ? "Pembayaran ini sudah diselesaikan sebelumnya."
          : errMsg === "PAYMENT_NOT_PENDING"
            ? "Pembayaran ini sudah ditolak atau tidak lagi menunggu pencairan."
            : errMsg === "PAYMENT_EXCEEDS_VENDOR_BILL_OUTSTANDING"
              ? "Nominal pembayaran melebihi sisa tagihan vendor."
              : "Pembayaran memerlukan persetujuan Owner dan belum disetujui.";
    }

    return {
      success: false,
      error: { code, message: displayMessage },
    };
  }
}
