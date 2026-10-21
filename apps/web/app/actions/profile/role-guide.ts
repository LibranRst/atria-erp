"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";

export async function getOwnRoleGuide(): Promise<
  WebRpcResult<"app/actions/profile/role-guide.getOwnRoleGuide">
> {
  return callBackendAction("app/actions/profile/role-guide.getOwnRoleGuide", []);
}

export async function acknowledgeOwnRoleGuide(
  ...args: WebRpcArgs<"app/actions/profile/role-guide.acknowledgeOwnRoleGuide">
): Promise<WebRpcResult<"app/actions/profile/role-guide.acknowledgeOwnRoleGuide">> {
  return callBackendAction("app/actions/profile/role-guide.acknowledgeOwnRoleGuide", args);
}
