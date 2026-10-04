"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/project/budget-expense-options";

export async function getActiveProjectsForExpense(
  ...args: WebRpcArgs<"app/actions/project/budget-expense-options.getActiveProjectsForExpense">
): Promise<WebRpcResult<"app/actions/project/budget-expense-options.getActiveProjectsForExpense">> {
  return callBackendAction(
    "app/actions/project/budget-expense-options.getActiveProjectsForExpense",
    args,
    { allowCookieWrites: true },
  );
}
