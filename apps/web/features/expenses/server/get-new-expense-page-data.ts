import "server-only";

import { callBackend } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/features/expenses/server/get-new-expense-page-data";

export async function getNewExpensePageData(
  ...args: WebRpcArgs<"features/expenses/server/get-new-expense-page-data.getNewExpensePageData">
): Promise<
  WebRpcResult<"features/expenses/server/get-new-expense-page-data.getNewExpensePageData">
> {
  return callBackend(
    "features/expenses/server/get-new-expense-page-data.getNewExpensePageData",
    args,
  );
}
