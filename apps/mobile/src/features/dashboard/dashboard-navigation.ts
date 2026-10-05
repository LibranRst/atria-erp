import type { PermissionKey } from "@atria/core/auth/permissions";
import type { DashboardPageTab } from "@atria/core/finance/dashboard-overview";

export function parseDashboardTab(
  value: string | undefined,
  permissions: readonly PermissionKey[],
): DashboardPageTab {
  if (value === "approvals" && permissions.includes("view:approval_queue")) return "approvals";
  if (value === "budget" || value === "cash" || value === "accounts" || value === "materials")
    return value;
  return "overview";
}
