import { withTestRequest } from "@backend/lib/testing/request";
import { afterAll, expect, it } from "bun:test";
import { confirmAiBankReconciliationProposal } from "@backend/app/actions/ai/confirm-bank-reconciliation-proposal";
import { auth } from "@backend/lib/auth";
import { describeIntegration } from "@backend/lib/testing/integration-db";

const originalGetSession = (auth.api as unknown as { getSession: unknown }).getSession;

const OWNER = {
  id: "11111111-1111-1111-1111-111111111111",
  roleId: "00000000-0000-0000-0000-000000000001",
  email: "owner@dekoria.com",
  name: "Bambang Sutrisno",
};

const SITI = {
  id: "33333333-3333-3333-3333-333333333332",
  roleId: "00000000-0000-0000-0000-000000000003",
  email: "siti@dekoria.com",
  name: "Siti Aminah",
};

function actAs(user: typeof OWNER | typeof SITI): void {
  (auth.api as unknown as { getSession: unknown }).getSession = async (): Promise<unknown> => ({
    session: {
      id: "mock-session-id",
      userId: user.id,
      expiresAt: new Date(Date.now() + 3_600_000),
      token: "mock-token",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    user: { ...user, emailVerified: true, isActive: true },
  });
}

describeIntegration("konfirmasi usulan rekonsiliasi bank AI", () => {
  afterAll(
    withTestRequest(() => {
      (auth.api as unknown as { getSession: unknown }).getSession = originalGetSession;
    }),
  );

  it(
    "menolak konfirmasi usulan jika pengguna tidak memiliki izin reconcile:ledger",
    withTestRequest(async () => {
      actAs(SITI);

      const result = await confirmAiBankReconciliationProposal({
        toolCallId: `call-${Date.now()}`,
        conversationId: "22222222-2222-2222-2222-222222222222",
        bankAccountId: "00000000-0000-0000-0000-000000000010",
        matches: [],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("FORBIDDEN");
      }
    }),
  );

  it(
    "menolak konfirmasi jika data usulan tidak memenuhi skema validasi",
    withTestRequest(async () => {
      actAs(OWNER);

      const result = await confirmAiBankReconciliationProposal({
        toolCallId: "",
        conversationId: "bukan-uuid",
        bankAccountId: "bukan-uuid",
        matches: [],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    }),
  );
});
