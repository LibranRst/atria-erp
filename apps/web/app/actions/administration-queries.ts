"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/administration-queries";

export async function getAdministrationOverview(
  ...args: WebRpcArgs<"app/actions/administration-queries.getAdministrationOverview">
): Promise<WebRpcResult<"app/actions/administration-queries.getAdministrationOverview">> {
  return callBackendAction("app/actions/administration-queries.getAdministrationOverview", args, {
    allowCookieWrites: true,
  });
}

export async function getProductionReadiness(
  ...args: WebRpcArgs<"app/actions/administration-queries.getProductionReadiness">
): Promise<WebRpcResult<"app/actions/administration-queries.getProductionReadiness">> {
  return callBackendAction("app/actions/administration-queries.getProductionReadiness", args, {
    allowCookieWrites: true,
  });
}
