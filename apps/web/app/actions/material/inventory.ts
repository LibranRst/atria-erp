"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/material/inventory";

export async function createMaterialCategory(
  ...args: WebRpcArgs<"app/actions/material/inventory.createMaterialCategory">
): Promise<WebRpcResult<"app/actions/material/inventory.createMaterialCategory">> {
  return callBackendAction("app/actions/material/inventory.createMaterialCategory", args, {
    allowCookieWrites: true,
  });
}

export async function createMaterial(
  ...args: WebRpcArgs<"app/actions/material/inventory.createMaterial">
): Promise<WebRpcResult<"app/actions/material/inventory.createMaterial">> {
  return callBackendAction("app/actions/material/inventory.createMaterial", args, {
    allowCookieWrites: true,
  });
}

export async function getMaterialInventory(
  ...args: WebRpcArgs<"app/actions/material/inventory.getMaterialInventory">
): Promise<WebRpcResult<"app/actions/material/inventory.getMaterialInventory">> {
  return callBackendAction("app/actions/material/inventory.getMaterialInventory", args, {
    allowCookieWrites: true,
  });
}

export async function recordStockIn(
  ...args: WebRpcArgs<"app/actions/material/inventory.recordStockIn">
): Promise<WebRpcResult<"app/actions/material/inventory.recordStockIn">> {
  return callBackendAction("app/actions/material/inventory.recordStockIn", args, {
    allowCookieWrites: true,
  });
}

export async function reserveMaterialForProject(
  ...args: WebRpcArgs<"app/actions/material/inventory.reserveMaterialForProject">
): Promise<WebRpcResult<"app/actions/material/inventory.reserveMaterialForProject">> {
  return callBackendAction("app/actions/material/inventory.reserveMaterialForProject", args, {
    allowCookieWrites: true,
  });
}

export async function wasteMaterialForProject(
  ...args: WebRpcArgs<"app/actions/material/inventory.wasteMaterialForProject">
): Promise<WebRpcResult<"app/actions/material/inventory.wasteMaterialForProject">> {
  return callBackendAction("app/actions/material/inventory.wasteMaterialForProject", args, {
    allowCookieWrites: true,
  });
}

export async function useMaterialForProject(
  ...args: WebRpcArgs<"app/actions/material/inventory.useMaterialForProject">
): Promise<WebRpcResult<"app/actions/material/inventory.useMaterialForProject">> {
  return callBackendAction("app/actions/material/inventory.useMaterialForProject", args, {
    allowCookieWrites: true,
  });
}

export async function returnMaterialFromProject(
  ...args: WebRpcArgs<"app/actions/material/inventory.returnMaterialFromProject">
): Promise<WebRpcResult<"app/actions/material/inventory.returnMaterialFromProject">> {
  return callBackendAction("app/actions/material/inventory.returnMaterialFromProject", args, {
    allowCookieWrites: true,
  });
}

export async function adjustMaterialStock(
  ...args: WebRpcArgs<"app/actions/material/inventory.adjustMaterialStock">
): Promise<WebRpcResult<"app/actions/material/inventory.adjustMaterialStock">> {
  return callBackendAction("app/actions/material/inventory.adjustMaterialStock", args, {
    allowCookieWrites: true,
  });
}

export async function getMaterialShortages(
  ...args: WebRpcArgs<"app/actions/material/inventory.getMaterialShortages">
): Promise<WebRpcResult<"app/actions/material/inventory.getMaterialShortages">> {
  return callBackendAction("app/actions/material/inventory.getMaterialShortages", args, {
    allowCookieWrites: true,
  });
}
