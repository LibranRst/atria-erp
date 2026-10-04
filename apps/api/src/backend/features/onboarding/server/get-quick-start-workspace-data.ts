import {
  getBudgetSettings,
  getExpenseCategorySettings,
  type BudgetSettingsData,
  type ExpenseCategorySettingsData,
} from "@backend/app/actions/settings/system";
import { getBudgetAllocationDefault } from "@backend/app/actions/project/excel-budget-utils";
import { getOrganizationSetupOverviewUseCase } from "@backend/server/usecases/onboarding/organization-setup-overview";
import { getProjectFormBootstrap } from "@backend/server/usecases/project/project-form-bootstrap";
import { resolveActor, type Actor } from "@backend/server/actor";
import type {
  OrganizationSetupOverview,
  QuickStartStepId,
} from "@atria/core/onboarding/organization-setup";
import { resolveQuickStartActiveStep } from "@atria/core/onboarding/organization-setup";
import type { ActionResponse } from "@atria/core/types/action-response";

export type QuickStartWorkspaceData = {
  readonly overview: OrganizationSetupOverview;
  /** Step whose dependent payloads were loaded for this response. */
  readonly activeStep: QuickStartStepId;
  readonly financial:
    | {
        readonly status: "ready";
        readonly budget: BudgetSettingsData;
        readonly categories: ExpenseCategorySettingsData;
      }
    | { readonly status: "error"; readonly message: string }
    | null;
  readonly project:
    | {
        readonly status: "ready";
        readonly clients: ReadonlyArray<{ readonly id: string; readonly name: string }>;
        readonly projectManagers: ReadonlyArray<{ readonly id: string; readonly name: string }>;
        readonly allocation: Awaited<ReturnType<typeof getBudgetAllocationDefault>>;
      }
    | { readonly status: "error"; readonly message: string }
    | null;
};

export async function getQuickStartWorkspaceData(
  requestedStep?: QuickStartStepId,
): Promise<ActionResponse<QuickStartWorkspaceData>> {
  const actor = await resolveActor();
  if (!actor) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }
  return getQuickStartWorkspaceDataForActor(actor, requestedStep);
}

export async function getQuickStartWorkspaceDataForActor(
  actor: Actor,
  requestedStep?: QuickStartStepId,
): Promise<ActionResponse<QuickStartWorkspaceData>> {
  const overviewResult = await getOrganizationSetupOverviewUseCase(actor);
  if (!overviewResult.success) return overviewResult;
  if (!overviewResult.data.canManageQuickStart) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Quick start hanya dapat dikelola Owner." },
    };
  }

  const state = overviewResult.data.quickStart.state;
  const step = resolveQuickStartActiveStep(state, requestedStep);
  let financial: QuickStartWorkspaceData["financial"] = null;
  let project: QuickStartWorkspaceData["project"] = null;

  if (step === "financial_defaults") {
    const [budgetResult, categoryResult] = await Promise.all([
      getBudgetSettings(),
      getExpenseCategorySettings(),
    ]);
    financial =
      budgetResult.success && categoryResult.success
        ? { status: "ready", budget: budgetResult.data, categories: categoryResult.data }
        : {
            status: "error",
            message:
              (!budgetResult.success && budgetResult.error.message) ||
              (!categoryResult.success && categoryResult.error.message) ||
              "Default finansial belum dapat dimuat.",
          };
  }

  if (step === "first_project") {
    const [bootstrap, allocation] = await Promise.all([
      getProjectFormBootstrap(actor, {}),
      getBudgetAllocationDefault(),
    ]);
    project =
      bootstrap.status === "ready"
        ? {
            status: "ready",
            clients: bootstrap.clients,
            projectManagers: bootstrap.projectManagers,
            allocation,
          }
        : { status: "error", message: "Data project pertama belum dapat dimuat." };
  }

  return {
    success: true,
    data: { overview: overviewResult.data, activeStep: step, financial, project },
  };
}
