import type { ManagedRole } from "@/server/usecases/administration/roles";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  SETTINGS_FIXTURE_ADMINISTRATION,
  SETTINGS_FIXTURE_OVERVIEW,
  SETTINGS_FIXTURE_ROLES,
  type SettingsFixtureScenario,
} from "./settings-data.fixture";
export { decideInventoryOpening } from "./approvals-actions.fixture";

let scenario: SettingsFixtureScenario = "complete";
export function setSettingsFixtureScenario(next: SettingsFixtureScenario): void {
  scenario = next;
}
async function fixtureWrite(): Promise<ActionResponse<never>> {
  return {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Fixture visual: tindakan ini tidak menyimpan data atau menghubungi backend.",
    },
  };
}
export async function listManagedRoles(): Promise<ActionResponse<readonly ManagedRole[]>> {
  if (scenario === "roles-error")
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Fixture kegagalan: peran belum dapat dimuat. Coba muat ulang.",
      },
    };
  if (scenario === "roles-loading")
    await new Promise<void>((resolve) => setTimeout(resolve, 10_000));
  return { success: true, data: SETTINGS_FIXTURE_ROLES };
}
export async function getAdministrationOverview(): Promise<
  ActionResponse<typeof SETTINGS_FIXTURE_ADMINISTRATION>
> {
  return { success: true, data: SETTINGS_FIXTURE_ADMINISTRATION };
}
export async function getMaterialSettings(): Promise<
  ActionResponse<typeof SETTINGS_FIXTURE_OVERVIEW>
> {
  return { success: true, data: SETTINGS_FIXTURE_OVERVIEW };
}
export {
  fixtureWrite as updateBudgetAllocationDefaults,
  fixtureWrite as updateBudgetAllocationSetting,
  fixtureWrite as updateBudgetAllocationCategoryRatio,
  fixtureWrite as updateExpenseCategoryDetails,
  fixtureWrite as updateExpenseCategorySetting,
  fixtureWrite as updateApprovalThresholds,
  fixtureWrite as createMaterialCategorySetting,
  fixtureWrite as createMaterialWithInventoryDefaults,
  fixtureWrite as setMaterialActive,
  fixtureWrite as updateMaterial,
  fixtureWrite as updateMaterialSettingDefaults,
  fixtureWrite as updateMaterialInventoryDefaults,
  fixtureWrite as archiveMaterial,
  fixtureWrite as setItemPriceLibraryItemActive,
  fixtureWrite as createItemPriceLibraryItem,
  fixtureWrite as updateItemPriceLibraryItem,
  fixtureWrite as archiveItemPriceLibraryItem,
  fixtureWrite as upsertPricingTemplate,
  fixtureWrite as previewMaterialImport,
  fixtureWrite as commitMaterialImport,
  fixtureWrite as createStaffUser,
  fixtureWrite as updateStaffUser,
  fixtureWrite as saveVendor,
  fixtureWrite as setVendorActive,
  fixtureWrite as createRole,
  fixtureWrite as updateRoleDetails,
  fixtureWrite as updateRolePermissions,
  fixtureWrite as deleteRole,
  fixtureWrite as bootstrapFirstOwner,
  fixtureWrite as changeTemporaryPassword,
  fixtureWrite as createInventoryOpening,
  fixtureWrite as reverseInventoryOpening,
  fixtureWrite as previewInitialStockImport,
  fixtureWrite as getInitialStockCandidates,
  fixtureWrite as getInventoryOpeningBatches,
  fixtureWrite as setInitialStockReadinessDecision,
  fixtureWrite as startDeveloperAccountSimulation,
  fixtureWrite as stopDeveloperAccountSimulation,
};
