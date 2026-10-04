"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/ai/confirm-expense-proposal";

export async function confirmAiExpenseProposal(
  ...args: WebRpcArgs<"app/actions/ai/confirm-expense-proposal.confirmAiExpenseProposal">
): Promise<WebRpcResult<"app/actions/ai/confirm-expense-proposal.confirmAiExpenseProposal">> {
  return callBackendAction(
    "app/actions/ai/confirm-expense-proposal.confirmAiExpenseProposal",
    args,
    { allowCookieWrites: true },
  );
}

export async function confirmAiExpenseReviewProposal(
  ...args: WebRpcArgs<"app/actions/ai/confirm-expense-proposal.confirmAiExpenseReviewProposal">
): Promise<WebRpcResult<"app/actions/ai/confirm-expense-proposal.confirmAiExpenseReviewProposal">> {
  return callBackendAction(
    "app/actions/ai/confirm-expense-proposal.confirmAiExpenseReviewProposal",
    args,
    { allowCookieWrites: true },
  );
}

export async function confirmAiDisburseExpenseProposal(
  ...args: WebRpcArgs<"app/actions/ai/confirm-expense-proposal.confirmAiDisburseExpenseProposal">
): Promise<
  WebRpcResult<"app/actions/ai/confirm-expense-proposal.confirmAiDisburseExpenseProposal">
> {
  return callBackendAction(
    "app/actions/ai/confirm-expense-proposal.confirmAiDisburseExpenseProposal",
    args,
    { allowCookieWrites: true },
  );
}
