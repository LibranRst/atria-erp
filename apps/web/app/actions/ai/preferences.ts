"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/ai/preferences";

export async function getAiPreference(
  ...args: WebRpcArgs<"app/actions/ai/preferences.getAiPreference">
): Promise<WebRpcResult<"app/actions/ai/preferences.getAiPreference">> {
  return callBackendAction("app/actions/ai/preferences.getAiPreference", args, {
    allowCookieWrites: true,
  });
}

export async function saveAiPreference(
  ...args: WebRpcArgs<"app/actions/ai/preferences.saveAiPreference">
): Promise<WebRpcResult<"app/actions/ai/preferences.saveAiPreference">> {
  return callBackendAction("app/actions/ai/preferences.saveAiPreference", args, {
    allowCookieWrites: true,
  });
}

export async function resetAiPreference(
  ...args: WebRpcArgs<"app/actions/ai/preferences.resetAiPreference">
): Promise<WebRpcResult<"app/actions/ai/preferences.resetAiPreference">> {
  return callBackendAction("app/actions/ai/preferences.resetAiPreference", args, {
    allowCookieWrites: true,
  });
}
