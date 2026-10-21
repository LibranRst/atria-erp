import { buildBankReconciliationTools } from "./bank-reconciliation-tools";
import { bankReconciliationInputSchema } from "@backend/lib/ai/tools/finance-proposal-tools";
import { aiToolContextForRole } from "@backend/lib/testing/ai-tool-context";
import { describe, expect, it } from "bun:test";

describe("tool proposeBankReconciliation", () => {
  it("menolak eksekusi jika pengguna tidak memiliki izin reconcile:ledger (misal: PROJECT_MANAGER)", async () => {
    const pmContext = aiToolContextForRole("PROJECT_MANAGER");
    const tools = buildBankReconciliationTools(pmContext);

    const execute = tools.proposeBankReconciliation.execute;
    if (!execute) throw new Error("execute is not defined");
    const result = await execute(
      {
        action: "IMPORT",
        bankAccountId: "00000000-0000-0000-0000-000000000010",
        fileName: "qa.csv",
        rows: [
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

    expect(result).toMatchObject({ error: expect.stringContaining("Akses") });
  });
  it("memvalidasi skema input tool dengan benar", () => {
    const valid = bankReconciliationInputSchema.safeParse({
      action: "IMPORT",
      fileName: "qa.csv",
      bankAccountId: "00000000-0000-0000-0000-000000000010",
      rows: [
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
      rows: [],
    });
    expect(invalidEmptyMutations.success).toBe(false);

    const invalidNegativeAmount = bankReconciliationInputSchema.safeParse({
      rows: [
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
