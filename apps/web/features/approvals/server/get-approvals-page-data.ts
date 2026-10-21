import "server-only";

import { callBackend } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/features/approvals/server/get-approvals-page-data";

export async function getApprovalsPageData(
  ...args: WebRpcArgs<"features/approvals/server/get-approvals-page-data.getApprovalsPageData">
): Promise<WebRpcResult<"features/approvals/server/get-approvals-page-data.getApprovalsPageData">> {
  return callBackend(
    "features/approvals/server/get-approvals-page-data.getApprovalsPageData",
    args,
  );
}
