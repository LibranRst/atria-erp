import "server-only";

import { callBackend } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/features/settings/server/get-settings-page-data";

export async function getSettingsPageData(
  ...args: WebRpcArgs<"features/settings/server/get-settings-page-data.getSettingsPageData">
): Promise<WebRpcResult<"features/settings/server/get-settings-page-data.getSettingsPageData">> {
  return callBackend("features/settings/server/get-settings-page-data.getSettingsPageData", args);
}
