"use server";
import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export async function getAiRabWorkflowProposal(
  ...args: WebRpcArgs<"app/actions/ai/rab-workflow.getAiRabWorkflowProposal">
): Promise<WebRpcResult<"app/actions/ai/rab-workflow.getAiRabWorkflowProposal">> {
  return callBackendAction("app/actions/ai/rab-workflow.getAiRabWorkflowProposal", args, {
    allowCookieWrites: true,
  });
}
export async function confirmAiRabWorkflowProposal(
  ...args: WebRpcArgs<"app/actions/ai/rab-workflow.confirmAiRabWorkflowProposal">
): Promise<WebRpcResult<"app/actions/ai/rab-workflow.confirmAiRabWorkflowProposal">> {
  return callBackendAction("app/actions/ai/rab-workflow.confirmAiRabWorkflowProposal", args, {
    allowCookieWrites: true,
  });
}
