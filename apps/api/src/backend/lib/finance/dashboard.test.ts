import { withTestRequest } from "@backend/lib/testing/request";
import { db } from "@backend/db";
import { auth } from "@backend/lib/auth";
import {
  approval,
  bankAccount,
  cashTransaction,
  projectCost,
  vendorPayment,
} from "@backend/db/schema";
import { eq, and, asc, count, inArray } from "drizzle-orm";
import {
  approveFieldRequest,
  approveVendorPayment,
} from "@backend/app/actions/finance/field-requests";
import { getDashboardStats } from "@backend/app/actions/finance/get-dashboard-stats";
import { describe, it, expect, afterAll } from "bun:test";
import { describeIntegration } from "@backend/lib/testing/integration-db";

// Simpan method original
const originalGetSession = (auth.api as unknown as { getSession: unknown }).getSession;

// Helper untuk mock sesi pengguna
function mockUserSession(
  user: { id: string; roleId: string; email: string; name: string } | null,
): void {
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

function restoreUserSession(): void {
  (auth.api as unknown as { getSession: unknown }).getSession = originalGetSession;
}

const OWNER_USER = {
  id: "11111111-1111-1111-1111-111111111111",
  roleId: "00000000-0000-0000-0000-000000000001",
  email: "ronald@dekoria.com",
  name: "Ronald Wijaya",
};

const PM_BUDI_USER = {
  id: "33333333-3333-3333-3333-333333333331",
  roleId: "00000000-0000-0000-0000-000000000003",
  email: "budi@dekoria.com",
  name: "Budi Santoso",
};

describeIntegration("Atria ERP CFO Dashboard & Owner Approvals - TSK-012", () => {
  afterAll(
    withTestRequest(() => {
      restoreUserSession();
    }),
  );

  describe("CFO Dashboard Stats Access", () => {
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

    it(
      "harus mengizinkan Owner mengakses statistik dasbor global",
      withTestRequest(async () => {
        mockUserSession(OWNER_USER);
        const res = await getDashboardStats();
        expect(res.success).toBe(true);
        if (res.success) {
          expect(res.data.activeProjectsCount).toBeDefined();
          expect(res.data.totalCashBalance).toBeDefined();
        }
      }),
    );
  });

  describe("Owner Approvals Actions", () => {
    it(
      "harus menyetujui dan menolak pengajuan pengeluaran lapangan polymorphically",
      withTestRequest(async () => {
        // Cari cost dari seed untuk test
        const cost = await db.query.projectCost.findFirst({
          where: eq(projectCost.status, "SUBMITTED"),
        });

        if (!cost) return;

        await db.update(projectCost).set({ status: "VERIFIED" }).where(eq(projectCost.id, cost.id));

        // 1. Owner menyetujui pengajuan
        mockUserSession(OWNER_USER);
        const resApprove = await approveFieldRequest({
          projectCostId: cost.id,
          status: "APPROVED",
          notes: "Mewah disetujui",
        });

        expect(resApprove.success).toBe(true);

        const appRecord = await db.query.approval.findFirst({
          where: and(eq(approval.referenceType, "project_cost"), eq(approval.referenceId, cost.id)),
        });
        expect(appRecord!.status).toBe("APPROVED");

        // Kembalikan status ke SUBMITTED untuk konsistensi DB jika dibutuhkan
        await db
          .update(projectCost)
          .set({ status: "SUBMITTED" })
          .where(eq(projectCost.id, cost.id));
        await db.update(approval).set({ status: "PENDING" }).where(eq(approval.id, appRecord!.id));
      }),
    );

    it(
      "harus mendukung persetujuan dan penolakan pembayaran vendor polymorphically",
      withTestRequest(async () => {
        const source = await db.query.vendorPayment.findFirst({
          where: eq(vendorPayment.status, "PENDING"),
        });
        if (!source) throw new Error("Seed pembayaran vendor tertunda tidak tersedia.");
        const balancesBefore = await db
          .select({ id: bankAccount.id, balance: bankAccount.balance })
          .from(bankAccount)
          .orderBy(asc(bankAccount.id));
        const [cashBefore] = await db.select({ count: count() }).from(cashTransaction);
        // Separate undecided schedules exercise each branch. A finalized
        // approval is immutable and must not be reused as a rejection fixture.
        const schedules = await db
          .insert(vendorPayment)
          .values([
            {
              vendorBillId: source.vendorBillId,
              bankAccountId: source.bankAccountId,
              amountPaid: "1.00",
              paymentDate: source.paymentDate,
              paidById: "22222222-2222-2222-2222-222222222222",
              requiresOwnerApproval: true,
              status: "PENDING",
            },
            {
              vendorBillId: source.vendorBillId,
              bankAccountId: source.bankAccountId,
              amountPaid: "1.00",
              paymentDate: source.paymentDate,
              paidById: "22222222-2222-2222-2222-222222222222",
              requiresOwnerApproval: true,
              status: "PENDING",
            },
            {
              vendorBillId: source.vendorBillId,
              bankAccountId: source.bankAccountId,
              amountPaid: "1.00",
              paymentDate: source.paymentDate,
              paidById: OWNER_USER.id,
              requiresOwnerApproval: true,
              status: "PENDING",
            },
          ])
          .returning();
        const [approveSchedule, rejectSchedule, selfSchedule] = schedules;
        if (!approveSchedule || !rejectSchedule || !selfSchedule)
          throw new Error("Jadwal fixture tidak lengkap.");
        mockUserSession(OWNER_USER);
        try {
          const resApprove = await approveVendorPayment(
            approveSchedule.id,
            "Valid disetujui Owner",
          );
          expect(resApprove.success).toBe(true);
          const approved = await db.query.approval.findFirst({
            where: and(
              eq(approval.referenceType, "vendor_payment"),
              eq(approval.referenceId, approveSchedule.id),
            ),
          });
          if (!approved) throw new Error("Keputusan persetujuan fixture tidak tercatat.");
          expect(approved.status).toBe("APPROVED");
          const resReject = await approveVendorPayment(
            rejectSchedule.id,
            "Ditolak karena tidak sesuai",
            "REJECTED",
          );
          expect(resReject.success).toBe(true);
          const rejected = await db.query.approval.findFirst({
            where: and(
              eq(approval.referenceType, "vendor_payment"),
              eq(approval.referenceId, rejectSchedule.id),
            ),
          });
          expect(rejected?.status).toBe("REJECTED");
          const afterReject = await db.query.vendorPayment.findFirst({
            where: eq(vendorPayment.id, rejectSchedule.id),
          });
          expect(afterReject?.status).toBe("FAILED");
          expect(afterReject?.cashTransactionId).toBeNull();

          const rewriteFinal = await approveVendorPayment(
            approveSchedule.id,
            "Tidak boleh mengubah keputusan selesai",
            "REJECTED",
          );
          expect(rewriteFinal).toMatchObject({ success: false, error: { code: "FORBIDDEN" } });
          expect(
            (await db.query.approval.findFirst({ where: eq(approval.id, approved.id) }))?.status,
          ).toBe("APPROVED");
          const selfApprove = await approveVendorPayment(
            selfSchedule.id,
            "Pembuat jadwal mencoba menyetujui sendiri",
          );
          expect(selfApprove).toMatchObject({ success: false, error: { code: "FORBIDDEN" } });
          expect(
            (
              await db.query.vendorPayment.findFirst({
                where: eq(vendorPayment.id, selfSchedule.id),
              })
            )?.status,
          ).toBe("PENDING");

          expect(
            await db
              .select({ id: bankAccount.id, balance: bankAccount.balance })
              .from(bankAccount)
              .orderBy(asc(bankAccount.id)),
          ).toEqual(balancesBefore);
          expect((await db.select({ count: count() }).from(cashTransaction))[0]?.count).toBe(
            cashBefore?.count,
          );
          expect(
            await db.query.vendorPayment.findFirst({ where: eq(vendorPayment.id, source.id) }),
          ).toEqual(source);
        } finally {
          const ids = schedules.map((payment) => payment.id);
          await db
            .delete(approval)
            .where(
              and(eq(approval.referenceType, "vendor_payment"), inArray(approval.referenceId, ids)),
            );
          await db.delete(vendorPayment).where(inArray(vendorPayment.id, ids));
        }
      }),
    );
  });
});
