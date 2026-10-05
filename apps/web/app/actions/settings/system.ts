"use server";

import { callBackend, callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/settings/system";

export async function getItemPriceLibrary(
  ...args: WebRpcArgs<"app/actions/settings/system.getItemPriceLibrary">
): Promise<WebRpcResult<"app/actions/settings/system.getItemPriceLibrary">> {
  return callBackend("app/actions/settings/system.getItemPriceLibrary", args, {
    allowCookieWrites: true,
  });
}

export async function getSettingsHubOverview(
  ...args: WebRpcArgs<"app/actions/settings/system.getSettingsHubOverview">
): Promise<WebRpcResult<"app/actions/settings/system.getSettingsHubOverview">> {
  return callBackend("app/actions/settings/system.getSettingsHubOverview", args, {
    allowCookieWrites: true,
  });
}

export async function getBudgetSettings(
  ...args: WebRpcArgs<"app/actions/settings/system.getBudgetSettings">
): Promise<WebRpcResult<"app/actions/settings/system.getBudgetSettings">> {
  return callBackend("app/actions/settings/system.getBudgetSettings", args, {
    allowCookieWrites: true,
  });
}

export async function getExpenseCategorySettings(
  ...args: WebRpcArgs<"app/actions/settings/system.getExpenseCategorySettings">
): Promise<WebRpcResult<"app/actions/settings/system.getExpenseCategorySettings">> {
  return callBackend("app/actions/settings/system.getExpenseCategorySettings", args, {
    allowCookieWrites: true,
  });
}

export async function getItemLibrarySettings(
  ...args: WebRpcArgs<"app/actions/settings/system.getItemLibrarySettings">
): Promise<WebRpcResult<"app/actions/settings/system.getItemLibrarySettings">> {
  return callBackend("app/actions/settings/system.getItemLibrarySettings", args, {
    allowCookieWrites: true,
  });
}

export async function getMaterialSettings(
  ...args: WebRpcArgs<"app/actions/settings/system.getMaterialSettings">
): Promise<WebRpcResult<"app/actions/settings/system.getMaterialSettings">> {
  return callBackend("app/actions/settings/system.getMaterialSettings", args, {
    allowCookieWrites: true,
  });
}

export async function getSettingsOverview(
  ...args: WebRpcArgs<"app/actions/settings/system.getSettingsOverview">
): Promise<WebRpcResult<"app/actions/settings/system.getSettingsOverview">> {
  return callBackend("app/actions/settings/system.getSettingsOverview", args, {
    allowCookieWrites: true,
  });
}

export async function updateBudgetAllocationDefaults(
  ...args: WebRpcArgs<"app/actions/settings/system.updateBudgetAllocationDefaults">
): Promise<WebRpcResult<"app/actions/settings/system.updateBudgetAllocationDefaults">> {
  return callBackendAction("app/actions/settings/system.updateBudgetAllocationDefaults", args, {
    allowCookieWrites: true,
  });
}

export async function updateBudgetAllocationSetting(
  ...args: WebRpcArgs<"app/actions/settings/system.updateBudgetAllocationSetting">
): Promise<WebRpcResult<"app/actions/settings/system.updateBudgetAllocationSetting">> {
  return callBackendAction("app/actions/settings/system.updateBudgetAllocationSetting", args, {
    allowCookieWrites: true,
  });
}

export async function updateBudgetAllocationCategoryRatio(
  ...args: WebRpcArgs<"app/actions/settings/system.updateBudgetAllocationCategoryRatio">
): Promise<WebRpcResult<"app/actions/settings/system.updateBudgetAllocationCategoryRatio">> {
  return callBackendAction(
    "app/actions/settings/system.updateBudgetAllocationCategoryRatio",
    args,
    { allowCookieWrites: true },
  );
}

export async function updateExpenseCategorySetting(
  ...args: WebRpcArgs<"app/actions/settings/system.updateExpenseCategorySetting">
): Promise<WebRpcResult<"app/actions/settings/system.updateExpenseCategorySetting">> {
  return callBackendAction("app/actions/settings/system.updateExpenseCategorySetting", args, {
    allowCookieWrites: true,
  });
}

export async function updateExpenseCategoryDetails(
  ...args: WebRpcArgs<"app/actions/settings/system.updateExpenseCategoryDetails">
): Promise<WebRpcResult<"app/actions/settings/system.updateExpenseCategoryDetails">> {
  return callBackendAction("app/actions/settings/system.updateExpenseCategoryDetails", args, {
    allowCookieWrites: true,
  });
}

export async function createItemPriceLibraryItem(
  ...args: WebRpcArgs<"app/actions/settings/system.createItemPriceLibraryItem">
): Promise<WebRpcResult<"app/actions/settings/system.createItemPriceLibraryItem">> {
  return callBackendAction("app/actions/settings/system.createItemPriceLibraryItem", args, {
    allowCookieWrites: true,
  });
}

export async function updateItemPriceLibraryItem(
  ...args: WebRpcArgs<"app/actions/settings/system.updateItemPriceLibraryItem">
): Promise<WebRpcResult<"app/actions/settings/system.updateItemPriceLibraryItem">> {
  return callBackendAction("app/actions/settings/system.updateItemPriceLibraryItem", args, {
    allowCookieWrites: true,
  });
}

export async function archiveItemPriceLibraryItem(
  ...args: WebRpcArgs<"app/actions/settings/system.archiveItemPriceLibraryItem">
): Promise<WebRpcResult<"app/actions/settings/system.archiveItemPriceLibraryItem">> {
  return callBackendAction("app/actions/settings/system.archiveItemPriceLibraryItem", args, {
    allowCookieWrites: true,
  });
}

export async function setItemPriceLibraryItemActive(
  ...args: WebRpcArgs<"app/actions/settings/system.setItemPriceLibraryItemActive">
): Promise<WebRpcResult<"app/actions/settings/system.setItemPriceLibraryItemActive">> {
  return callBackendAction("app/actions/settings/system.setItemPriceLibraryItemActive", args, {
    allowCookieWrites: true,
  });
}

export async function updateMaterial(
  ...args: WebRpcArgs<"app/actions/settings/system.updateMaterial">
): Promise<WebRpcResult<"app/actions/settings/system.updateMaterial">> {
  return callBackendAction("app/actions/settings/system.updateMaterial", args, {
    allowCookieWrites: true,
  });
}

export async function updateMaterialInventoryDefaults(
  ...args: WebRpcArgs<"app/actions/settings/system.updateMaterialInventoryDefaults">
): Promise<WebRpcResult<"app/actions/settings/system.updateMaterialInventoryDefaults">> {
  return callBackendAction("app/actions/settings/system.updateMaterialInventoryDefaults", args, {
    allowCookieWrites: true,
  });
}

export async function archiveMaterial(
  ...args: WebRpcArgs<"app/actions/settings/system.archiveMaterial">
): Promise<WebRpcResult<"app/actions/settings/system.archiveMaterial">> {
  return callBackendAction("app/actions/settings/system.archiveMaterial", args, {
    allowCookieWrites: true,
  });
}

export async function createMaterialWithInventoryDefaults(
  ...args: WebRpcArgs<"app/actions/settings/system.createMaterialWithInventoryDefaults">
): Promise<WebRpcResult<"app/actions/settings/system.createMaterialWithInventoryDefaults">> {
  return callBackendAction(
    "app/actions/settings/system.createMaterialWithInventoryDefaults",
    args,
    { allowCookieWrites: true },
  );
}

export async function updateMaterialSettingDefaults(
  ...args: WebRpcArgs<"app/actions/settings/system.updateMaterialSettingDefaults">
): Promise<WebRpcResult<"app/actions/settings/system.updateMaterialSettingDefaults">> {
  return callBackendAction("app/actions/settings/system.updateMaterialSettingDefaults", args, {
    allowCookieWrites: true,
  });
}

export async function setMaterialActive(
  ...args: WebRpcArgs<"app/actions/settings/system.setMaterialActive">
): Promise<WebRpcResult<"app/actions/settings/system.setMaterialActive">> {
  return callBackendAction("app/actions/settings/system.setMaterialActive", args, {
    allowCookieWrites: true,
  });
}

export async function createMaterialCategorySetting(
  ...args: WebRpcArgs<"app/actions/settings/system.createMaterialCategorySetting">
): Promise<WebRpcResult<"app/actions/settings/system.createMaterialCategorySetting">> {
  return callBackendAction("app/actions/settings/system.createMaterialCategorySetting", args, {
    allowCookieWrites: true,
  });
}
