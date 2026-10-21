"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/ai/confirm-finance-proposal";

export async function confirmAiPayVendorBillProposal(
  ...args: WebRpcArgs<"app/actions/ai/confirm-finance-proposal.confirmAiPayVendorBillProposal">
): Promise<WebRpcResult<"app/actions/ai/confirm-finance-proposal.confirmAiPayVendorBillProposal">> {
  return callBackendAction(
    "app/actions/ai/confirm-finance-proposal.confirmAiPayVendorBillProposal",
    args,
    { allowCookieWrites: true },
  );
}

export async function confirmAiRecordClientPaymentProposal(
  ...args: WebRpcArgs<"app/actions/ai/confirm-finance-proposal.confirmAiRecordClientPaymentProposal">
): Promise<
  WebRpcResult<"app/actions/ai/confirm-finance-proposal.confirmAiRecordClientPaymentProposal">
> {
  return callBackendAction(
    "app/actions/ai/confirm-finance-proposal.confirmAiRecordClientPaymentProposal",
    args,
    { allowCookieWrites: true },
  );
}
