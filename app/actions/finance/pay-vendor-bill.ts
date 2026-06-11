"use server";

import { db } from "@/db";
import { vendorBill, vendorPayment, bankAccount, cashTransaction, projectBudgetItem, auditLog, approval } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { assertPermission } from "@/lib/auth/permissions";
import { ActionResponse } from "@/lib/types/action-response";
import { payVendorBillSchema, PayVendorBillInput } from "@/lib/validations/finance";

export async function payVendorBill(
  input: PayVendorBillInput
): Promise<ActionResponse<{ paymentId: string; nextBalance: number }>> {
  const validation = payVendorBillSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Form pembayaran tidak lengkap." },
    };
  }

  const { vendorPaymentId, referenceNumber } = validation.data;

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
      return { success: false, error: { code: "FORBIDDEN", message: err instanceof Error ? err.message : "Akses ditolak." } };
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

      if (payment.status === "COMPLETED") {
        throw new Error("PAYMENT_ALREADY_COMPLETED");
      }

      // 2. Fetch the vendor bill
      const bill = await tx.query.vendorBill.findFirst({
        where: eq(vendorBill.id, payment.vendorBillId),
      });

      if (!bill) {
        throw new Error("VENDOR_BILL_NOT_FOUND");
      }

      // 3. Fetch the budget item
      const budgetItem = await tx.query.projectBudgetItem.findFirst({
        where: eq(projectBudgetItem.id, bill.projectBudgetItemId),
      });

      if (!budgetItem) {
        throw new Error("BUDGET_ITEM_NOT_FOUND");
      }

      // 4. Verify Approval status if payment amount >= 5M or causes budget overrun
      const paymentAmount = Number(payment.amountPaid);
      const allocated = Number(budgetItem.allocatedAmount);
      const spent = Number(budgetItem.actualSpent);
      const isOverrun = (spent + paymentAmount) > allocated;
      const requiresApproval = paymentAmount >= 5000000 || isOverrun;

      if (requiresApproval) {
        const appRecord = await tx.query.approval.findFirst({
          where: and(
            eq(approval.referenceType, "vendor_payment"),
            eq(approval.referenceId, payment.id)
          ),
        });

        if (!appRecord) {
          throw new Error("APPROVAL_RECORD_MISSING");
        }

        if (appRecord.status !== "APPROVED") {
          throw new Error("APPROVAL_REQUIRED_BUT_PENDING");
        }
      }

      // 5. Fetch and Lock the bank account
      const [account] = await tx
        .select()
        .from(bankAccount)
        .where(eq(bankAccount.id, payment.bankAccountId))
        .for("update");

      if (!account) {
        throw new Error("BANK_ACCOUNT_NOT_FOUND");
      }

      const oldBalance = Number(account.balance);

      if (oldBalance < paymentAmount) {
        throw new Error("INSUFFICIENT_FUNDS");
      }

      const newBalance = oldBalance - paymentAmount;

      // 6. Update bank account balance
      const updatedRows = await tx
        .update(bankAccount)
        .set({
          balance: newBalance.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(bankAccount.id, payment.bankAccountId))
        .returning();

      if (updatedRows.length !== 1) {
        throw new Error("BALANCE_UPDATE_MISMATCH");
      }

      // 7. Write to ledger (cash_transaction - CREDIT)
      const [ledgerTx] = await tx
        .insert(cashTransaction)
        .values({
          bankAccountId: payment.bankAccountId,
          type: "CREDIT",
          category: "vendor_payment",
          amount: paymentAmount.toFixed(2),
          description: `Bayar tagihan Vendor Bill #${bill.billNumber} (Ref: ${referenceNumber})`,
          reconciled: true,
          reconciliationDate: new Date(),
          reconciledById: session.user.id,
          referenceType: "vendor_payment",
          referenceId: payment.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // 8. Update vendor payment details
      await tx
        .update(vendorPayment)
        .set({
          cashTransactionId: ledgerTx.id,
          status: "COMPLETED",
          referenceNumber,
          paymentDate: new Date(),
        })
        .where(eq(vendorPayment.id, vendorPaymentId));

      // 9. Update vendor bill status to PAID or PARTIALLY_PAID
      const completedPayments = await tx
        .select({ amountPaid: vendorPayment.amountPaid })
        .from(vendorPayment)
        .where(
          and(
            eq(vendorPayment.vendorBillId, payment.vendorBillId),
            eq(vendorPayment.status, "COMPLETED")
          )
        );

      const totalPaidAmount = completedPayments.reduce(
        (sum, p) => sum + Number(p.amountPaid),
        0
      ) + paymentAmount;

      const billAmount = Number(bill.amount);
      const nextBillStatus = totalPaidAmount >= billAmount ? "PAID" : "PARTIALLY_PAID";

      await tx
        .update(vendorBill)
        .set({
          status: nextBillStatus,
          updatedAt: new Date(),
        })
        .where(eq(vendorBill.id, payment.vendorBillId));

      // 10. Accumulate project budget item actual spent
      const nextActualSpent = spent + paymentAmount;

      await tx
        .update(projectBudgetItem)
        .set({
          actualSpent: nextActualSpent.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(projectBudgetItem.id, bill.projectBudgetItemId));

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
          actualSpent: spent.toFixed(2),
        }),
        newState: JSON.stringify({
          balance: newBalance.toFixed(2),
          paymentStatus: "COMPLETED",
          billStatus: nextBillStatus,
          actualSpent: nextActualSpent.toFixed(2),
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
  } catch (error: any) {
    const errMsg = error.message || "";
    let code: "NOT_FOUND" | "INSUFFICIENT_FUNDS" | "FORBIDDEN" | "TRANSACTION_FAILED" = "TRANSACTION_FAILED";
    let displayMessage = errMsg;

    if (
      errMsg === "PAYMENT_RECORD_NOT_FOUND" ||
      errMsg === "BANK_ACCOUNT_NOT_FOUND" ||
      errMsg === "VENDOR_BILL_NOT_FOUND" ||
      errMsg === "BUDGET_ITEM_NOT_FOUND"
    ) {
      code = "NOT_FOUND";
      displayMessage = "Data record keuangan yang dibutuhkan untuk transaksi tidak ditemukan.";
    } else if (errMsg === "INSUFFICIENT_FUNDS") {
      code = "INSUFFICIENT_FUNDS";
      displayMessage = "Pencairan dibatalkan: Saldo akun bank perusahaan tidak mencukupi.";
    } else if (errMsg === "PAYMENT_ALREADY_COMPLETED" || errMsg === "APPROVAL_REQUIRED_BUT_PENDING" || errMsg === "APPROVAL_RECORD_MISSING") {
      code = "FORBIDDEN";
      displayMessage = errMsg === "PAYMENT_ALREADY_COMPLETED"
        ? "Pembayaran ini sudah diselesaikan sebelumnya."
        : "Pembayaran memerlukan persetujuan Owner dan belum disetujui.";
    }

    return {
      success: false,
      error: { code, message: displayMessage },
    };
  }
}
