import { describe, test, expect } from "bun:test";
import { financeInputSchema, invoiceScheduleRows, financeInputPermission } from "./finance-input";
const projectId = "00000000-0000-4000-8000-000000000001";
describe("AI finance input contracts", () => {
  test("real PostgreSQL identifiers from historical ERP records are accepted without relaxing reference ownership", () => {
    const input = {
      action: "CREATE_INVOICE",
      projectId: "77777777-7777-7777-7777-777777777776",
      invoiceNumber: "QA",
      amount: 1,
      stage: "DP",
      dueDate: "2026-10-30",
    };
    expect(financeInputSchema.safeParse(input).success).toBe(true);
    expect(financeInputSchema.safeParse({ ...input, projectId: "not-a-database-id" }).success).toBe(
      false,
    );
  });
  test("a schedule allocates every cent and clamps month ends without skipping February", () => {
    const rows = invoiceScheduleRows(1000.01, "2028-01-31", [
      { label: "DP", percentage: 0.3 },
      { label: "Progres", percentage: 0.4 },
      { label: "Pelunasan", percentage: 0.3 },
    ]);
    expect(rows.map((row) => row.dueDate)).toEqual(["2028-01-31", "2028-02-29", "2028-03-31"]);
    expect(rows.map((row) => row.amount)).toEqual([300, 400, 300.01]);
    expect(rows.reduce((sum, row) => sum + Math.round(row.amount * 100), 0)).toBe(100001);
    expect(rows.map((row) => row.stage)).toEqual(["DP", "PROGRESS_1", "PELUNASAN"]);
  });
  test("invalid dates, excess rows, incomplete percentages and zero-cent installments are rejected", () => {
    const input = {
      action: "CREATE_SCHEDULE",
      projectId,
      firstDueDate: "2026-02-30",
      installments: [{ label: "DP", percentage: 1 }],
    };
    expect(financeInputSchema.safeParse(input).success).toBe(false);
    expect(
      financeInputSchema.safeParse({
        ...input,
        firstDueDate: "2026-02-28",
        installments: [{ label: "DP", percentage: 0.8 }],
      }).success,
    ).toBe(false);
    expect(
      financeInputSchema.safeParse({
        ...input,
        firstDueDate: "2026-02-28",
        installments: Array.from({ length: 25 }, () => ({ label: "DP", percentage: 1 / 25 })),
      }).success,
    ).toBe(false);
    expect(() =>
      invoiceScheduleRows(0.01, "2026-02-28", [
        { label: "DP", percentage: 0.5 },
        { label: "Pelunasan", percentage: 0.5 },
      ]),
    ).toThrow();
  });
  test("invoice amount is exact and proposals cannot contain execution fields", () => {
    const input = {
      action: "CREATE_INVOICE",
      projectId,
      invoiceNumber: " INV-QA ",
      amount: 20000,
      stage: "DP",
      dueDate: "2026-10-30",
    };
    expect(financeInputSchema.parse(input).action).toBe("CREATE_INVOICE");
    expect(financeInputSchema.safeParse({ ...input, amount: 0 }).success).toBe(false);
    expect(financeInputSchema.safeParse({ ...input, amount: 20.001 }).success).toBe(false);
    expect(financeInputSchema.safeParse({ ...input, status: "PAID" }).success).toBe(false);
    expect(financeInputPermission(financeInputSchema.parse(input))).toBe("create:client_invoice");
  });
});
