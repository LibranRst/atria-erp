"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/ai/confirm-bank-reconciliation-proposal";

export async function confirmAiBankReconciliationProposal(
  ...args: WebRpcArgs<"app/actions/ai/confirm-bank-reconciliation-proposal.confirmAiBankReconciliationProposal">
): Promise<
  WebRpcResult<"app/actions/ai/confirm-bank-reconciliation-proposal.confirmAiBankReconciliationProposal">
> {
  return callBackendAction(
    "app/actions/ai/confirm-bank-reconciliation-proposal.confirmAiBankReconciliationProposal",
    args,
    { allowCookieWrites: true },
  );
}
