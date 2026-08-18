"use server";

import { db } from "@/db";
import {
  bankAccount,
  clientInvoice,
  clientPayment,
  vendorBill,
  vendorPayment,
  project,
} from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { assertPermission } from "@/lib/auth/permissions";
import { ActionResponse } from "@atria/core/types/action-response";

export interface DashboardStats {
  totalCashBalance: number;
  totalReceivables: number; // Piutang outstanding (Invoice minus payments)
  totalPayables: number; // Hutang outstanding (Bill minus payments)
  activeProjectsCount: number;
}

/**
 * Mengambil data ringkasan statistik keuangan (dasbor CFO).
 * Menghitung total kas riil, total piutang, total utang, dan proyek aktif.
 * Hanya dapat diakses oleh peran OWNER atau FINANCE_ADMIN.
 *
 * @returns Status respons aksi dan data DashboardStats
 */
export async function getDashboardStats(): Promise<ActionResponse<DashboardStats>> {
  try {
    // 1. Verifikasi Sesi
    const session = await auth.api.getSession({
      headers: {
        cookie: (await (await import("next/headers")).cookies()).toString(),
      },
    });

    if (!session || !session.user) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Harap login kembali." },
      };
    }

    // 2. Verifikasi Izin RBAC (Hanya peran yang diizinkan melihat profitabilitas global)
    try {
      await assertPermission(session.user, "view:profitability");
    } catch (err) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: err instanceof Error ? err.message : "Akses ditolak.",
        },
      };
    }

    // 3. Hitung total saldo kas riil dari semua bank_account
    const bankAccounts = await db.select({ balance: bankAccount.balance }).from(bankAccount);

    const totalCashBalance = bankAccounts.reduce((sum, acc) => sum + Number(acc.balance), 0);

    // 4. Hitung total piutang outstanding (invoice klien yang belum lunas / tidak void)
    const unpaidInvoices = await db
      .select({
        id: clientInvoice.id,
        amount: clientInvoice.amount,
        status: clientInvoice.status,
      })
      .from(clientInvoice)
      .where(and(ne(clientInvoice.status, "PAID"), ne(clientInvoice.status, "VOID")));

    let totalReceivables = 0;
    for (const inv of unpaidInvoices) {
      if (inv.status === "UNPAID") {
        totalReceivables += Number(inv.amount);
      } else if (inv.status === "PARTIALLY_PAID") {
        // Ambil riwayat pembayaran termin
        const payments = await db
          .select({ amountPaid: clientPayment.amountPaid })
          .from(clientPayment)
          .where(eq(clientPayment.clientInvoiceId, inv.id));

        const totalPaid = payments.reduce((sum, p) => sum + Number(p.amountPaid), 0);
        totalReceivables += Math.max(0, Number(inv.amount) - totalPaid);
      }
    }

    // 5. Hitung total utang outstanding (tagihan vendor yang belum lunas / tidak void)
    const unpaidBills = await db
      .select({
        id: vendorBill.id,
        amount: vendorBill.amount,
        status: vendorBill.status,
      })
      .from(vendorBill)
      .where(and(ne(vendorBill.status, "PAID"), ne(vendorBill.status, "VOID")));

    let totalPayables = 0;
    for (const bill of unpaidBills) {
      if (bill.status === "UNPAID") {
        totalPayables += Number(bill.amount);
      } else if (bill.status === "PARTIALLY_PAID") {
        // Ambil riwayat pembayaran vendor
        const payments = await db
          .select({ amountPaid: vendorPayment.amountPaid })
          .from(vendorPayment)
          .where(eq(vendorPayment.vendorBillId, bill.id));

        const totalPaid = payments.reduce((sum, p) => sum + Number(p.amountPaid), 0);
        totalPayables += Math.max(0, Number(bill.amount) - totalPaid);
      }
    }

    // 6. Hitung jumlah proyek aktif
    const activeProjects = await db
      .select({ id: project.id })
      .from(project)
      .where(eq(project.status, "ACTIVE"));

    return {
      success: true,
      data: {
        totalCashBalance,
        totalReceivables,
        totalPayables,
        activeProjectsCount: activeProjects.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan internal saat mengambil statistik.",
      },
    };
  }
}
