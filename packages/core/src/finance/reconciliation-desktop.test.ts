import { describe, expect, test } from "bun:test";
import {
  reconciliationDesktopInputSchema,
  reconciliationMatchContextInputSchema,
} from "./reconciliation-desktop";

describe("desktop reconciliation read contract", () => {
  test("uses bounded page sizes and explicit source view", () => {
    expect(reconciliationDesktopInputSchema.parse({ view: "statement" })).toEqual({
      view: "statement",
      search: "",
      direction: "all",
      status: "all",
      sort: "date",
      sortDirection: "descending",
      page: 1,
      pageSize: 10,
    });
    expect(
      reconciliationDesktopInputSchema.safeParse({ view: "cash", pageSize: 100 }).success,
    ).toBe(false);
    expect(reconciliationDesktopInputSchema.safeParse({ view: "cash", page: 0 }).success).toBe(
      false,
    );
    expect(
      reconciliationDesktopInputSchema.safeParse({ view: "cash", search: "x".repeat(121) }).success,
    ).toBe(false);
  });
  test("rejects status filters from another view", () => {
    expect(
      reconciliationDesktopInputSchema.safeParse({ view: "statement", status: "exception" })
        .success,
    ).toBe(false);
    expect(
      reconciliationDesktopInputSchema.safeParse({ view: "cash", status: "candidate" }).success,
    ).toBe(false);
    expect(
      reconciliationDesktopInputSchema.safeParse({ view: "history", status: "actionable" }).success,
    ).toBe(false);
    expect(
      reconciliationDesktopInputSchema.safeParse({ view: "statement", status: "candidate" })
        .success,
    ).toBe(true);
  });
  test("match context selects exactly one source ID", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    expect(reconciliationMatchContextInputSchema.safeParse({ cashTransactionId: id }).success).toBe(
      true,
    );
    expect(reconciliationMatchContextInputSchema.safeParse({ statementRowId: id }).success).toBe(
      true,
    );
    expect(
      reconciliationMatchContextInputSchema.safeParse({ cashTransactionId: id, statementRowId: id })
        .success,
    ).toBe(false);
    expect(reconciliationMatchContextInputSchema.safeParse({}).success).toBe(false);
    expect(
      reconciliationMatchContextInputSchema.safeParse({ cashTransactionId: "invalid" }).success,
    ).toBe(false);
  });

  test("loads context for historical database UUIDs returned by the workspace", () => {
    const id = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee09";
    expect(reconciliationMatchContextInputSchema.safeParse({ statementRowId: id }).success).toBe(
      true,
    );
    expect(reconciliationMatchContextInputSchema.safeParse({ cashTransactionId: id }).success).toBe(
      true,
    );
  });

  test("accepts historical account IDs while rejecting malformed database identifiers", () => {
    expect(
      reconciliationDesktopInputSchema.safeParse({
        view: "statement",
        accountId: "55555555-5555-5555-5555-555555555551",
      }).success,
    ).toBe(true);
    for (const id of ["invalid", "", "eeeeeeeeeeeeeeeeeeeeeeeeeeeeee09", "g".repeat(36)]) {
      expect(reconciliationMatchContextInputSchema.safeParse({ statementRowId: id }).success).toBe(
        false,
      );
      expect(
        reconciliationDesktopInputSchema.safeParse({ view: "cash", accountId: id }).success,
      ).toBe(false);
    }
  });
});
