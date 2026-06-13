import { db } from "@/db";
import { projectBudgetItem, vendorBill, projectCost, bankAccount, approval } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { submitVendorBill } from "@/app/actions/finance/submit-vendor-bill";
import { scheduleVendorBillPayment } from "@/app/actions/finance/schedule-vendor-bill";
import { payVendorBill } from "@/app/actions/finance/pay-vendor-bill";
import { submitFieldRequest, submitFieldRequests, verifyFieldRequest, approveFieldRequest, payFieldRequest, approveVendorPayment } from "@/app/actions/finance/field-requests";
import { describe, it, expect, afterAll, mock } from "bun:test";

// Mock next/headers untuk mencegah error cookies() di luar server Next.js
mock.module("next/headers", () => {
  return {
    cookies: () => {
      return {
        toString: () => "mocked-cookies",
      };
    },
  };
});

// Simpan method original
const originalGetSession = (auth.api as unknown as { getSession: unknown }).getSession;

// Helper untuk mock sesi pengguna
function mockUserSession(user: { id: string; roleId: string; email: string; name: string } | null) {
  const mockFn = async (): Promise<unknown> => {
    if (!user) return null;
    return {
      session: {
        id: "mock-session-id",
        userId: user.id,
        expiresAt: new Date(Date.now() + 3600 * 1000),
        token: "mock-token",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      user: {
        id: user.id,
        roleId: user.roleId,
        email: user.email,
        name: user.name,
        emailVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  };
  (auth.api as unknown as { getSession: unknown }).getSession = mockFn;
}

function restoreUserSession() {
  (auth.api as unknown as { getSession: unknown }).getSession = originalGetSession;
}

// Seed data constants (sesuai seed db)
const OWNER_USER = {
  id: "11111111-1111-1111-1111-111111111111",
  roleId: "00000000-0000-0000-0000-000000000001",
  email: "ronald@dekoria.com",
  name: "Ronald Wijaya",
};

const FINANCE_USER = {
  id: "22222222-2222-2222-2222-222222222222",
  roleId: "00000000-0000-0000-0000-000000000002",
  email: "lisa@dekoria.com",
  name: "Lisa Permata",
};

const PM_BUDI_USER = {
  id: "33333333-3333-3333-3333-333333333331",
  roleId: "00000000-0000-0000-0000-000000000003",
  email: "budi@dekoria.com",
  name: "Budi Santoso",
};

const MENTENG_PROJECT_ID = "77777777-7777-7777-7777-777777777771"; // PM Budi
const SUDIRMAN_PROJECT_ID = "77777777-7777-7777-7777-777777777772"; // PM Siti
const BCA_ACC_ID = "66666666-6666-6666-6666-666666666661";

describe("Atria ERP Server Actions - TSK-008 Accounts Payable & Field Claims", () => {
  afterAll(() => {
    restoreUserSession();
  });

  describe("Vendor Bill & Payment Flow", () => {
    it("harus menolak PM Budi mencatat tagihan vendor pada proyek Sudirman (milik PM Siti)", async () => {
      mockUserSession(PM_BUDI_USER);

      // Cari vendor dari database
      const vend = await db.query.vendor.findFirst();
      expect(vend).toBeDefined();

      const res = await submitVendorBill({
        vendorId: vend!.id,
        projectId: SUDIRMAN_PROJECT_ID,
        projectBudgetItemId: "88888888-8888-8888-8888-888888888881", // dummy budget item
        billNumber: `BILL-TEST-${Date.now()}`,
        amount: 3500000,
        dueDate: new Date(),
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("FORBIDDEN");
      }
    });

    it("harus menyetujui PM Budi mencatat tagihan vendor pada proyek Menteng (milik PM Budi)", async () => {
      mockUserSession(PM_BUDI_USER);

      const vend = await db.query.vendor.findFirst();
      // Cari budget item Menteng
      const budgetItem = await db.query.projectBudgetItem.findFirst({
        where: eq(projectBudgetItem.projectBudgetId, "88888888-8888-8888-8888-888888888881"),
      });

      expect(vend).toBeDefined();
      expect(budgetItem).toBeDefined();

      const res = await submitVendorBill({
        vendorId: vend!.id,
        projectId: MENTENG_PROJECT_ID,
        projectBudgetItemId: budgetItem!.id,
        billNumber: `BILL-OK-${Date.now()}`,
        amount: 2500000, // Rp 2.500.000 (di bawah limit 5M)
        dueDate: new Date(),
        notes: "Tagihan semen Tiga Roda",
      });

      expect(res.success).toBe(true);
    });

    it("harus mendeteksi nominal >= 5 juta dan membuat record approval PENDING secara otomatis", async () => {
      mockUserSession(FINANCE_USER);

      const vend = await db.query.vendor.findFirst();
      const budgetItem = await db.query.projectBudgetItem.findFirst({
        where: eq(projectBudgetItem.projectBudgetId, "88888888-8888-8888-8888-888888888881"),
      });

      // PM Budi mencatat tagihan besar terlebih dahulu
      mockUserSession(PM_BUDI_USER);
      const billRes = await submitVendorBill({
        vendorId: vend!.id,
        projectId: MENTENG_PROJECT_ID,
        projectBudgetItemId: budgetItem!.id,
        billNumber: `BILL-LARGE-${Date.now()}`,
        amount: 15000000, // Rp 15.000.000
        dueDate: new Date(),
      });

      expect(billRes.success).toBe(true);
      if (!billRes.success) return;

      // Finance Admin menjadwalkan pembayaran
      mockUserSession(FINANCE_USER);
      const scheduleRes = await scheduleVendorBillPayment({
        vendorBillId: billRes.data.id,
        bankAccountId: BCA_ACC_ID,
        paymentDate: new Date(),
        amountPaid: 15000000,
      });

      expect(scheduleRes.success).toBe(true);
      if (!scheduleRes.success) return;

      expect(scheduleRes.data.status).toBe("PENDING");

      // Verifikasi record approval disisipkan di database
      const appRecord = await db.query.approval.findFirst({
        where: and(
          eq(approval.referenceType, "vendor_payment"),
          eq(approval.referenceId, scheduleRes.data.id)
        ),
      });

      expect(appRecord).toBeDefined();
      expect(appRecord!.status).toBe("PENDING");
      expect(
        appRecord!.notes?.includes("Rp 5.000.000") || 
        appRecord!.notes?.includes("plafon") || 
        appRecord!.notes?.includes("Overrun")
      ).toBe(true);
    });

    it("harus menolak pembayaran vendor bill yang memerlukan persetujuan namun belum disetujui", async () => {
      mockUserSession(FINANCE_USER);

      const vend = await db.query.vendor.findFirst();
      const budgetItem = await db.query.projectBudgetItem.findFirst({
        where: eq(projectBudgetItem.projectBudgetId, "88888888-8888-8888-8888-888888888881"),
      });

      mockUserSession(PM_BUDI_USER);
      const billRes = await submitVendorBill({
        vendorId: vend!.id,
        projectId: MENTENG_PROJECT_ID,
        projectBudgetItemId: budgetItem!.id,
        billNumber: `BILL-WAIT-${Date.now()}`,
        amount: 6000000,
        dueDate: new Date(),
      });

      if (!billRes.success) return;

      mockUserSession(FINANCE_USER);
      const scheduleRes = await scheduleVendorBillPayment({
        vendorBillId: billRes.data.id,
        bankAccountId: BCA_ACC_ID,
        paymentDate: new Date(),
        amountPaid: 6000000,
      });

      if (!scheduleRes.success) return;

      // Coba bayar langsung (harus gagal karena status approval PENDING)
      const payRes = await payVendorBill({
        vendorPaymentId: scheduleRes.data.id,
        referenceNumber: "TRF-MOCK-FAIL",
      });

      expect(payRes.success).toBe(false);
      if (!payRes.success) {
        expect(payRes.error.code).toBe("FORBIDDEN");
      }
    });

    it("harus memproses pembayaran vendor bill setelah mendapatkan persetujuan Owner dan memotong kas bank", async () => {
      mockUserSession(FINANCE_USER);

      const vend = await db.query.vendor.findFirst();
      const budgetItem = await db.query.projectBudgetItem.findFirst({
        where: eq(projectBudgetItem.projectBudgetId, "88888888-8888-8888-8888-888888888881"),
      });

      mockUserSession(PM_BUDI_USER);
      const billRes = await submitVendorBill({
        vendorId: vend!.id,
        projectId: MENTENG_PROJECT_ID,
        projectBudgetItemId: budgetItem!.id,
        billNumber: `BILL-PASS-${Date.now()}`,
        amount: 8000000,
        dueDate: new Date(),
      });

      if (!billRes.success) return;

      mockUserSession(FINANCE_USER);
      const scheduleRes = await scheduleVendorBillPayment({
        vendorBillId: billRes.data.id,
        bankAccountId: BCA_ACC_ID,
        paymentDate: new Date(),
        amountPaid: 8000000,
      });

      if (!scheduleRes.success) return;

      // Saldo BCA awal
      const accBefore = await db.query.bankAccount.findFirst({
        where: eq(bankAccount.id, BCA_ACC_ID),
      });
      const balBefore = Number(accBefore?.balance || 0);

      // Owner menyetujui pembayaran
      mockUserSession(OWNER_USER);
      const approveRes = await approveVendorPayment(scheduleRes.data.id, "Disetujui Ronald");
      if (!approveRes.success) {
        console.log("DEBUG APPROVE VENDOR PAYMENT ERROR:", JSON.stringify(approveRes.error));
      }
      expect(approveRes.success).toBe(true);

      // Eksekusi pembayaran oleh Admin
      mockUserSession(FINANCE_USER);
      const payRes = await payVendorBill({
        vendorPaymentId: scheduleRes.data.id,
        referenceNumber: `TRF-OK-${Date.now()}`,
      });

      expect(payRes.success).toBe(true);
      if (payRes.success) {
        expect(payRes.data.nextBalance).toBe(balBefore - 8000000);
      }

      // Pastikan status bill terupdate menjadi PAID
      const paidBill = await db.query.vendorBill.findFirst({
        where: eq(vendorBill.id, billRes.data.id),
      });
      expect(paidBill!.status).toBe("PAID");
    });
  });

  describe("Field Claims (Project Cost) Flow", () => {
    it("harus menolak approval dan pencairan biaya lapangan yang belum melalui status wajib", async () => {
      const budgetItem = await db.query.projectBudgetItem.findFirst({
        where: eq(projectBudgetItem.projectBudgetId, "88888888-8888-8888-8888-888888888881"),
      });
      expect(budgetItem).toBeDefined();

      mockUserSession(PM_BUDI_USER);
      const costRes = await submitFieldRequest({
        projectId: MENTENG_PROJECT_ID,
        projectBudgetItemId: budgetItem!.id,
        amount: 6000000,
        description: "Beli perlengkapan finishing tambahan",
      });

      expect(costRes.success).toBe(true);
      if (!costRes.success) return;
      expect(costRes.data.status).toBe("SUBMITTED");

      mockUserSession(OWNER_USER);
      const approveSubmittedRes = await approveFieldRequest({
        projectCostId: costRes.data.id,
        status: "APPROVED",
        notes: "Coba approve sebelum verifikasi",
      });
      expect(approveSubmittedRes.success).toBe(false);
      if (!approveSubmittedRes.success) {
        expect(approveSubmittedRes.error.code).toBe("FORBIDDEN");
      }

      mockUserSession(FINANCE_USER);
      const paySubmittedRes = await payFieldRequest(costRes.data.id, BCA_ACC_ID, "TRF-SHOULD-FAIL-SUBMITTED");
      expect(paySubmittedRes.success).toBe(false);
      if (!paySubmittedRes.success) {
        expect(paySubmittedRes.error.code).toBe("FORBIDDEN");
      }

      const verifyRes = await verifyFieldRequest(costRes.data.id);
      expect(verifyRes.success).toBe(true);

      const payVerifiedRes = await payFieldRequest(costRes.data.id, BCA_ACC_ID, "TRF-SHOULD-FAIL-VERIFIED");
      expect(payVerifiedRes.success).toBe(false);
      if (!payVerifiedRes.success) {
        expect(payVerifiedRes.error.code).toBe("FORBIDDEN");
      }

      mockUserSession(OWNER_USER);
      const rejectRes = await approveFieldRequest({
        projectCostId: costRes.data.id,
        status: "REJECTED",
        notes: "Ditolak untuk test state machine",
      });
      expect(rejectRes.success).toBe(true);

      mockUserSession(FINANCE_USER);
      const payRejectedRes = await payFieldRequest(costRes.data.id, BCA_ACC_ID, "TRF-SHOULD-FAIL-REJECTED");
      expect(payRejectedRes.success).toBe(false);
      if (!payRejectedRes.success) {
        expect(payRejectedRes.error.code).toBe("FORBIDDEN");
      }
    });

    it("harus menyetujui pengajuan klaim lapangan PM Budi, memicu approval PENDING jika overrun, dan memproses pencairan kas kecil", async () => {
      // Reset BCA bank account balance to ensure sufficient funds
      await db.update(bankAccount)
        .set({ balance: "735000000.00" })
        .where(eq(bankAccount.id, BCA_ACC_ID));

      // 1. Cari budget item dengan sisa plafon kecil untuk memicu overrun
      const budgetItem = await db.query.projectBudgetItem.findFirst({
        where: eq(projectBudgetItem.projectBudgetId, "88888888-8888-8888-8888-888888888881"),
      });
      expect(budgetItem).toBeDefined();

      mockUserSession(PM_BUDI_USER);
      
      // Ajukan klaim melebihi plafon (sisa plafon di seed: Rp 150.000.000,00, kita ajukan Rp 160.000.000,00)
      const costRes = await submitFieldRequest({
        projectId: MENTENG_PROJECT_ID,
        projectBudgetItemId: budgetItem!.id,
        amount: 160000000,
        description: "Beli marmer Italia premium",
      });

      expect(costRes.success).toBe(true);
      if (!costRes.success) return;

      expect(costRes.data.budgetOverrun).toBe(true);
      expect(costRes.data.status).toBe("SUBMITTED");

      // Verifikasi record approval disisipkan
      const appRecord = await db.query.approval.findFirst({
        where: and(
          eq(approval.referenceType, "project_cost"),
          eq(approval.referenceId, costRes.data.id)
        ),
      });
      expect(appRecord).toBeDefined();
      expect(appRecord!.status).toBe("PENDING");

      // 2. Admin Lisa melakukan verifikasi
      mockUserSession(FINANCE_USER);
      const verifyRes = await verifyFieldRequest(costRes.data.id);
      expect(verifyRes.success).toBe(true);
      if (!verifyRes.success) return;
      expect(verifyRes.data.status).toBe("VERIFIED");

      // 3. Owner Ronald melakukan persetujuan
      mockUserSession(OWNER_USER);
      const approveRes = await approveFieldRequest({
        projectCostId: costRes.data.id,
        status: "APPROVED",
        notes: "Mewah, disetujui",
      });
      expect(approveRes.success).toBe(true);

      // Verifikasi status approval tersinkron
      const appRecordUpdated = await db.query.approval.findFirst({
        where: and(
          eq(approval.referenceType, "project_cost"),
          eq(approval.referenceId, costRes.data.id)
        ),
      });
      expect(appRecordUpdated!.status).toBe("APPROVED");

      // Saldo Bank BCA awal sebelum pembayaran
      const accBefore = await db.query.bankAccount.findFirst({
        where: eq(bankAccount.id, BCA_ACC_ID),
      });
      const balBefore = Number(accBefore?.balance || 0);

      // 4. Admin Lisa mencairkan dana
      mockUserSession(FINANCE_USER);
      const payRes = await payFieldRequest(costRes.data.id, BCA_ACC_ID, "TRF-CLAIM-MARMER");
      expect(payRes.success).toBe(true);
      if (payRes.success) {
        expect(payRes.data.nextBalance).toBe(balBefore - 160000000);
      }

      // Pastikan status projectCost berubah ke PAID
      const paidCost = await db.query.projectCost.findFirst({
        where: eq(projectCost.id, costRes.data.id),
      });
      expect(paidCost!.status).toBe("PAID");
      expect(paidCost!.cashTransactionId).toBeDefined();
    });

    it("harus mendukung pengajuan biaya lapangan multi-item (submitFieldRequests) dan mengelompokkannya dalam receiptGroupId", async () => {
      mockUserSession(PM_BUDI_USER);

      // Cari item anggaran untuk proyek Menteng
      const items = await db.query.projectBudgetItem.findMany({
        where: eq(projectBudgetItem.projectBudgetId, "88888888-8888-8888-8888-888888888881"),
      });
      expect(items.length).toBeGreaterThanOrEqual(2);

      const item1 = items[0];
      const item2 = items[1];

      const res = await submitFieldRequests({
        projectId: MENTENG_PROJECT_ID,
        receiptImageUrl: "https://ik.imagekit.io/dekoria/receipt-multi.jpg",
        items: [
          {
            projectBudgetItemId: item1.id,
            amount: 500000,
            description: "Belanja gypsum & paku besi"
          },
          {
            projectBudgetItemId: item2.id,
            amount: 750000,
            description: "Sewa tangga & transport belanja"
          }
        ]
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.length).toBe(2);
        const cost1 = res.data[0];
        const cost2 = res.data[1];

        // Pastikan keduanya memiliki receiptGroupId yang sama
        expect(cost1.receiptGroupId).toBeDefined();
        expect(cost1.receiptGroupId).toBe(cost2.receiptGroupId);
        expect(cost1.receiptImageUrl).toBe("https://ik.imagekit.io/dekoria/receipt-multi.jpg");
        expect(cost2.receiptImageUrl).toBe("https://ik.imagekit.io/dekoria/receipt-multi.jpg");
      }
    });
  });
});
