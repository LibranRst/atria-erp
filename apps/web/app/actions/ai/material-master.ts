"use server";
import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";

export async function startAiMaterialAnalysis(
  ...args: WebRpcArgs<"app/actions/ai/material-master.startAiMaterialAnalysis">
): Promise<WebRpcResult<"app/actions/ai/material-master.startAiMaterialAnalysis">> {
  return callBackendAction("app/actions/ai/material-master.startAiMaterialAnalysis", args, {
    allowCookieWrites: true,
  });
}

export async function getAiMaterialDraft(
  ...args: WebRpcArgs<"app/actions/ai/material-master.getAiMaterialDraft">
): Promise<WebRpcResult<"app/actions/ai/material-master.getAiMaterialDraft">> {
  return callBackendAction("app/actions/ai/material-master.getAiMaterialDraft", args, {
    allowCookieWrites: true,
  });
}

export async function patchAiMaterialDraft(
  ...args: WebRpcArgs<"app/actions/ai/material-master.patchAiMaterialDraft">
): Promise<WebRpcResult<"app/actions/ai/material-master.patchAiMaterialDraft">> {
  return callBackendAction("app/actions/ai/material-master.patchAiMaterialDraft", args, {
    allowCookieWrites: true,
  });
}

export async function saveAiMaterialRows(
  ...args: WebRpcArgs<"app/actions/ai/material-master.saveAiMaterialRows">
): Promise<WebRpcResult<"app/actions/ai/material-master.saveAiMaterialRows">> {
  return callBackendAction("app/actions/ai/material-master.saveAiMaterialRows", args, {
    allowCookieWrites: true,
  });
}

export async function confirmAiMaterialReference(
  ...args: WebRpcArgs<"app/actions/ai/material-master.confirmAiMaterialReference">
): Promise<WebRpcResult<"app/actions/ai/material-master.confirmAiMaterialReference">> {
  return callBackendAction("app/actions/ai/material-master.confirmAiMaterialReference", args, {
    allowCookieWrites: true,
  });
}

export async function retryAiMaterialAnalysis(
  ...args: WebRpcArgs<"app/actions/ai/material-master.retryAiMaterialAnalysis">
): Promise<WebRpcResult<"app/actions/ai/material-master.retryAiMaterialAnalysis">> {
  return callBackendAction("app/actions/ai/material-master.retryAiMaterialAnalysis", args, {
    allowCookieWrites: true,
  });
}

export async function discardAiMaterialDraft(
  ...args: WebRpcArgs<"app/actions/ai/material-master.discardAiMaterialDraft">
): Promise<WebRpcResult<"app/actions/ai/material-master.discardAiMaterialDraft">> {
  return callBackendAction("app/actions/ai/material-master.discardAiMaterialDraft", args, {
    allowCookieWrites: true,
  });
}

export async function selectAiMaterialRows(
  ...args: WebRpcArgs<"app/actions/ai/material-master.selectAiMaterialRows">
): Promise<WebRpcResult<"app/actions/ai/material-master.selectAiMaterialRows">> {
  return callBackendAction("app/actions/ai/material-master.selectAiMaterialRows", args, {
    allowCookieWrites: true,
  });
}
