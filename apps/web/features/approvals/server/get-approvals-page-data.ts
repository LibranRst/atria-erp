import "server-only";

import type { ApprovalDetail } from "@/lib/finance/approval-types";
import { getPendingApprovalDetails, rankPendingApprovals } from "@/lib/finance/approval-details";
import { resolveRoleName } from "@/lib/auth/permissions";
import { requireServerSession } from "@/lib/server/session";

export type ApprovalsPageData =
  | {
      readonly status: "restricted";
    }
  | {
      readonly status: "ready";
      readonly approvals: readonly ApprovalDetail[];
      readonly canEmergencyOverride: boolean;
      readonly referenceDateIso: string;
    };

export async function getApprovalsPageData(): Promise<ApprovalsPageData> {
  const session = await requireServerSession();
  const roleName = await resolveRoleName(session.user.roleId);
  if (roleName !== "OWNER" && roleName !== "FINANCE_ADMIN") {
    return { status: "restricted" };
  }

  const referenceDate = new Date();
  const approvals = rankPendingApprovals(await getPendingApprovalDetails(), referenceDate);

  return {
    status: "ready",
    approvals:
      roleName === "FINANCE_ADMIN"
        ? approvals.filter((item) => item.type === "inventory_opening")
        : approvals,
    canEmergencyOverride: roleName === "OWNER",
    referenceDateIso: referenceDate.toISOString(),
  };
}
