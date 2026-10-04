"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/organization-setup";

export async function getOrganizationSetupOverview(
  ...args: WebRpcArgs<"app/actions/organization-setup.getOrganizationSetupOverview">
): Promise<WebRpcResult<"app/actions/organization-setup.getOrganizationSetupOverview">> {
  return callBackendAction("app/actions/organization-setup.getOrganizationSetupOverview", args, {
    allowCookieWrites: true,
  });
}
