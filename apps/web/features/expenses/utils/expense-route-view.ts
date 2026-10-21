import type { ExpenseListTab, FilterStatus } from "@atria/core/types/expenses";

export function parseExpenseFilter(value: string | null): FilterStatus {
  switch (value) {
    case "NEEDS_VERIFICATION":
    case "NEEDS_APPROVAL":
    case "READY_TO_PAY":
    case "PAID":
    case "REJECTED":
      return value;
    default:
      return "ALL";
  }
}

export function resolveExpenseView({
  vendorIntent,
  fallback,
  canViewFieldClaims,
  canViewVendorBills,
}: {
  readonly vendorIntent: boolean;
  readonly fallback: ExpenseListTab;
  readonly canViewFieldClaims: boolean;
  readonly canViewVendorBills: boolean;
}): ExpenseListTab | null {
  const preferred = vendorIntent ? "VENDOR_BILLS" : fallback;
  if (preferred === "FIELD_CLAIMS" && canViewFieldClaims) return preferred;
  if (preferred === "VENDOR_BILLS" && canViewVendorBills) return preferred;
  return canViewFieldClaims ? "FIELD_CLAIMS" : canViewVendorBills ? "VENDOR_BILLS" : null;
}
