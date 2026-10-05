"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/ai/confirm-create-role-proposal";

export async function confirmAiCreateRoleProposal(
  ...args: WebRpcArgs<"app/actions/ai/confirm-create-role-proposal.confirmAiCreateRoleProposal">
): Promise<
  WebRpcResult<"app/actions/ai/confirm-create-role-proposal.confirmAiCreateRoleProposal">
> {
  return callBackendAction(
    "app/actions/ai/confirm-create-role-proposal.confirmAiCreateRoleProposal",
    args,
    { allowCookieWrites: true },
  );
}
