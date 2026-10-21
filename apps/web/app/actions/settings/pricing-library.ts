"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/settings/pricing-library";

export async function getPricingTemplates(
  ...args: WebRpcArgs<"app/actions/settings/pricing-library.getPricingTemplates">
): Promise<WebRpcResult<"app/actions/settings/pricing-library.getPricingTemplates">> {
  return callBackendAction("app/actions/settings/pricing-library.getPricingTemplates", args, {
    allowCookieWrites: true,
  });
}

export async function upsertPricingTemplate(
  ...args: WebRpcArgs<"app/actions/settings/pricing-library.upsertPricingTemplate">
): Promise<WebRpcResult<"app/actions/settings/pricing-library.upsertPricingTemplate">> {
  return callBackendAction("app/actions/settings/pricing-library.upsertPricingTemplate", args, {
    allowCookieWrites: true,
  });
}
