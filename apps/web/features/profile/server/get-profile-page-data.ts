import "server-only";

import { callBackend } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/features/profile/server/get-profile-page-data";

export async function getProfilePageData(
  ...args: WebRpcArgs<"features/profile/server/get-profile-page-data.getProfilePageData">
): Promise<WebRpcResult<"features/profile/server/get-profile-page-data.getProfilePageData">> {
  return callBackend("features/profile/server/get-profile-page-data.getProfilePageData", args);
}
