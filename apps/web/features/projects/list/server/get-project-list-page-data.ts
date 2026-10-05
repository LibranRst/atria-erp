import "server-only";

import { callBackend } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/features/projects/list/server/get-project-list-page-data";

export async function getProjectListPageData(
  ...args: WebRpcArgs<"features/projects/list/server/get-project-list-page-data.getProjectListPageData">
): Promise<
  WebRpcResult<"features/projects/list/server/get-project-list-page-data.getProjectListPageData">
> {
  return callBackend(
    "features/projects/list/server/get-project-list-page-data.getProjectListPageData",
    args,
  );
}
