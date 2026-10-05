import "server-only";

import { callBackend } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/features/expenses/server/get-expenses-page-data";

export async function getExpensesPageData(
  ...args: WebRpcArgs<"features/expenses/server/get-expenses-page-data.getExpensesPageData">
): Promise<WebRpcResult<"features/expenses/server/get-expenses-page-data.getExpensesPageData">> {
  return callBackend("features/expenses/server/get-expenses-page-data.getExpensesPageData", args);
}
