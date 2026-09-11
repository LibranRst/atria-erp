import { readAnyProposal } from "@/features/ai-chat/utils/proposal-reader";
import { aiBankReconciliationProposalSchema } from "@atria/core/validations/ai-proposal";
import { describe, expect, it } from "bun:test";

describe("pembacaan usulan rekonsiliasi bank AI", () => {
  const validProposalOutput = {
    proposal: {
      kind: "BANK_RECONCILIATION",
      bankAccountId: "00000000-0000-0000-0000-000000000010",
      bankAccountName: "BCA - Operasional",
      accountNumber: "1234567890",
      totalMutations: 2,
      matchedCount: 1,
      unmatchedCount: 1,
      matches: [
        {
          cashTransactionId: "11111111-1111-1111-1111-111111111111",
          cashTransactionDescription: "Beli semen 10 sak",
          cashTransactionDate: "2026-03-01",
          statementRow: {
            transactionDate: "2026-03-01",
            description: "TRF TB JAYA ABADI SEMEN",
            amount: 750000,
            type: "OUTFLOW" as const,
          },
          matchedAmount: { amount: 750000, formatted: "Rp 750.000" },
        },
      ],
      unmatchedMutations: [
        {
          transactionDate: "2026-03-02",
          description: "BIAYA ADM BANK",
          amount: 15000,
          type: "OUTFLOW" as const,
          formattedAmount: { amount: 15000, formatted: "Rp 15.000" },
        },
      ],
      availableBankAccounts: [
        {
          id: "00000000-0000-0000-0000-000000000010",
          name: "Operasional",
          bankName: "BCA",
          accountNumber: "1234567890",
        },
      ],
    },
  };

  it("berhasil membaca usulan rekonsiliasi yang sah", () => {
    const parsed = readAnyProposal(validProposalOutput);
    expect(parsed).not.toBeNull();
    expect(parsed?.kind).toBe("BANK_RECONCILIATION");
    if (parsed && parsed.kind === "BANK_RECONCILIATION") {
      expect(parsed.bankAccountName).toBe("BCA - Operasional");
      expect(parsed.matches.length).toBe(1);
      expect(parsed.unmatchedMutations.length).toBe(1);
    }
  });

  it("menolak usulan jika matches bukan array atau bankAccountId kosong", () => {
    expect(
      readAnyProposal({
        proposal: {
          kind: "BANK_RECONCILIATION",
          bankAccountId: 123,
          matches: "bukan-array",
        },
      }),
    ).toBeNull();
  });

  it("memvalidasi skema konfirmasi usulan rekonsiliasi dengan benar", () => {
    const validPayload = {
      toolCallId: "call_reconcile_123",
      conversationId: "22222222-2222-2222-2222-222222222222",
      bankAccountId: "00000000-0000-0000-0000-000000000010",
      matches: [
        {
          cashTransactionId: "11111111-1111-1111-1111-111111111111",
          statementRow: {
            transactionDate: "2026-03-01",
            description: "TRF TB JAYA ABADI SEMEN",
            amount: 750000,
            type: "OUTFLOW",
          },
        },
      ],
      unmatchedMutations: [
        {
          transactionDate: "2026-03-02",
          description: "BIAYA ADM BANK",
          amount: 15000,
          type: "OUTFLOW",
        },
      ],
      importUnmatched: true,
    };

    const parseResult = aiBankReconciliationProposalSchema.safeParse(validPayload);
    expect(parseResult.success).toBe(true);
  });

  it("menolak konfirmasi usulan jika UUID akun bank tidak valid atau nominal negatif", () => {
    const invalidPayload = {
      toolCallId: "call_reconcile_123",
      conversationId: "bukan-uuid",
      bankAccountId: "bukan-uuid",
      matches: [
        {
          cashTransactionId: "11111111-1111-1111-1111-111111111111",
          statementRow: {
            transactionDate: "2026-03-01",
            description: "TRF TB JAYA ABADI SEMEN",
            amount: -5000, // Invalid negative amount
            type: "OUTFLOW",
          },
        },
      ],
    };

    const parseResult = aiBankReconciliationProposalSchema.safeParse(invalidPayload);
    expect(parseResult.success).toBe(false);
  });
});
