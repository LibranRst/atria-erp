"use server";
import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export async function getAiRabDraftProposal(
  ...args: WebRpcArgs<"app/actions/ai/rab-draft.getAiRabDraftProposal">
): Promise<WebRpcResult<"app/actions/ai/rab-draft.getAiRabDraftProposal">> {
  return callBackendAction("app/actions/ai/rab-draft.getAiRabDraftProposal", args, {
    allowCookieWrites: true,
  });
}
export async function patchAiRabDraftProposal(
  ...args: WebRpcArgs<"app/actions/ai/rab-draft.patchAiRabDraftProposal">
): Promise<WebRpcResult<"app/actions/ai/rab-draft.patchAiRabDraftProposal">> {
  return callBackendAction("app/actions/ai/rab-draft.patchAiRabDraftProposal", args, {
    allowCookieWrites: true,
  });
}
export async function confirmAiRabDraftProposal(
  ...args: WebRpcArgs<"app/actions/ai/rab-draft.confirmAiRabDraftProposal">
): Promise<WebRpcResult<"app/actions/ai/rab-draft.confirmAiRabDraftProposal">> {
  return callBackendAction("app/actions/ai/rab-draft.confirmAiRabDraftProposal", args, {
    allowCookieWrites: true,
  });
}
