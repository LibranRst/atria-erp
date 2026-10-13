"use server";
import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export async function getAiProjectManagementProposal(
  ...args: WebRpcArgs<"app/actions/ai/project-management.getAiProjectManagementProposal">
): Promise<WebRpcResult<"app/actions/ai/project-management.getAiProjectManagementProposal">> {
  return callBackendAction(
    "app/actions/ai/project-management.getAiProjectManagementProposal",
    args,
    {
      allowCookieWrites: true,
    },
  );
}
export async function confirmAiProjectManagementProposal(
  ...args: WebRpcArgs<"app/actions/ai/project-management.confirmAiProjectManagementProposal">
): Promise<WebRpcResult<"app/actions/ai/project-management.confirmAiProjectManagementProposal">> {
  return callBackendAction(
    "app/actions/ai/project-management.confirmAiProjectManagementProposal",
    args,
    { allowCookieWrites: true },
  );
}
