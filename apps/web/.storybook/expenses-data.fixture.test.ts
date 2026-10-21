import { expect, test } from "bun:test";
import { expenseDraftPayloadSchema } from "@atria/core/validations/expense-draft";
import {
  expensesFixtureData,
  expensesFixtureDraft,
  EXPENSES_FIXTURE_DRAFTS,
} from "./expenses-data.fixture";

test("Expenses preview includes multiple complete table pages and valid manual drafts", () => {
  const data = expensesFixtureData("complete");
  expect(
    data.costs.filter((cost) => cost.status !== "PAID" && cost.status !== "REJECTED").length,
  ).toBeGreaterThan(20);
  expect(data.bills.length).toBe(30);
  expect(data.payments.length).toBe(30);
  for (const draft of EXPENSES_FIXTURE_DRAFTS)
    expect(
      expenseDraftPayloadSchema.safeParse(expensesFixtureDraft(draft.id).payload).success,
    ).toBe(true);
});

test("Read-only and assigned previews keep payment bank identity redacted", () => {
  for (const scenario of ["read-only", "assigned", "vendor-only"] as const) {
    const data = expensesFixtureData(scenario);
    expect(data.accounts).toEqual([]);
    expect(
      data.payments.every(
        (payment) => payment.bankAccountId === "" && payment.bankAccount === null,
      ),
    ).toBe(true);
    expect(
      data.bills.every((bill) =>
        bill.payments?.every(
          (payment) => payment.bankAccountId === "" && payment.bankAccount === null,
        ),
      ),
    ).toBe(true);
  }
});

test("Vendor-only preview supplies bills without fabricated field expense data", () => {
  const data = expensesFixtureData("vendor-only");
  expect(data.costs).toEqual([]);
  expect(data.bills).toHaveLength(30);
  expect(data.payments).toHaveLength(30);
});

test("Assigned preview mirrors own requests and assigned vendor projects independently", () => {
  const data = expensesFixtureData("assigned");
  expect(data.costs.every((cost) => cost.requestedBy?.name === "Budi Santoso")).toBe(true);
  expect(data.projects).toHaveLength(1);
  expect(data.bills.every((bill) => bill.projectId === data.projects[0]?.id)).toBe(true);
  const billIds = new Set(data.bills.map((bill) => bill.id));
  expect(data.payments.every((payment) => billIds.has(payment.vendorBillId))).toBe(true);
});

test("Empty preview leaves transactional collections empty", () => {
  const data = expensesFixtureData("empty");
  expect(data.costs).toEqual([]);
  expect(data.bills).toEqual([]);
  expect(data.payments).toEqual([]);
});
