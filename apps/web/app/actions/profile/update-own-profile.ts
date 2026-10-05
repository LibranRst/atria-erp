"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/profile/update-own-profile";

export async function updateOwnProfile(
  ...args: WebRpcArgs<"app/actions/profile/update-own-profile.updateOwnProfile">
): Promise<WebRpcResult<"app/actions/profile/update-own-profile.updateOwnProfile">> {
  return callBackendAction("app/actions/profile/update-own-profile.updateOwnProfile", args, {
    allowCookieWrites: true,
  });
}
