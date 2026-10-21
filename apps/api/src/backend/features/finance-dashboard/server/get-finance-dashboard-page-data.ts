import { actorCan } from "@backend/lib/auth/permissions";

import type { FinanceDashboardOverview } from "@atria/core/finance/dashboard-contracts";
import { getOrganizationSetupOverviewUseCase } from "@backend/server/usecases/onboarding/organization-setup-overview";
import { getFinanceDashboardOverviewUseCase } from "@backend/server/usecases/finance/dashboard-overview";
import type { OrganizationSetupOverview } from "@atria/core/onboarding/organization-setup";
import type { Actor } from "@backend/server/actor";

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
      readonly setup: OrganizationSetupOverview | null;
    };

export async function getFinanceDashboardPageData(actor: Actor): Promise<FinanceDashboardPageData> {
  if (!actorCan(actor, "view:ledger")) {
    return { status: "restricted" };
  }

  const [overview, setup] = await Promise.all([
    getFinanceDashboardOverviewUseCase(actor),
    actorCan(actor, "manage:onboarding")
      ? getOrganizationSetupOverviewUseCase(actor)
      : Promise.resolve(null),
  ]);

  if (!overview.success) {
    return { status: "error", message: overview.error.message };
  }

  return {
    status: "ready",
    overview: overview.data,
    userName: actor.name,
    setup: setup?.success ? setup.data : null,
  };
}
