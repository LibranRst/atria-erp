"use server";

import type { ActionResponse } from "@atria/core/types/action-response";
import {
  type ArchiveItemPriceLibraryItemInput,
  type ArchiveMaterialInput,
  type CreateMaterialCategorySettingInput,
  type CreateMaterialWithInventoryDefaultsInput,
  type CreateItemPriceLibraryItemInput,
  type SetItemPriceLibraryItemActiveInput,
  type SetMaterialActiveInput,
  type UpdateBudgetAllocationDefaultsInput,
  type UpdateBudgetAllocationCategoryRatioInput,
  type UpdateBudgetAllocationSettingInput,
  type UpdateExpenseCategoryDetailsInput,
  type UpdateExpenseCategorySettingInput,
  type UpdateItemPriceLibraryItemInput,
  type UpdateMaterialInput,
  type UpdateMaterialInventoryDefaultsInput,
  type UpdateMaterialSettingDefaultsInput,
} from "@atria/core/validations/settings";
import type {
  BudgetAllocationCategoryRow,
  BudgetAllocationSettingRow,
  ExpenseCategorySettingRow,
  ItemPriceLibraryRow,
  MaterialInventorySettingRow,
  MaterialSettingRow,
} from "./system-types";
import {
  updateBudgetAllocationCategoryRatio as updateBudgetAllocationCategoryRatioWrite,
  updateBudgetAllocationDefaults as updateBudgetAllocationDefaultsWrite,
  updateBudgetAllocationSetting as updateBudgetAllocationSettingWrite,
  updateExpenseCategoryDetails as updateExpenseCategoryDetailsWrite,
  updateExpenseCategorySetting as updateExpenseCategorySettingWrite,
} from "./system-budget-expense";
import {
  archiveItemPriceLibraryItem as archiveItemPriceLibraryItemWrite,
  createItemPriceLibraryItem as createItemPriceLibraryItemWrite,
  setItemPriceLibraryItemActive as setItemPriceLibraryItemActiveWrite,
  updateItemPriceLibraryItem as updateItemPriceLibraryItemWrite,
} from "./system-item-library";
import {
  archiveMaterial as archiveMaterialWrite,
  createMaterialCategorySetting as createMaterialCategorySettingWrite,
  createMaterialWithInventoryDefaults as createMaterialWithInventoryDefaultsWrite,
  setMaterialActive as setMaterialActiveWrite,
  updateMaterial as updateMaterialWrite,
  updateMaterialInventoryDefaults as updateMaterialInventoryDefaultsWrite,
  updateMaterialSettingDefaults as updateMaterialSettingDefaultsWrite,
} from "./system-materials";
import {
  getBudgetSettings as getBudgetSettingsRead,
  getExpenseCategorySettings as getExpenseCategorySettingsRead,
  getItemLibrarySettings as getItemLibrarySettingsRead,
  getItemPriceLibrary as getItemPriceLibraryRead,
  getMaterialSettings as getMaterialSettingsRead,
  getSettingsHubOverview as getSettingsHubOverviewRead,
  getSettingsOverview as getSettingsOverviewRead,
} from "./system-read";
export type {
  BudgetAllocationCategoryRow,
  BudgetAllocationSettingRow,
  BudgetSettingsData,
  ExpenseCategorySettingRow,
  ExpenseCategorySettingsData,
  ItemLibrarySettingsData,
  ItemPriceLibraryRow,
  MaterialInventorySettingRow,
  MaterialSettingsData,
  MaterialSettingRow,
  SettingsContext,
  SettingsHubOverview,
  SettingsOverview,
  SettingsPermissionState,
} from "./system-types";
export async function getItemPriceLibrary(
  input?: Parameters<typeof getItemPriceLibraryRead>[0],
): ReturnType<typeof getItemPriceLibraryRead> {
  return getItemPriceLibraryRead(input);
}

export async function getSettingsHubOverview(): ReturnType<typeof getSettingsHubOverviewRead> {
  return getSettingsHubOverviewRead();
}

export async function getBudgetSettings(): ReturnType<typeof getBudgetSettingsRead> {
  return getBudgetSettingsRead();
}

export async function getExpenseCategorySettings(): ReturnType<
  typeof getExpenseCategorySettingsRead
> {
  return getExpenseCategorySettingsRead();
}

export async function getItemLibrarySettings(): ReturnType<typeof getItemLibrarySettingsRead> {
  return getItemLibrarySettingsRead();
}

export async function getMaterialSettings(): ReturnType<typeof getMaterialSettingsRead> {
  return getMaterialSettingsRead();
}

export async function getSettingsOverview(): ReturnType<typeof getSettingsOverviewRead> {
  return getSettingsOverviewRead();
}

export async function updateBudgetAllocationDefaults(
  input: UpdateBudgetAllocationDefaultsInput,
): Promise<ActionResponse<BudgetAllocationSettingRow>> {
  return updateBudgetAllocationDefaultsWrite(input);
}

export async function updateBudgetAllocationSetting(
  input: UpdateBudgetAllocationSettingInput,
): Promise<ActionResponse<BudgetAllocationSettingRow>> {
  return updateBudgetAllocationSettingWrite(input);
}

export async function updateBudgetAllocationCategoryRatio(
  input: UpdateBudgetAllocationCategoryRatioInput,
): Promise<ActionResponse<BudgetAllocationCategoryRow>> {
  return updateBudgetAllocationCategoryRatioWrite(input);
}

export async function updateExpenseCategorySetting(
  input: UpdateExpenseCategorySettingInput,
): Promise<ActionResponse<ExpenseCategorySettingRow>> {
  return updateExpenseCategorySettingWrite(input);
}

export async function updateExpenseCategoryDetails(
  input: UpdateExpenseCategoryDetailsInput,
): Promise<ActionResponse<ExpenseCategorySettingRow>> {
  return updateExpenseCategoryDetailsWrite(input);
}

export async function createItemPriceLibraryItem(
  input: CreateItemPriceLibraryItemInput,
): Promise<ActionResponse<ItemPriceLibraryRow>> {
  return createItemPriceLibraryItemWrite(input);
}

export async function updateItemPriceLibraryItem(
  input: UpdateItemPriceLibraryItemInput,
): Promise<ActionResponse<ItemPriceLibraryRow>> {
  return updateItemPriceLibraryItemWrite(input);
}

export async function archiveItemPriceLibraryItem(
  input: ArchiveItemPriceLibraryItemInput,
): Promise<ActionResponse<{ readonly id: string }>> {
  return archiveItemPriceLibraryItemWrite(input);
}

export async function setItemPriceLibraryItemActive(
  input: SetItemPriceLibraryItemActiveInput,
): Promise<ActionResponse<{ readonly id: string; readonly isActive: boolean }>> {
  return setItemPriceLibraryItemActiveWrite(input);
}

export async function updateMaterial(
  input: UpdateMaterialInput,
): Promise<ActionResponse<MaterialSettingRow>> {
  return updateMaterialWrite(input);
}

export async function updateMaterialInventoryDefaults(
  input: UpdateMaterialInventoryDefaultsInput,
): Promise<ActionResponse<MaterialInventorySettingRow>> {
  return updateMaterialInventoryDefaultsWrite(input);
}

export async function archiveMaterial(
  input: ArchiveMaterialInput,
): Promise<ActionResponse<{ readonly id: string }>> {
  return archiveMaterialWrite(input);
}

export async function createMaterialWithInventoryDefaults(
  input: CreateMaterialWithInventoryDefaultsInput,
): Promise<ActionResponse<{ readonly id: string }>> {
  return createMaterialWithInventoryDefaultsWrite(input);
}

export async function updateMaterialSettingDefaults(
  input: UpdateMaterialSettingDefaultsInput,
): Promise<ActionResponse<MaterialInventorySettingRow>> {
  return updateMaterialSettingDefaultsWrite(input);
}

export async function setMaterialActive(
  input: SetMaterialActiveInput,
): Promise<ActionResponse<{ readonly id: string; readonly isActive: boolean }>> {
  return setMaterialActiveWrite(input);
}

export async function createMaterialCategorySetting(
  input: CreateMaterialCategorySettingInput,
): Promise<ActionResponse<{ readonly id: string; readonly name: string }>> {
  return createMaterialCategorySettingWrite(input);
}
