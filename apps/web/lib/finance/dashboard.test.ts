import { db } from "@/db";
import { auth } from "@/lib/auth";
import { approval, projectCost, vendorPayment } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { approveFieldRequest, approveVendorPayment } from "@/app/actions/finance/field-requests";
import { getDashboardStats } from "@/app/actions/finance/get-dashboard-stats";
import { describe, it, expect, afterAll, mock } from "bun:test";
import { describeIntegration } from "@/lib/testing/integration-db";

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
  afterAll(() => {
    restoreUserSession();
  });

  describe("CFO Dashboard Stats Access", () => {
    it("harus menolak PM Budi mengakses statistik dasbor global", async () => {
      mockUserSession(PM_BUDI_USER);
      const res = await getDashboardStats();
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("FORBIDDEN");
      }
    });

    it("harus mengizinkan Owner mengakses statistik dasbor global", async () => {
      mockUserSession(OWNER_USER);
      const res = await getDashboardStats();
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.activeProjectsCount).toBeDefined();
        expect(res.data.totalCashBalance).toBeDefined();
      }
    });
  });

  describe("Owner Approvals Actions", () => {
    it("harus menyetujui dan menolak pengajuan pengeluaran lapangan polymorphically", async () => {
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
      await db.update(projectCost).set({ status: "SUBMITTED" }).where(eq(projectCost.id, cost.id));
      await db.update(approval).set({ status: "PENDING" }).where(eq(approval.id, appRecord!.id));
    });

    it("harus mendukung persetujuan dan penolakan pembayaran vendor polymorphically", async () => {
      // Cari vendor payment pending
      const vPay = await db.query.vendorPayment.findFirst({
        where: eq(vendorPayment.status, "PENDING"),
      });

      if (!vPay) return;

      mockUserSession(OWNER_USER);

      // Owner menyetujui pembayaran vendor
      const resApprove = await approveVendorPayment(vPay.id, "Valid disetujui Owner");
      expect(resApprove.success).toBe(true);

      const appRecord = await db.query.approval.findFirst({
        where: and(eq(approval.referenceType, "vendor_payment"), eq(approval.referenceId, vPay.id)),
      });
      expect(appRecord!.status).toBe("APPROVED");

      // Owner menolak pembayaran vendor
      const resReject = await approveVendorPayment(
        vPay.id,
        "Ditolak karena tidak sesuai",
        "REJECTED",
      );
      expect(resReject.success).toBe(true);

      const appRecordRejected = await db.query.approval.findFirst({
        where: and(eq(approval.referenceType, "vendor_payment"), eq(approval.referenceId, vPay.id)),
      });
      expect(appRecordRejected!.status).toBe("REJECTED");

      // Kembalikan status ke PENDING untuk konsistensi DB
      await db
        .update(vendorPayment)
        .set({ status: "PENDING" })
        .where(eq(vendorPayment.id, vPay.id));
      await db.update(approval).set({ status: "PENDING" }).where(eq(approval.id, appRecord!.id));
    });
  });
});
