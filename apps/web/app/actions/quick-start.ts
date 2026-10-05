"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/quick-start";

export async function advanceQuickStart(
  ...args: WebRpcArgs<"app/actions/quick-start.advanceQuickStart">
): Promise<WebRpcResult<"app/actions/quick-start.advanceQuickStart">> {
  return callBackendAction("app/actions/quick-start.advanceQuickStart", args, {
    allowCookieWrites: true,
  });
}

export async function pauseQuickStart(
  ...args: WebRpcArgs<"app/actions/quick-start.pauseQuickStart">
): Promise<WebRpcResult<"app/actions/quick-start.pauseQuickStart">> {
  return callBackendAction("app/actions/quick-start.pauseQuickStart", args, {
    allowCookieWrites: true,
  });
}

export async function createFirstProjectQuickStart(
  ...args: WebRpcArgs<"app/actions/quick-start.createFirstProjectQuickStart">
): Promise<WebRpcResult<"app/actions/quick-start.createFirstProjectQuickStart">> {
  return callBackendAction("app/actions/quick-start.createFirstProjectQuickStart", args, {
    allowCookieWrites: true,
  });
}

export async function setInitialStockReadinessDecision(
  ...args: WebRpcArgs<"app/actions/quick-start.setInitialStockReadinessDecision">
): Promise<WebRpcResult<"app/actions/quick-start.setInitialStockReadinessDecision">> {
  return callBackendAction("app/actions/quick-start.setInitialStockReadinessDecision", args, {
    allowCookieWrites: true,
  });
}

export async function recordQuickStartRetry(
  ...args: WebRpcArgs<"app/actions/quick-start.recordQuickStartRetry">
): Promise<WebRpcResult<"app/actions/quick-start.recordQuickStartRetry">> {
  return callBackendAction("app/actions/quick-start.recordQuickStartRetry", args, {
    allowCookieWrites: true,
  });
}
