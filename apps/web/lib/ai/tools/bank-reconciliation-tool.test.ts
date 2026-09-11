import {
  bankReconciliationInputSchema,
  buildFinanceProposalTools,
} from "@/lib/ai/tools/finance-proposal-tools";
import { aiToolContextForRole } from "@/lib/testing/ai-tool-context";
import { describe, expect, it } from "bun:test";

describe("tool proposeBankReconciliation", () => {
  it("menolak eksekusi jika pengguna tidak memiliki izin reconcile:ledger (misal: PROJECT_MANAGER)", async () => {
    const pmContext = aiToolContextForRole("PROJECT_MANAGER");
    const tools = buildFinanceProposalTools(pmContext);

    const execute = tools.proposeBankReconciliation.execute;
    if (!execute) throw new Error("execute is not defined");
    const result = await execute(
      {
        mutations: [
          {
            transactionDate: "2026-03-01",
            description: "TRF SEMEN",
            amount: 500000,
            type: "OUTFLOW",
          },
        ],
      },
      { messages: [], toolCallId: "call-test" } as unknown as Parameters<typeof execute>[1],
    );

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("akses");
    }
  });
  it("memvalidasi skema input tool dengan benar", () => {
    const valid = bankReconciliationInputSchema.safeParse({
      bankAccountId: "00000000-0000-0000-0000-000000000010",
      mutations: [
        {
          transactionDate: "2026-03-01",
          description: "TRF PEMBAYARAN VENDOR",
          amount: 1500000,
          type: "OUTFLOW",
        },
      ],
    });
    expect(valid.success).toBe(true);

    const invalidEmptyMutations = bankReconciliationInputSchema.safeParse({
      mutations: [],
    });
    expect(invalidEmptyMutations.success).toBe(false);

    const invalidNegativeAmount = bankReconciliationInputSchema.safeParse({
      mutations: [
        {
          transactionDate: "2026-03-01",
          description: "BIAYA",
          amount: -100,
          type: "OUTFLOW",
        },
      ],
    });
    expect(invalidNegativeAmount.success).toBe(false);
  });
});
