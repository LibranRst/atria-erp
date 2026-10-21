"use server";
import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export async function getAiCatalogSettingsProposal(
  ...args: WebRpcArgs<"app/actions/ai/catalog-settings.getAiCatalogSettingsProposal">
): Promise<WebRpcResult<"app/actions/ai/catalog-settings.getAiCatalogSettingsProposal">> {
  return callBackendAction("app/actions/ai/catalog-settings.getAiCatalogSettingsProposal", args, {
    allowCookieWrites: true,
  });
}
export async function confirmAiCatalogSettingsProposal(
  ...args: WebRpcArgs<"app/actions/ai/catalog-settings.confirmAiCatalogSettingsProposal">
): Promise<WebRpcResult<"app/actions/ai/catalog-settings.confirmAiCatalogSettingsProposal">> {
  return callBackendAction(
    "app/actions/ai/catalog-settings.confirmAiCatalogSettingsProposal",
    args,
    { allowCookieWrites: true },
  );
}
