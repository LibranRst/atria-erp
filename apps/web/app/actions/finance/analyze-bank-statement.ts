"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/finance/analyze-bank-statement";

export async function analyzeBankStatement(
  ...args: WebRpcArgs<"app/actions/finance/analyze-bank-statement.analyzeBankStatement">
): Promise<WebRpcResult<"app/actions/finance/analyze-bank-statement.analyzeBankStatement">> {
  return callBackendAction(
    "app/actions/finance/analyze-bank-statement.analyzeBankStatement",
    args,
    { allowCookieWrites: true },
  );
}
