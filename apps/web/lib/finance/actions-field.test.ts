import { db } from "@/db";
import {
  projectBudgetItem,
  vendorBill,
  vendorPayment,
  projectCost,
  bankAccount,
  approval,
  materialInventory,
  stockMovement,
  projectExpenses,
  cashTransaction,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { submitVendorBill as submitVendorBillAction } from "@/app/actions/finance/submit-vendor-bill";
import { scheduleVendorBillPayment } from "@/app/actions/finance/schedule-vendor-bill";
import { payVendorBill } from "@/app/actions/finance/pay-vendor-bill";
import {
  submitFieldRequest as submitFieldRequestAction,
  submitFieldRequests as submitFieldRequestsAction,
  verifyFieldRequest,
  approveFieldRequest,
  payFieldRequest,
  approveVendorPayment,
} from "@/app/actions/finance/field-requests";
import { describe, it, expect, afterAll, mock } from "bun:test";
import { describeIntegration } from "@/lib/testing/integration-db";

/**
 * `submitVendorBill` and `submitFieldRequest(s)` post against real seeded
 * fixtures (BCA_ACC_ID, the small-cash accounts, MENTENG/SUDIRMAN projects),
 * not test-created ones, so nothing here can be cleaned up by deleting a
 * bank account the way `bank-accounts.test.ts` does. Every downstream row
 * (cash_transaction, vendor_payment, approval, stock_movement,
 * project_expenses) traces back to a vendor_bill.id or project_cost.id, so
 * wrapping the two creation calls and resolving the rest transitively in
 * `afterAll` cleans up every test in this file without touching each `it`
 * block's own logic. Without this, every suite run left permanent
 * unreconciled cash_transaction rows against the shared dev database — 120
 * had accumulated on BCA_ACC_ID alone by the time this was diagnosed.
 */
const createdVendorBillIds: string[] = [];
const createdProjectCostIds: string[] = [];

async function submitVendorBill(
  ...args: Parameters<typeof submitVendorBillAction>
): ReturnType<typeof submitVendorBillAction> {
  const result = await submitVendorBillAction(...args);
  if (result.success) createdVendorBillIds.push(result.data.id);
  return result;
}

async function submitFieldRequest(
  ...args: Parameters<typeof submitFieldRequestAction>
): ReturnType<typeof submitFieldRequestAction> {
  const result = await submitFieldRequestAction(...args);
  if (result.success) createdProjectCostIds.push(result.data.id);
  return result;
}

async function submitFieldRequests(
  ...args: Parameters<typeof submitFieldRequestsAction>
): ReturnType<typeof submitFieldRequestsAction> {
  const result = await submitFieldRequestsAction(...args);
  if (result.success) createdProjectCostIds.push(...result.data.map((cost) => cost.id));
  return result;
}

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
const MENTENG_TUKANG_CATEGORY_ID = "32323232-3232-3232-3232-323232323101";
const MENTENG_MATERIAL_CATEGORY_ID = "32323232-3232-3232-3232-323232323102";
const MENTENG_OPERASIONAL_CATEGORY_ID = "32323232-3232-3232-3232-323232323103";
const MENTENG_TUKANG_PLAN_ITEM_ID = "35353535-3535-3535-3535-353535353501";
const MATERIAL_PLYWOOD_ID = "13131313-1313-1313-1313-131313131301";
const WAREHOUSE_LOCATION_ID = "14141414-1414-1414-1414-141414141401";
const MENTENG_RAP_PLYWOOD_ITEM_ID = "17171717-1717-1717-1717-171717171701";

describeIntegration("Atria ERP Server Actions - TSK-008 Accounts Payable & Field Claims", () => {
  afterAll(async () => {
    restoreUserSession();

    const vendorBillIds = createdVendorBillIds;
    const projectCostIds = createdProjectCostIds;
    if (vendorBillIds.length === 0 && projectCostIds.length === 0) return;

    const payments = vendorBillIds.length
      ? await db.query.vendorPayment.findMany({
          where: inArray(vendorPayment.vendorBillId, vendorBillIds),
        })
      : [];
    const paymentIds = payments.map((payment) => payment.id);

    const costs = projectCostIds.length
      ? await db.query.projectCost.findMany({
          where: inArray(projectCost.id, projectCostIds),
        })
      : [];

    const cashTransactionIds = [
      ...new Set(
        [...payments, ...costs].flatMap((row) =>
          row.cashTransactionId ? [row.cashTransactionId] : [],
        ),
      ),
    ];

    // Anak-anak dulu, lalu induknya, mengikuti arah FK restrict:
    // stock_movement/project_expenses -> project_cost/vendor_bill -> cash_transaction.
    if (projectCostIds.length) {
      await db.delete(stockMovement).where(inArray(stockMovement.projectCostId, projectCostIds));
      await db
        .delete(projectExpenses)
        .where(inArray(projectExpenses.legacyProjectCostId, projectCostIds));
      await db
        .delete(approval)
        .where(
          and(
            eq(approval.referenceType, "project_cost"),
            inArray(approval.referenceId, projectCostIds),
          ),
        );
    }
    if (vendorBillIds.length) {
      await db.delete(projectExpenses).where(inArray(projectExpenses.vendorBillId, vendorBillIds));
    }
    if (paymentIds.length) {
      await db
        .delete(approval)
        .where(
          and(
            eq(approval.referenceType, "vendor_payment"),
            inArray(approval.referenceId, paymentIds),
          ),
        );
      await db.delete(vendorPayment).where(inArray(vendorPayment.id, paymentIds));
    }
    if (projectCostIds.length) {
      await db.delete(projectCost).where(inArray(projectCost.id, projectCostIds));
    }
    if (vendorBillIds.length) {
      await db.delete(vendorBill).where(inArray(vendorBill.id, vendorBillIds));
    }
    if (cashTransactionIds.length) {
      await db.delete(cashTransaction).where(inArray(cashTransaction.id, cashTransactionIds));
    }
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
        projectBudgetCategoryId: MENTENG_MATERIAL_CATEGORY_ID,
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
        projectBudgetCategoryId: MENTENG_MATERIAL_CATEGORY_ID,
        projectBudgetItemId: budgetItem!.id,
        billNumber: `BILL-OK-${Date.now()}`,
        amount: 2500000, // Rp 2.500.000 (di bawah limit 5M)
        dueDate: new Date(),
        notes: "Tagihan semen Tiga Roda",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        const inventoryAsset = await db.query.projectExpenses.findFirst({
          where: eq(projectExpenses.vendorBillId, res.data.id),
        });
        expect(inventoryAsset?.sourceType).toBe("INVENTORY_PURCHASE");
        expect(inventoryAsset?.status).toBe("INVENTORY_ASSET");
        expect(inventoryAsset?.amount).toBe("2500000.00");
      }
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
        projectBudgetCategoryId: MENTENG_MATERIAL_CATEGORY_ID,
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
          eq(approval.referenceId, scheduleRes.data.id),
        ),
      });

      expect(appRecord).toBeDefined();
      expect(appRecord!.status).toBe("PENDING");
      expect(
        appRecord!.notes?.includes("Rp 5.000.000") ||
          appRecord!.notes?.includes("plafon") ||
          appRecord!.notes?.includes("Overrun"),
      ).toBe(true);
    });

    it("harus menolak total jadwal pembayaran yang melebihi outstanding vendor bill", async () => {
      const vend = await db.query.vendor.findFirst();
      const budgetItem = await db.query.projectBudgetItem.findFirst({
        where: eq(projectBudgetItem.projectBudgetId, "88888888-8888-8888-8888-888888888881"),
      });
      expect(vend).toBeDefined();
      expect(budgetItem).toBeDefined();

      mockUserSession(PM_BUDI_USER);
      const billRes = await submitVendorBill({
        vendorId: vend!.id,
        projectId: MENTENG_PROJECT_ID,
        projectBudgetCategoryId: MENTENG_MATERIAL_CATEGORY_ID,
        projectBudgetItemId: budgetItem!.id,
        billNumber: `BILL-CAP-${Date.now()}`,
        amount: 4000000,
        dueDate: new Date(),
      });
      expect(billRes.success).toBe(true);
      if (!billRes.success) return;

      mockUserSession(FINANCE_USER);
      const first = await scheduleVendorBillPayment({
        vendorBillId: billRes.data.id,
        bankAccountId: BCA_ACC_ID,
        paymentDate: new Date(),
        amountPaid: 3000000,
      });
      expect(first.success).toBe(true);

      const exceeds = await scheduleVendorBillPayment({
        vendorBillId: billRes.data.id,
        bankAccountId: BCA_ACC_ID,
        paymentDate: new Date(),
        amountPaid: 1000001,
      });
      expect(exceeds.success).toBe(false);
      if (!exceeds.success) expect(exceeds.error.code).toBe("FORBIDDEN");
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
        projectBudgetCategoryId: MENTENG_MATERIAL_CATEGORY_ID,
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
        projectBudgetCategoryId: MENTENG_MATERIAL_CATEGORY_ID,
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
    it("harus menolak PM memverifikasi pengajuan biaya sendiri", async () => {
      mockUserSession(PM_BUDI_USER);
      const submitted = await submitFieldRequest({
        projectId: MENTENG_PROJECT_ID,
        projectBudgetCategoryId: MENTENG_OPERASIONAL_CATEGORY_ID,
        stockHandling: "EXPENSE_ONLY",
        quantity: 1,
        unitPrice: 250000,
        amount: 250000,
        description: "Biaya operasional untuk uji pemisahan tugas",
      });
      expect(submitted.success).toBe(true);
      if (!submitted.success) return;

      const verified = await verifyFieldRequest(submitted.data.id);
      expect(verified.success).toBe(false);
      if (!verified.success) expect(verified.error.code).toBe("FORBIDDEN");
    });
    it("harus menolak approval dan pencairan biaya lapangan yang belum melalui status wajib", async () => {
      const budgetItem = await db.query.projectBudgetItem.findFirst({
        where: eq(projectBudgetItem.projectBudgetId, "88888888-8888-8888-8888-888888888881"),
      });
      expect(budgetItem).toBeDefined();

      mockUserSession(PM_BUDI_USER);
      const costRes = await submitFieldRequest({
        projectId: MENTENG_PROJECT_ID,
        projectBudgetCategoryId: MENTENG_MATERIAL_CATEGORY_ID,
        projectBudgetItemId: budgetItem!.id,
        quantity: 24,
        unitPrice: 250000,
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
      const paySubmittedRes = await payFieldRequest(
        costRes.data.id,
        BCA_ACC_ID,
        "TRF-SHOULD-FAIL-SUBMITTED",
      );
      expect(paySubmittedRes.success).toBe(false);
      if (!paySubmittedRes.success) {
        expect(paySubmittedRes.error.code).toBe("FORBIDDEN");
      }

      const verifyRes = await verifyFieldRequest(costRes.data.id);
      expect(verifyRes.success).toBe(true);

      const payVerifiedRes = await payFieldRequest(
        costRes.data.id,
        BCA_ACC_ID,
        "TRF-SHOULD-FAIL-VERIFIED",
      );
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
      const payRejectedRes = await payFieldRequest(
        costRes.data.id,
        BCA_ACC_ID,
        "TRF-SHOULD-FAIL-REJECTED",
      );
      expect(payRejectedRes.success).toBe(false);
      if (!payRejectedRes.success) {
        expect(payRejectedRes.error.code).toBe("FORBIDDEN");
      }
    });

    it("harus menyetujui pengajuan klaim lapangan PM Budi, memicu approval PENDING jika overrun, dan memproses pencairan kas kecil", async () => {
      // Reset BCA bank account balance to ensure sufficient funds
      await db
        .update(bankAccount)
        .set({ balance: "735000000.00" })
        .where(eq(bankAccount.id, BCA_ACC_ID));

      // 1. Cari budget item dengan sisa plafon kecil untuk memicu overrun
      const budgetItem = await db.query.projectBudgetItem.findFirst({
        where: eq(projectBudgetItem.projectBudgetId, "88888888-8888-8888-8888-888888888881"),
      });
      expect(budgetItem).toBeDefined();

      mockUserSession(PM_BUDI_USER);

      // Ajukan klaim melebihi plafon category Material.
      const costRes = await submitFieldRequest({
        projectId: MENTENG_PROJECT_ID,
        projectBudgetCategoryId: MENTENG_MATERIAL_CATEGORY_ID,
        projectBudgetItemId: budgetItem!.id,
        quantity: 1040,
        unitPrice: 250000,
        amount: 260000000,
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
          eq(approval.referenceId, costRes.data.id),
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
          eq(approval.referenceId, costRes.data.id),
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
      const payRes = await payFieldRequest(
        costRes.data.id,
        BCA_ACC_ID,
        `TRF-CLAIM-MARMER-${Date.now()}`,
      );
      expect(payRes.success).toBe(true);
      if (payRes.success) {
        expect(payRes.data.nextBalance).toBe(balBefore - 260000000);
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
            projectBudgetCategoryId: MENTENG_MATERIAL_CATEGORY_ID,
            projectBudgetItemId: item1.id,
            quantity: 2,
            unitPrice: 250000,
            amount: 500000,
            description: "Belanja gypsum & paku besi",
          },
          {
            projectBudgetCategoryId: MENTENG_MATERIAL_CATEGORY_ID,
            projectBudgetItemId: item2.id,
            quantity: 1,
            unitPrice: 750000,
            amount: 750000,
            description: "Sewa tangga & transport belanja",
          },
        ],
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

    it("harus membuat record approval di tabel approval ketika pengeluaran baru terdeteksi overrun saat verifikasi", async () => {
      mockUserSession(PM_BUDI_USER);

      // 1. Submit pengeluaran A yang masih di dalam budget
      const resA = await submitFieldRequest({
        projectId: MENTENG_PROJECT_ID,
        projectBudgetCategoryId: MENTENG_OPERASIONAL_CATEGORY_ID,
        quantity: 1,
        unitPrice: 300000,
        amount: 300000,
        description: "Bensin operasional A",
      });
      expect(resA.success).toBe(true);
      if (!resA.success) return;

      // Pada saat diajukan, resA belum butuh approval dan belum ada record di tabel approval
      expect(resA.data.requiresOwnerApproval).toBe(false);
      expect(resA.data.budgetOverrun).toBe(false);

      const approvalBefore = await db.query.approval.findFirst({
        where: and(
          eq(approval.referenceType, "project_cost"),
          eq(approval.referenceId, resA.data.id),
        ),
      });
      expect(approvalBefore).toBeUndefined();

      // 2. Submit pengeluaran B yang mendorong kategori Operasional melebihi alokasinya
      const resB = await submitFieldRequest({
        projectId: MENTENG_PROJECT_ID,
        projectBudgetCategoryId: MENTENG_OPERASIONAL_CATEGORY_ID,
        quantity: 1,
        unitPrice: 50000000, // Nilai besar agar pasti over-budget
        amount: 50000000,
        description: "Operasional darurat B yang menyebabkan overrun",
      });
      expect(resB.success).toBe(true);

      // 3. Finance memverifikasi pengeluaran A
      mockUserSession(FINANCE_USER);
      const verifyRes = await verifyFieldRequest(resA.data.id);
      expect(verifyRes.success).toBe(true);
      if (!verifyRes.success) return;

      // Status pengeluaran A harus VERIFIED karena overrunNow = true
      expect(verifyRes.data.status).toBe("VERIFIED");
      expect(verifyRes.data.budgetOverrun).toBe(true);
      expect(verifyRes.data.requiresOwnerApproval).toBe(true);

      // Record approval HARUS otomatis terbuat di tabel approval dengan status PENDING
      const approvalAfter = await db.query.approval.findFirst({
        where: and(
          eq(approval.referenceType, "project_cost"),
          eq(approval.referenceId, resA.data.id),
        ),
      });
      expect(approvalAfter).toBeDefined();
      expect(approvalAfter!.status).toBe("PENDING");
    });

    it("harus mencatat material expense dengan stock in eksplisit dan menghubungkan stock movement", async () => {
      mockUserSession(PM_BUDI_USER);

      const inventoryBefore = await db.query.materialInventory.findFirst({
        where: and(
          eq(materialInventory.materialId, MATERIAL_PLYWOOD_ID),
          eq(materialInventory.locationId, WAREHOUSE_LOCATION_ID),
        ),
      });
      expect(inventoryBefore).toBeDefined();

      const res = await submitFieldRequest({
        projectId: MENTENG_PROJECT_ID,
        projectBudgetCategoryId: MENTENG_MATERIAL_CATEGORY_ID,
        materialId: MATERIAL_PLYWOOD_ID,
        projectRapItemId: MENTENG_RAP_PLYWOOD_ITEM_ID,
        inventoryLocationId: WAREHOUSE_LOCATION_ID,
        stockHandling: "STOCK_IN",
        quantity: 3,
        unitPrice: 250000,
        amount: 750000,
        description: "Pembelian multipleks untuk stock proyek Menteng",
      });

      expect(res.success).toBe(true);
      if (!res.success) return;

      const inventoryAfter = await db.query.materialInventory.findFirst({
        where: eq(materialInventory.id, inventoryBefore!.id),
      });
      expect(Number(inventoryAfter!.currentStock)).toBe(Number(inventoryBefore!.currentStock) + 3);

      const movement = await db.query.stockMovement.findFirst({
        where: and(
          eq(stockMovement.projectCostId, res.data.id),
          eq(stockMovement.movementType, "STOCK_IN"),
        ),
      });
      expect(movement).toBeDefined();
      expect(movement!.projectRapItemId).toBe(MENTENG_RAP_PLYWOOD_ITEM_ID);

      const canonicalExpense = await db.query.projectExpenses.findFirst({
        where: eq(projectExpenses.legacyProjectCostId, res.data.id),
      });
      expect(canonicalExpense?.stockMovementId).toBe(movement!.id);
    });

    it("harus menghubungkan expense Tukang ke Work Package canonical", async () => {
      mockUserSession(PM_BUDI_USER);

      const res = await submitFieldRequest({
        projectId: MENTENG_PROJECT_ID,
        projectBudgetCategoryId: MENTENG_TUKANG_CATEGORY_ID,
        projectCategoryPlanItemId: MENTENG_TUKANG_PLAN_ITEM_ID,
        quantity: 1,
        unitPrice: 1250000,
        amount: 1250000,
        description: "Termin tukang tambahan untuk kitchen installation crew",
      });

      expect(res.success).toBe(true);
      if (!res.success) return;

      const canonicalExpense = await db.query.projectExpenses.findFirst({
        where: eq(projectExpenses.legacyProjectCostId, res.data.id),
      });
      expect(canonicalExpense?.projectCategoryPlanItemId).toBe(MENTENG_TUKANG_PLAN_ITEM_ID);
    });

    it("harus menolak package Tukang dipakai untuk expense Operasional", async () => {
      mockUserSession(PM_BUDI_USER);

      const res = await submitFieldRequest({
        projectId: MENTENG_PROJECT_ID,
        projectBudgetCategoryId: MENTENG_OPERASIONAL_CATEGORY_ID,
        projectCategoryPlanItemId: MENTENG_TUKANG_PLAN_ITEM_ID,
        quantity: 1,
        unitPrice: 250000,
        amount: 250000,
        description: "Operasional tidak boleh link ke work package tukang",
      });

      expect(res.success).toBe(false);
    });
  });
});
