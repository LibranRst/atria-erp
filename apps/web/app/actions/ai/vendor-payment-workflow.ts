"use server";
import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export async function getAiVendorPaymentWorkflowProposal(
  ...args: WebRpcArgs<"app/actions/ai/vendor-payment-workflow.getAiVendorPaymentWorkflowProposal">
): Promise<
  WebRpcResult<"app/actions/ai/vendor-payment-workflow.getAiVendorPaymentWorkflowProposal">
> {
  return callBackendAction(
    "app/actions/ai/vendor-payment-workflow.getAiVendorPaymentWorkflowProposal",
    args,
    { allowCookieWrites: true },
  );
}
export async function confirmAiVendorPaymentWorkflowProposal(
  ...args: WebRpcArgs<"app/actions/ai/vendor-payment-workflow.confirmAiVendorPaymentWorkflowProposal">
): Promise<
  WebRpcResult<"app/actions/ai/vendor-payment-workflow.confirmAiVendorPaymentWorkflowProposal">
> {
  return callBackendAction(
    "app/actions/ai/vendor-payment-workflow.confirmAiVendorPaymentWorkflowProposal",
    args,
    { allowCookieWrites: true },
  );
}
