import "server-only";

import {
  getFinanceDashboardOverview,
  type FinanceDashboardOverview,
} from "@/app/actions/finance/dashboard-overview";
import { getOwnerOnboardingOverview } from "@/app/actions/onboarding";
import { resolveRoleName } from "@/lib/auth/permissions";
import type { OwnerOnboardingOverview } from "@/lib/onboarding/owner-onboarding";
import { requireServerSession } from "@/lib/server/session";

export type FinanceDashboardPageData =
  | {
      readonly status: "restricted";
    }
  | {
      readonly status: "error";
      readonly message: string;
    }
  | {
      readonly status: "ready";
      readonly overview: FinanceDashboardOverview;
      readonly userName: string;
      readonly onboarding: OwnerOnboardingOverview | null;
    };

export async function getFinanceDashboardPageData(): Promise<FinanceDashboardPageData> {
  const session = await requireServerSession();
  const roleName = await resolveRoleName(session.user.roleId);
  if (roleName !== "OWNER" && roleName !== "FINANCE_ADMIN") {
    return { status: "restricted" };
  }

  const [overview, onboarding] = await Promise.all([
    getFinanceDashboardOverview(),
    roleName === "OWNER" ? getOwnerOnboardingOverview() : Promise.resolve(null),
  ]);

  if (!overview.success) {
    return { status: "error", message: overview.error.message };
  }

  return {
    status: "ready",
    overview: overview.data,
    userName: session.user.name,
    onboarding: onboarding?.success ? onboarding.data : null,
  };
}
