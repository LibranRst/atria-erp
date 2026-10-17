import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
import type { ActionResponse } from "@atria/core/types/action-response";
import { projectsFixtureData, type ProjectsFixtureScenario } from "./projects-data.fixture";

let scenario: ProjectsFixtureScenario = "complete";

export function setProjectsFixtureScenario(next: ProjectsFixtureScenario): void {
  scenario = next;
}

async function fixtureWrite(): Promise<ActionResponse<never>> {
  if (scenario === "pending") await new Promise<void>((resolve) => setTimeout(resolve, 15_000));
  return {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Fixture visual: tindakan ini tidak menyimpan proyek atau menghubungi backend.",
    },
  };
}

export async function createProjectAction(
  ...args: WebRpcArgs<"app/actions/project/crud.createProjectAction">
): Promise<WebRpcResult<"app/actions/project/crud.createProjectAction">> {
  void args;
  return fixtureWrite();
}
export async function updateProjectAction(
  ...args: WebRpcArgs<"app/actions/project/crud.updateProjectAction">
): Promise<WebRpcResult<"app/actions/project/crud.updateProjectAction">> {
  void args;
  return fixtureWrite();
}
export async function assignProjectManagerAction(
  ...args: WebRpcArgs<"app/actions/project/crud.assignProjectManagerAction">
): Promise<WebRpcResult<"app/actions/project/crud.assignProjectManagerAction">> {
  void args;
  return fixtureWrite();
}
export async function getProjectFormData(
  ...args: WebRpcArgs<"app/actions/project/crud.getProjectFormData">
): Promise<WebRpcResult<"app/actions/project/crud.getProjectFormData">> {
  void args;
  const data = projectsFixtureData(scenario);
  return { success: true, data: { clients: [...data.clients], users: [...data.users] } };
}

export async function submitProjectBudget(
  ...args: WebRpcArgs<"app/actions/project/excel-budget.submitProjectBudget">
): Promise<WebRpcResult<"app/actions/project/excel-budget.submitProjectBudget">> {
  void args;
  return fixtureWrite();
}
export async function approveProjectBudget(
  ...args: WebRpcArgs<"app/actions/project/excel-budget.approveProjectBudget">
): Promise<WebRpcResult<"app/actions/project/excel-budget.approveProjectBudget">> {
  void args;
  return fixtureWrite();
}
export async function rejectProjectBudget(
  ...args: WebRpcArgs<"app/actions/project/excel-budget.rejectProjectBudget">
): Promise<WebRpcResult<"app/actions/project/excel-budget.rejectProjectBudget">> {
  void args;
  return fixtureWrite();
}
export async function reallocateProjectBudget(
  ...args: WebRpcArgs<"app/actions/project/workflow-governance.reallocateProjectBudget">
): Promise<WebRpcResult<"app/actions/project/workflow-governance.reallocateProjectBudget">> {
  void args;
  return fixtureWrite();
}
