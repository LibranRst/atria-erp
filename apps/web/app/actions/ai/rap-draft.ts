"use server";
import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export async function getAiRapDraftProposal(
  ...args: WebRpcArgs<"app/actions/ai/rap-draft.getAiRapDraftProposal">
): Promise<WebRpcResult<"app/actions/ai/rap-draft.getAiRapDraftProposal">> {
  return callBackendAction("app/actions/ai/rap-draft.getAiRapDraftProposal", args, {
    allowCookieWrites: true,
  });
}
export async function confirmAiRapDraftProposal(
  ...args: WebRpcArgs<"app/actions/ai/rap-draft.confirmAiRapDraftProposal">
): Promise<WebRpcResult<"app/actions/ai/rap-draft.confirmAiRapDraftProposal">> {
  return callBackendAction("app/actions/ai/rap-draft.confirmAiRapDraftProposal", args, {
    allowCookieWrites: true,
  });
}

export async function patchAiRapDraftProposal(
  ...args: WebRpcArgs<"app/actions/ai/rap-draft.patchAiRapDraftProposal">
): Promise<WebRpcResult<"app/actions/ai/rap-draft.patchAiRapDraftProposal">> {
  return callBackendAction("app/actions/ai/rap-draft.patchAiRapDraftProposal", args, {
    allowCookieWrites: true,
  });
}
