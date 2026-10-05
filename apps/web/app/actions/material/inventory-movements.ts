"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/material/inventory-movements";

export async function recordStockIn(
  ...args: WebRpcArgs<"app/actions/material/inventory-movements.recordStockIn">
): Promise<WebRpcResult<"app/actions/material/inventory-movements.recordStockIn">> {
  return callBackendAction("app/actions/material/inventory-movements.recordStockIn", args, {
    allowCookieWrites: true,
  });
}

export async function reserveMaterialForProject(
  ...args: WebRpcArgs<"app/actions/material/inventory-movements.reserveMaterialForProject">
): Promise<WebRpcResult<"app/actions/material/inventory-movements.reserveMaterialForProject">> {
  return callBackendAction(
    "app/actions/material/inventory-movements.reserveMaterialForProject",
    args,
    { allowCookieWrites: true },
  );
}

export async function wasteMaterialForProject(
  ...args: WebRpcArgs<"app/actions/material/inventory-movements.wasteMaterialForProject">
): Promise<WebRpcResult<"app/actions/material/inventory-movements.wasteMaterialForProject">> {
  return callBackendAction(
    "app/actions/material/inventory-movements.wasteMaterialForProject",
    args,
    { allowCookieWrites: true },
  );
}

export async function useMaterialForProject(
  ...args: WebRpcArgs<"app/actions/material/inventory-movements.useMaterialForProject">
): Promise<WebRpcResult<"app/actions/material/inventory-movements.useMaterialForProject">> {
  return callBackendAction("app/actions/material/inventory-movements.useMaterialForProject", args, {
    allowCookieWrites: true,
  });
}

export async function returnMaterialFromProject(
  ...args: WebRpcArgs<"app/actions/material/inventory-movements.returnMaterialFromProject">
): Promise<WebRpcResult<"app/actions/material/inventory-movements.returnMaterialFromProject">> {
  return callBackendAction(
    "app/actions/material/inventory-movements.returnMaterialFromProject",
    args,
    { allowCookieWrites: true },
  );
}

export async function adjustMaterialStock(
  ...args: WebRpcArgs<"app/actions/material/inventory-movements.adjustMaterialStock">
): Promise<WebRpcResult<"app/actions/material/inventory-movements.adjustMaterialStock">> {
  return callBackendAction("app/actions/material/inventory-movements.adjustMaterialStock", args, {
    allowCookieWrites: true,
  });
}
