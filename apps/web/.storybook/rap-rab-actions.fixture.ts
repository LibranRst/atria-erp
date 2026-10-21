import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
import type { ActionResponse } from "@atria/core/types/action-response";
export { reallocateProjectBudget } from "./projects-actions.fixture";

export type RapRabFixtureScenario = "complete" | "pending";
let scenario: RapRabFixtureScenario = "complete";
const calls: string[] = [];
export function setRapRabFixtureScenario(next: RapRabFixtureScenario): void {
  scenario = next;
  calls.length = 0;
}
export function rapRabFixtureCalls(): readonly string[] {
  return [...calls];
}
async function fixtureWrite(operation: string): Promise<ActionResponse<never>> {
  calls.push(operation);
  if (scenario === "pending") await new Promise<void>((resolve) => setTimeout(resolve, 15_000));
  return {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Fixture visual: tindakan ini tidak menyimpan data atau menghubungi backend.",
    },
  };
}

export async function createProjectRap(
  ...args: WebRpcArgs<"app/actions/project/project-rap-actions.createProjectRap">
): Promise<WebRpcResult<"app/actions/project/project-rap-actions.createProjectRap">> {
  void args;
  return fixtureWrite("createProjectRap");
}

export async function addProjectRapItem(
  ...args: WebRpcArgs<"app/actions/project/project-rap-actions.addProjectRapItem">
): Promise<WebRpcResult<"app/actions/project/project-rap-actions.addProjectRapItem">> {
  void args;
  return fixtureWrite("addProjectRapItem");
}

export async function updateProjectRapItem(
  ...args: WebRpcArgs<"app/actions/project/project-rap-actions.updateProjectRapItem">
): Promise<WebRpcResult<"app/actions/project/project-rap-actions.updateProjectRapItem">> {
  void args;
  return fixtureWrite("updateProjectRapItem");
}

export async function deleteProjectRapItem(
  ...args: WebRpcArgs<"app/actions/project/project-rap-actions.deleteProjectRapItem">
): Promise<WebRpcResult<"app/actions/project/project-rap-actions.deleteProjectRapItem">> {
  void args;
  return fixtureWrite("deleteProjectRapItem");
}

export async function lockProjectRap(
  ...args: WebRpcArgs<"app/actions/project/project-rap-actions.lockProjectRap">
): Promise<WebRpcResult<"app/actions/project/project-rap-actions.lockProjectRap">> {
  void args;
  return fixtureWrite("lockProjectRap");
}

export async function approveRabEstimate(
  ...args: WebRpcArgs<"app/actions/project/rap-rab-approval.approveRabEstimate">
): Promise<WebRpcResult<"app/actions/project/rap-rab-approval.approveRabEstimate">> {
  void args;
  return fixtureWrite("approveRabEstimate");
}

export async function addRabManualItem(
  ...args: WebRpcArgs<"app/actions/project/rap-rab-bundles.addRabManualItem">
): Promise<WebRpcResult<"app/actions/project/rap-rab-bundles.addRabManualItem">> {
  void args;
  return fixtureWrite("addRabManualItem");
}

export async function createRabBundle(
  ...args: WebRpcArgs<"app/actions/project/rap-rab-bundles.createRabBundle">
): Promise<WebRpcResult<"app/actions/project/rap-rab-bundles.createRabBundle">> {
  void args;
  return fixtureWrite("createRabBundle");
}

export async function updateRabBundle(
  ...args: WebRpcArgs<"app/actions/project/rap-rab-bundles.updateRabBundle">
): Promise<WebRpcResult<"app/actions/project/rap-rab-bundles.updateRabBundle">> {
  void args;
  return fixtureWrite("updateRabBundle");
}

export async function deleteRabBundle(
  ...args: WebRpcArgs<"app/actions/project/rap-rab-bundles.deleteRabBundle">
): Promise<WebRpcResult<"app/actions/project/rap-rab-bundles.deleteRabBundle">> {
  void args;
  return fixtureWrite("deleteRabBundle");
}

export async function generateRabFromRap(
  ...args: WebRpcArgs<"app/actions/project/rap-rab-generation.generateRabFromRap">
): Promise<WebRpcResult<"app/actions/project/rap-rab-generation.generateRabFromRap">> {
  void args;
  return fixtureWrite("generateRabFromRap");
}

export async function generateRabFromSelectedSources(
  ...args: WebRpcArgs<"app/actions/project/rap-rab-generation.generateRabFromSelectedSources">
): Promise<WebRpcResult<"app/actions/project/rap-rab-generation.generateRabFromSelectedSources">> {
  void args;
  return fixtureWrite("generateRabFromSelectedSources");
}

export async function updateRabEstimateItem(
  ...args: WebRpcArgs<"app/actions/project/rab-item-actions.updateRabEstimateItem">
): Promise<WebRpcResult<"app/actions/project/rab-item-actions.updateRabEstimateItem">> {
  void args;
  return fixtureWrite("updateRabEstimateItem");
}

export async function createProjectCategoryPlanItem(
  ...args: WebRpcArgs<"app/actions/project/category-plan.createProjectCategoryPlanItem">
): Promise<WebRpcResult<"app/actions/project/category-plan.createProjectCategoryPlanItem">> {
  void args;
  return fixtureWrite("createProjectCategoryPlanItem");
}

export async function updateProjectCategoryPlanItem(
  ...args: WebRpcArgs<"app/actions/project/category-plan.updateProjectCategoryPlanItem">
): Promise<WebRpcResult<"app/actions/project/category-plan.updateProjectCategoryPlanItem">> {
  void args;
  return fixtureWrite("updateProjectCategoryPlanItem");
}

export async function markProjectCategoryPlanItemActive(
  ...args: WebRpcArgs<"app/actions/project/category-plan.markProjectCategoryPlanItemActive">
): Promise<WebRpcResult<"app/actions/project/category-plan.markProjectCategoryPlanItemActive">> {
  void args;
  return fixtureWrite("markProjectCategoryPlanItemActive");
}

export async function deleteProjectCategoryPlanItem(
  ...args: WebRpcArgs<"app/actions/project/category-plan.deleteProjectCategoryPlanItem">
): Promise<WebRpcResult<"app/actions/project/category-plan.deleteProjectCategoryPlanItem">> {
  void args;
  return fixtureWrite("deleteProjectCategoryPlanItem");
}

export async function getProjectCategoryPlanItems(
  ...args: WebRpcArgs<"app/actions/project/category-plan.getProjectCategoryPlanItems">
): Promise<WebRpcResult<"app/actions/project/category-plan.getProjectCategoryPlanItems">> {
  void args;
  return fixtureWrite("getProjectCategoryPlanItems");
}

export async function advanceProjectRapSetup(
  ...args: WebRpcArgs<"app/actions/project/rap-setup.advanceProjectRapSetup">
): Promise<WebRpcResult<"app/actions/project/rap-setup.advanceProjectRapSetup">> {
  void args;
  return fixtureWrite("advanceProjectRapSetup");
}

export async function setProjectRapScopeSkipped(
  ...args: WebRpcArgs<"app/actions/project/rap-setup.setProjectRapScopeSkipped">
): Promise<WebRpcResult<"app/actions/project/rap-setup.setProjectRapScopeSkipped">> {
  void args;
  return fixtureWrite("setProjectRapScopeSkipped");
}

export async function markProjectCategoryPlanItemDraft(
  ...args: WebRpcArgs<"app/actions/project/rap-setup.markProjectCategoryPlanItemDraft">
): Promise<WebRpcResult<"app/actions/project/rap-setup.markProjectCategoryPlanItemDraft">> {
  void args;
  return fixtureWrite("markProjectCategoryPlanItemDraft");
}

export async function finalizeProjectInternalPlan(
  ...args: WebRpcArgs<"app/actions/project/rap-setup.finalizeProjectInternalPlan">
): Promise<WebRpcResult<"app/actions/project/rap-setup.finalizeProjectInternalPlan">> {
  void args;
  return fixtureWrite("finalizeProjectInternalPlan");
}

export async function createRapRevision(
  ...args: WebRpcArgs<"app/actions/project/revision-change-order.createRapRevision">
): Promise<WebRpcResult<"app/actions/project/revision-change-order.createRapRevision">> {
  void args;
  return fixtureWrite("createRapRevision");
}

export async function createCategoryPlanRevision(
  ...args: WebRpcArgs<"app/actions/project/revision-change-order.createCategoryPlanRevision">
): Promise<WebRpcResult<"app/actions/project/revision-change-order.createCategoryPlanRevision">> {
  void args;
  return fixtureWrite("createCategoryPlanRevision");
}

export async function refreshRabLinkedSources(
  ...args: WebRpcArgs<"app/actions/project/revision-change-order.refreshRabLinkedSources">
): Promise<WebRpcResult<"app/actions/project/revision-change-order.refreshRabLinkedSources">> {
  void args;
  return fixtureWrite("refreshRabLinkedSources");
}

export async function createProjectChangeOrder(
  ...args: WebRpcArgs<"app/actions/project/revision-change-order.createProjectChangeOrder">
): Promise<WebRpcResult<"app/actions/project/revision-change-order.createProjectChangeOrder">> {
  void args;
  return fixtureWrite("createProjectChangeOrder");
}

export async function confirmChangeOrderClient(
  ...args: WebRpcArgs<"app/actions/project/revision-change-order.confirmChangeOrderClient">
): Promise<WebRpcResult<"app/actions/project/revision-change-order.confirmChangeOrderClient">> {
  void args;
  return fixtureWrite("confirmChangeOrderClient");
}

export async function voidRabRevision(
  ...args: WebRpcArgs<"app/actions/project/revision-change-order.voidRabRevision">
): Promise<WebRpcResult<"app/actions/project/revision-change-order.voidRabRevision">> {
  void args;
  return fixtureWrite("voidRabRevision");
}

export async function approveProjectChangeOrder(
  ...args: WebRpcArgs<"app/actions/project/revision-change-order.approveProjectChangeOrder">
): Promise<WebRpcResult<"app/actions/project/revision-change-order.approveProjectChangeOrder">> {
  void args;
  return fixtureWrite("approveProjectChangeOrder");
}

export async function copyPricingTemplateToRap(
  ...args: WebRpcArgs<"app/actions/project/workflow-governance.copyPricingTemplateToRap">
): Promise<WebRpcResult<"app/actions/project/workflow-governance.copyPricingTemplateToRap">> {
  void args;
  return fixtureWrite("copyPricingTemplateToRap");
}

export async function copyPricingTemplateToCategoryPlan(
  ...args: WebRpcArgs<"app/actions/project/workflow-governance.copyPricingTemplateToCategoryPlan">
): Promise<
  WebRpcResult<"app/actions/project/workflow-governance.copyPricingTemplateToCategoryPlan">
> {
  void args;
  return fixtureWrite("copyPricingTemplateToCategoryPlan");
}
