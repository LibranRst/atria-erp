import "server-only";

import { callBackend } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/features/onboarding/server/get-quick-start-workspace-data";

export async function getQuickStartWorkspaceData(
  ...args: WebRpcArgs<"features/onboarding/server/get-quick-start-workspace-data.getQuickStartWorkspaceData">
): Promise<
  WebRpcResult<"features/onboarding/server/get-quick-start-workspace-data.getQuickStartWorkspaceData">
> {
  return callBackend(
    "features/onboarding/server/get-quick-start-workspace-data.getQuickStartWorkspaceData",
    args,
  );
}
