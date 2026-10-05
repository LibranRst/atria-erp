import { withTestRequest } from "@backend/lib/testing/request";
import { db } from "@backend/db";
import {
  project,
  clientInvoice,
  clientPayment,
  cashTransaction,
  bankAccount,
  projectBudget,
} from "@backend/db/schema";
import { eq, inArray } from "drizzle-orm";
import { auth } from "@backend/lib/auth";
import { createProjectBudget, createBudgetItem } from "@backend/app/actions/project/budget";
import { recordClientPayment } from "@backend/app/actions/finance/record-client-payment";
import { createClientInvoice } from "@backend/app/actions/finance/create-client-invoice";
import { getInvoicePrefillContext } from "@backend/app/actions/finance/get-invoice-prefill-context";
import { getDashboardStats } from "@backend/app/actions/finance/get-dashboard-stats";
import { describe, it, expect, afterAll } from "bun:test";
import { describeIntegration } from "@backend/lib/testing/integration-db";

// Cache Next adalah boundary request, bukan bagian pengujian posting finansial.

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

// Seed data constants
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
const MATERIAL_CATEGORY_ID = "99999999-9999-9999-9999-999999999991";
const BCA_ACC_ID = "66666666-6666-6666-6666-666666666661";

describeIntegration("Atria ERP Server Actions - TSK-007", () => {
  afterAll(
    withTestRequest(() => {
      restoreUserSession();
    }),
  );

  // 1. Uji Coba Server Actions Rencana Anggaran (Project Budget)
  describe("Project Budget Actions", () => {
    it(
      "harus menolak PM Budi membuat anggaran di proyek Sudirman (milik PM Siti)",
      withTestRequest(async () => {
        mockUserSession(PM_BUDI_USER);
        const res = await createProjectBudget(SUDIRMAN_PROJECT_ID);
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error.code).toBe("FORBIDDEN");
        }
      }),
    );

    it(
      "harus menolak pembuatan anggaran duplikat pada satu proyek",
      withTestRequest(async () => {
        mockUserSession(OWNER_USER);
        // Proyek Menteng sudah punya budget ID: 88888888-8888-8888-8888-888888888881 (APPROVED) di seed
        const res = await createProjectBudget(MENTENG_PROJECT_ID);
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error.code).toBe("FORBIDDEN");
        }
      }),
    );

    it(
      "harus menolak penambahan item anggaran pada budget berstatus APPROVED",
      withTestRequest(async () => {
        mockUserSession(PM_BUDI_USER);
        const APPROVED_BUDGET_ID = "88888888-8888-8888-8888-888888888881";
        const res = await createBudgetItem({
          projectBudgetId: APPROVED_BUDGET_ID,
          costCategoryId: MATERIAL_CATEGORY_ID,
          name: "Cat Tembok Jotun",
          budgetCategory: "Pekerjaan Cat Tembok",
          quantity: 10,
          unit: "can",
          unitPrice: 1200000,
        });

        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error.code).toBe("FORBIDDEN");
          expect(res.error.message).toContain("berbasis kategori");
        }
      }),
    );

    it(
      "harus menutup jalur pembuatan budget legacy tanpa meninggalkan data parsial",
      withTestRequest(async () => {
        mockUserSession(OWNER_USER);

        // Buat proyek baru untuk test budget lifecycle
        const [testProj] = await db
          .insert(project)
          .values({
            name: "Test Project Budget Lifecycle",
            clientId: "44444444-4444-4444-4444-444444444441",
            projectManagerId: PM_BUDI_USER.id,
            status: "DRAFT",
            financialHealth: "HEALTHY",
            totalContractValue: "300000000.00",
          })
          .returning();

        mockUserSession(PM_BUDI_USER);
        const budgetRes = await createProjectBudget(testProj.id);
        expect(budgetRes.success).toBe(false);
        if (!budgetRes.success) {
          expect(budgetRes.error.code).toBe("FORBIDDEN");
          expect(budgetRes.error.message).toContain("berbasis kategori");
        }
        const persistedLegacyBudget = await db.query.projectBudget.findFirst({
          where: eq(projectBudget.projectId, testProj.id),
        });
        expect(persistedLegacyBudget).toBeUndefined();

        await db.delete(project).where(eq(project.id, testProj.id));
      }),
    );
  });

  // 2. Uji Coba Server Action recordClientPayment
  describe("recordClientPayment Action", () => {
    // Setiap pembayaran mendebit BCA_ACC_ID (rekening seed asli, bukan buatan
    // test) dan mencatat cash_transaction yang tidak pernah direkonsiliasi.
    // Tanpa cleanup ini, setiap kali file ini dijalankan akan meninggalkan
    // client_invoice + client_payment + cash_transaction permanen di database
    // dev bersama — 62 baris cash_transaction unreconciled sudah terkumpul
    // dari proses ini sebelum diperbaiki.
    const createdInvoiceIds: string[] = [];

    afterAll(
      withTestRequest(async () => {
        if (createdInvoiceIds.length === 0) return;
        const payments = await db.query.clientPayment.findMany({
          where: inArray(clientPayment.clientInvoiceId, createdInvoiceIds),
        });
        const cashTransactionIds = payments.map((payment) => payment.cashTransactionId);
        await db
          .delete(clientPayment)
          .where(inArray(clientPayment.clientInvoiceId, createdInvoiceIds));
        await db.delete(clientInvoice).where(inArray(clientInvoice.id, createdInvoiceIds));
        if (cashTransactionIds.length) {
          await db.delete(cashTransaction).where(inArray(cashTransaction.id, cashTransactionIds));
        }
      }),
    );

    it(
      "harus memotong piutang, memperbarui status invoice, dan mendebit bank account",
      withTestRequest(async () => {
        mockUserSession(FINANCE_USER);

        // Siapkan invoice uji
        const [testInvoice] = await db
          .insert(clientInvoice)
          .values({
            projectId: MENTENG_PROJECT_ID,
            invoiceNumber: `INV/TEST/${Date.now()}`,
            amount: "50000000.00", // Rp 50.000.000,00
            status: "UNPAID",
            stage: "PROGRESS_1",
            dueDate: new Date(),
          })
          .returning();
        createdInvoiceIds.push(testInvoice!.id);

        // Baca saldo awal rekening BCA
        const accountBefore = await db.query.bankAccount.findFirst({
          where: eq(bankAccount.id, BCA_ACC_ID),
        });
        const balanceBefore = Number(accountBefore?.balance || 0);

        // Catat Pembayaran Pertama (Sebagian / Partial) senilai Rp 20.000.000,00
        const partialRes = await recordClientPayment({
          clientInvoiceId: testInvoice.id,
          bankAccountId: BCA_ACC_ID,
          amountPaid: 20000000,
          paymentDate: new Date(),
          referenceNumber: `TRF-TEST-PARTIAL-${Date.now()}`,
        });

        expect(partialRes).toMatchObject({ success: true });
        if (partialRes.success) {
          expect(partialRes.data.newBalance).toBe((balanceBefore + 20000000).toFixed(2));
        }

        // Verifikasi status invoice harus menjadi PARTIALLY_PAID
        const partialInvoice = await db.query.clientInvoice.findFirst({
          where: eq(clientInvoice.id, testInvoice.id),
        });
        expect(partialInvoice!.status).toBe("PARTIALLY_PAID");

        const overpaymentRes = await recordClientPayment({
          clientInvoiceId: testInvoice.id,
          bankAccountId: BCA_ACC_ID,
          amountPaid: 30000001,
          paymentDate: new Date(),
          referenceNumber: "TRF-TEST-OVERPAY",
        });
        expect(overpaymentRes.success).toBe(false);
        if (!overpaymentRes.success) {
          expect(overpaymentRes.error.code).toBe("VALIDATION_ERROR");
        }

        // Catat Pembayaran Kedua (Pelunasan sisa) senilai Rp 30.000.000,00
        const finalRes = await recordClientPayment({
          clientInvoiceId: testInvoice.id,
          bankAccountId: BCA_ACC_ID,
          amountPaid: 30000000,
          paymentDate: new Date(),
          referenceNumber: `TRF-TEST-FINAL-${Date.now()}`,
        });

        expect(finalRes).toMatchObject({ success: true });
        if (finalRes.success) {
          expect(finalRes.data.newBalance).toBe((balanceBefore + 50000000).toFixed(2));
        }

        // Verifikasi status invoice harus menjadi PAID (Lunas)
        const finalInvoice = await db.query.clientInvoice.findFirst({
          where: eq(clientInvoice.id, testInvoice.id),
        });
        expect(finalInvoice!.status).toBe("PAID");
      }),
    );
  });

  // createClientInvoice Action and Auto-Generation on Budget Approval
  describe("createClientInvoice Action and Auto-Generation", () => {
    afterAll(
      withTestRequest(() => {
        restoreUserSession();
      }),
    );

    it(
      "harus menolak pembuatan invoice manual oleh PM (karena PM tidak memiliki izin)",
      withTestRequest(async () => {
        mockUserSession(PM_BUDI_USER);
        const res = await createClientInvoice({
          projectId: MENTENG_PROJECT_ID,
          invoiceNumber: "INV-PM-TEST",
          amount: 50000000,
          stage: "AD_HOC",
          dueDate: new Date(),
          notes: "Test manual PM",
        });

        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error.code).toBe("FORBIDDEN");
        }
      }),
    );

    it(
      "harus mengizinkan Owner membuat invoice secara manual dan menulis audit log",
      withTestRequest(async () => {
        mockUserSession(OWNER_USER);
        const [invoiceProject] = await db
          .insert(project)
          .values({
            name: "Test Manual Invoice Project",
            clientId: "44444444-4444-4444-4444-444444444441",
            projectManagerId: PM_BUDI_USER.id,
            status: "ACTIVE",
            totalContractValue: "100000000.00",
          })
          .returning();
        const invoiceNum = `INV/TEST/${Math.floor(1000 + Math.random() * 9000)}`;
        const res = await createClientInvoice({
          projectId: invoiceProject.id,
          invoiceNumber: invoiceNum,
          amount: 25000000,
          stage: "AD_HOC",
          dueDate: new Date(),
          notes: "Test manual Owner",
        });

        expect(res).toMatchObject({ success: true });
        if (res.success) {
          expect(res.data.invoiceNumber).toBe(invoiceNum);
          expect(res.data.status).toBe("UNPAID");
          expect(res.data.stage).toBe("AD_HOC");

          // Clean up
          await db.delete(clientInvoice).where(eq(clientInvoice.id, res.data.id));
        }
        await db.delete(project).where(eq(project.id, invoiceProject.id));
      }),
    );

    it(
      "harus menolak total invoice aktif yang melebihi nilai kontrak",
      withTestRequest(async () => {
        mockUserSession(OWNER_USER);
        const res = await createClientInvoice({
          projectId: MENTENG_PROJECT_ID,
          invoiceNumber: `INV/CAP/${Math.floor(1000 + Math.random() * 9000)}`,
          amount: 999999999,
          stage: "AD_HOC",
          dueDate: new Date(),
          notes: "Test preventive contract cap",
        });
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error.code).toBe("VALIDATION_ERROR");
          expect(res.error.message).toContain("Change Order");
        }
      }),
    );

    it(
      "tidak menerbitkan invoice melalui jalur persetujuan budget legacy",
      withTestRequest(async () => {
        mockUserSession(PM_BUDI_USER);

        // 1. Buat project test baru (dengan totalContractValue 300jt)
        const [newProj] = await db
          .insert(project)
          .values({
            name: "Test Auto Invoice Project",
            clientId: "44444444-4444-4444-4444-444444444441",
            projectManagerId: PM_BUDI_USER.id,
            status: "DRAFT",
            totalContractValue: "300000000.00",
          })
          .returning();

        const budgetRes = await createProjectBudget(newProj.id);
        expect(budgetRes.success).toBe(false);
        if (!budgetRes.success) {
          expect(budgetRes.error.message).toContain("berbasis kategori");
        }

        const invoices = await db.query.clientInvoice.findMany({
          where: eq(clientInvoice.projectId, newProj.id),
        });

        expect(invoices).toHaveLength(0);

        await db.delete(project).where(eq(project.id, newProj.id));
      }),
    );

    it(
      "harus menghasilkan prefill context invoice dengan nomor kanonis dan tahap DP untuk Owner",
      withTestRequest(async () => {
        mockUserSession(OWNER_USER);
        const [testProj] = await db
          .insert(project)
          .values({
            name: "Fit-Out Interior Bassura Studio",
            clientId: "44444444-4444-4444-4444-444444444441",
            projectManagerId: PM_BUDI_USER.id,
            status: "ACTIVE",
            totalContractValue: "50000000.00",
          })
          .returning();

        const res = await getInvoicePrefillContext({ projectId: testProj.id });
        expect(res).toMatchObject({ success: true });
        if (res.success) {
          expect(res.data.projectCode).toBe("BSR");
          expect(res.data.suggestedInvoiceNumber).toContain("INV/");
          expect(res.data.suggestedInvoiceNumber).toContain("BSR-001");
          expect(res.data.suggestedStage).toBe("DP");
          expect(res.data.suggestedAmount).toBe(25000000);
          expect(res.data.remainingUnbilled).toBe(50000000);
        }

        await db.delete(project).where(eq(project.id, testProj.id));
      }),
    );
  });

  // 3. Uji Coba Server Action getDashboardStats
  describe("getDashboardStats Action", () => {
    it(
      "harus mengembalikan statistik agregasi finansial dasbor secara tepat",
      withTestRequest(async () => {
        mockUserSession(FINANCE_USER);

        const res = await getDashboardStats();
        expect(res).toMatchObject({ success: true });

        if (res.success) {
          const stats = res.data;
          expect(stats.totalCashBalance).toBeGreaterThan(0);
          expect(stats.totalReceivables).toBeGreaterThanOrEqual(0);
          expect(stats.totalPayables).toBeGreaterThanOrEqual(0);
          expect(stats.activeProjectsCount).toBeGreaterThanOrEqual(3); // Menteng, Sudirman, & Brawijaya di seed
        }
      }),
    );

    it(
      "harus menolak PM Budi mengakses statistik dasbor global",
      withTestRequest(async () => {
        mockUserSession(PM_BUDI_USER);

        const res = await getDashboardStats();
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error.code).toBe("FORBIDDEN");
        }
      }),
    );
  });
});
