import "server-only";

import { callBackend } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/features/projects/detail/server/get-project-detail-data";

export async function getProjectDetailData(
  ...args: WebRpcArgs<"features/projects/detail/server/get-project-detail-data.getProjectDetailData">
): Promise<
  WebRpcResult<"features/projects/detail/server/get-project-detail-data.getProjectDetailData">
> {
  return callBackend(
    "features/projects/detail/server/get-project-detail-data.getProjectDetailData",
    args,
  );
}
