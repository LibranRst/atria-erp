"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/ai/confirm-project-proposal";

export async function confirmAiCreateProjectProposal(
  ...args: WebRpcArgs<"app/actions/ai/confirm-project-proposal.confirmAiCreateProjectProposal">
): Promise<WebRpcResult<"app/actions/ai/confirm-project-proposal.confirmAiCreateProjectProposal">> {
  return callBackendAction(
    "app/actions/ai/confirm-project-proposal.confirmAiCreateProjectProposal",
    args,
    { allowCookieWrites: true },
  );
}

export async function confirmAiSetupBudgetProposal(
  ...args: WebRpcArgs<"app/actions/ai/confirm-project-proposal.confirmAiSetupBudgetProposal">
): Promise<WebRpcResult<"app/actions/ai/confirm-project-proposal.confirmAiSetupBudgetProposal">> {
  return callBackendAction(
    "app/actions/ai/confirm-project-proposal.confirmAiSetupBudgetProposal",
    args,
    { allowCookieWrites: true },
  );
}
