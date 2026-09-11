import { afterAll, describe, expect, it, mock } from "bun:test";
import { confirmAiBankReconciliationProposal } from "@/app/actions/ai/confirm-bank-reconciliation-proposal";
import { auth } from "@/lib/auth";

mock.module("next/headers", () => ({ cookies: () => ({ toString: () => "mocked-cookies" }) }));
mock.module("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const originalGetSession = (auth.api as unknown as { getSession: unknown }).getSession;

const OWNER = {
  id: "11111111-1111-1111-1111-111111111111",
  role: "OWNER",
  email: "owner@dekoria.com",
  name: "Bambang Sutrisno",
};

const PM_USER = {
  id: "33333333-3333-3333-3333-333333333332",
  role: "PROJECT_MANAGER",
  email: "siti@dekoria.com",
  name: "Siti Aminah",
};

function actAs(user: typeof OWNER | typeof PM_USER | null): void {
  (auth.api as unknown as { getSession: unknown }).getSession = async (): Promise<unknown> => {
    if (!user) return null;
    return {
      session: {
        id: "mock-session-id",
        userId: user.id,
        expiresAt: new Date(Date.now() + 3_600_000),
        token: "mock-token",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      user: { ...user, emailVerified: true, isActive: true },
    };
  };
}

describe("confirmAiBankReconciliationProposal unit tests", () => {
  afterAll(() => {
    (auth.api as unknown as { getSession: unknown }).getSession = originalGetSession;
  });

  it("menolak jika sesi pengguna tidak ada (unauthorized)", async () => {
    actAs(null);

    const result = await confirmAiBankReconciliationProposal({
      toolCallId: "call-1",
      conversationId: "22222222-2222-2222-2222-222222222222",
      bankAccountId: "00000000-0000-0000-0000-000000000010",
      matches: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("UNAUTHORIZED");
    }
  });

  it("menolak jika peran tidak memiliki izin reconcile:ledger (forbidden)", async () => {
    actAs(PM_USER);

    const result = await confirmAiBankReconciliationProposal({
      toolCallId: "call-1",
      conversationId: "22222222-2222-2222-2222-222222222222",
      bankAccountId: "00000000-0000-0000-0000-000000000010",
      matches: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });

  it("menolak payload yang tidak lolos validasi skema (validation_error)", async () => {
    actAs(OWNER);

    const result = await confirmAiBankReconciliationProposal({
      toolCallId: "", // invalid empty
      conversationId: "bukan-uuid",
      bankAccountId: "bukan-uuid",
      matches: "invalid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("menolak jika tidak ada pasangan yang dipilih dan tidak ada mutasi yang diimpor", async () => {
    actAs(OWNER);

    const result = await confirmAiBankReconciliationProposal({
      toolCallId: "call-1",
      conversationId: "22222222-2222-2222-2222-222222222222",
      bankAccountId: "00000000-0000-0000-0000-000000000010",
      matches: [],
      unmatchedMutations: [],
      importUnmatched: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("Pilih minimal satu mutasi");
    }
  });

  it("menolak jika importUnmatched bernilai false dan matches kosong", async () => {
    actAs(OWNER);

    const result = await confirmAiBankReconciliationProposal({
      toolCallId: "call-1",
      conversationId: "22222222-2222-2222-2222-222222222222",
      bankAccountId: "00000000-0000-0000-0000-000000000010",
      matches: [],
      unmatchedMutations: [
        {
          transactionDate: "2026-03-01",
          description: "TRF TEST",
          amount: 50000,
          type: "INFLOW",
        },
      ],
      importUnmatched: false,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("Pilih minimal satu mutasi");
    }
  });
});
