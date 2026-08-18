import "server-only";

import type { FinanceDashboardOverview } from "@/app/actions/finance/dashboard-overview";
import { getOwnerOnboardingOverviewUseCase } from "@/server/usecases/onboarding/owner-onboarding-overview";
import { getFinanceDashboardOverviewUseCase } from "@/server/usecases/finance/dashboard-overview";
import type { OwnerOnboardingOverview } from "@atria/core/onboarding/owner-onboarding";
import type { Actor } from "@/server/actor";

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

export async function getFinanceDashboardPageData(actor: Actor): Promise<FinanceDashboardPageData> {
  const roleName = actor.roleName;
  if (roleName !== "OWNER" && roleName !== "FINANCE_ADMIN") {
    return { status: "restricted" };
  }

  const [overview, onboarding] = await Promise.all([
    getFinanceDashboardOverviewUseCase(actor),
    roleName === "OWNER"
      ? getOwnerOnboardingOverviewUseCase({ id: actor.userId, roleId: actor.roleId })
      : Promise.resolve(null),
  ]);

  if (!overview.success) {
    return { status: "error", message: overview.error.message };
  }

  return {
    status: "ready",
    overview: overview.data,
    userName: actor.name,
    onboarding: onboarding?.success ? onboarding.data : null,
  };
}
