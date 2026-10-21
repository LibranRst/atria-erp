import { describe, expect, test } from "bun:test";
import { parseExpenseFilter, resolveExpenseView } from "./expense-route-view";

describe("expense route intent", () => {
  test("history and rejected deep links restore the same status collection", () => {
    expect(parseExpenseFilter("PAID")).toBe("PAID");
    expect(parseExpenseFilter("REJECTED")).toBe("REJECTED");
    expect(parseExpenseFilter("READY_TO_PAY")).toBe("READY_TO_PAY");
    expect(parseExpenseFilter("unknown")).toBe("ALL");
    expect(parseExpenseFilter(null)).toBe("ALL");
  });
  test("explicit vendor intent wins over a previously selected field view", () => {
    expect(
      resolveExpenseView({
        vendorIntent: true,
        fallback: "FIELD_CLAIMS",
        canViewFieldClaims: true,
        canViewVendorBills: true,
      }),
    ).toBe("VENDOR_BILLS");
  });
  test("a vendor-only role receives its accessible collection instead of healthy zero field costs", () => {
    expect(
      resolveExpenseView({
        vendorIntent: false,
        fallback: "FIELD_CLAIMS",
        canViewFieldClaims: false,
        canViewVendorBills: true,
      }),
    ).toBe("VENDOR_BILLS");
  });
  test("URL intent cannot expose an unavailable domain", () => {
    expect(
      resolveExpenseView({
        vendorIntent: true,
        fallback: "VENDOR_BILLS",
        canViewFieldClaims: true,
        canViewVendorBills: false,
      }),
    ).toBe("FIELD_CLAIMS");
    expect(
      resolveExpenseView({
        vendorIntent: true,
        fallback: "VENDOR_BILLS",
        canViewFieldClaims: false,
        canViewVendorBills: false,
      }),
    ).toBeNull();
  });
});
