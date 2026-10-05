"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/material/inventory-project-movements";

export async function wasteMaterialForProject(
  ...args: WebRpcArgs<"app/actions/material/inventory-project-movements.wasteMaterialForProject">
): Promise<
  WebRpcResult<"app/actions/material/inventory-project-movements.wasteMaterialForProject">
> {
  return callBackendAction(
    "app/actions/material/inventory-project-movements.wasteMaterialForProject",
    args,
    { allowCookieWrites: true },
  );
}

export async function useMaterialForProject(
  ...args: WebRpcArgs<"app/actions/material/inventory-project-movements.useMaterialForProject">
): Promise<WebRpcResult<"app/actions/material/inventory-project-movements.useMaterialForProject">> {
  return callBackendAction(
    "app/actions/material/inventory-project-movements.useMaterialForProject",
    args,
    { allowCookieWrites: true },
  );
}

export async function returnMaterialFromProject(
  ...args: WebRpcArgs<"app/actions/material/inventory-project-movements.returnMaterialFromProject">
): Promise<
  WebRpcResult<"app/actions/material/inventory-project-movements.returnMaterialFromProject">
> {
  return callBackendAction(
    "app/actions/material/inventory-project-movements.returnMaterialFromProject",
    args,
    { allowCookieWrites: true },
  );
}
