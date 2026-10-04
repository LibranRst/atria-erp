"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/settings/system-materials";

export async function updateMaterial(
  ...args: WebRpcArgs<"app/actions/settings/system-materials.updateMaterial">
): Promise<WebRpcResult<"app/actions/settings/system-materials.updateMaterial">> {
  return callBackendAction("app/actions/settings/system-materials.updateMaterial", args, {
    allowCookieWrites: true,
  });
}

export async function updateMaterialInventoryDefaults(
  ...args: WebRpcArgs<"app/actions/settings/system-materials.updateMaterialInventoryDefaults">
): Promise<WebRpcResult<"app/actions/settings/system-materials.updateMaterialInventoryDefaults">> {
  return callBackendAction(
    "app/actions/settings/system-materials.updateMaterialInventoryDefaults",
    args,
    { allowCookieWrites: true },
  );
}

export async function archiveMaterial(
  ...args: WebRpcArgs<"app/actions/settings/system-materials.archiveMaterial">
): Promise<WebRpcResult<"app/actions/settings/system-materials.archiveMaterial">> {
  return callBackendAction("app/actions/settings/system-materials.archiveMaterial", args, {
    allowCookieWrites: true,
  });
}

export async function createMaterialWithInventoryDefaults(
  ...args: WebRpcArgs<"app/actions/settings/system-materials.createMaterialWithInventoryDefaults">
): Promise<
  WebRpcResult<"app/actions/settings/system-materials.createMaterialWithInventoryDefaults">
> {
  return callBackendAction(
    "app/actions/settings/system-materials.createMaterialWithInventoryDefaults",
    args,
    { allowCookieWrites: true },
  );
}

export async function updateMaterialSettingDefaults(
  ...args: WebRpcArgs<"app/actions/settings/system-materials.updateMaterialSettingDefaults">
): Promise<WebRpcResult<"app/actions/settings/system-materials.updateMaterialSettingDefaults">> {
  return callBackendAction(
    "app/actions/settings/system-materials.updateMaterialSettingDefaults",
    args,
    { allowCookieWrites: true },
  );
}

export async function setMaterialActive(
  ...args: WebRpcArgs<"app/actions/settings/system-materials.setMaterialActive">
): Promise<WebRpcResult<"app/actions/settings/system-materials.setMaterialActive">> {
  return callBackendAction("app/actions/settings/system-materials.setMaterialActive", args, {
    allowCookieWrites: true,
  });
}

export async function createMaterialCategorySetting(
  ...args: WebRpcArgs<"app/actions/settings/system-materials.createMaterialCategorySetting">
): Promise<WebRpcResult<"app/actions/settings/system-materials.createMaterialCategorySetting">> {
  return callBackendAction(
    "app/actions/settings/system-materials.createMaterialCategorySetting",
    args,
    { allowCookieWrites: true },
  );
}
