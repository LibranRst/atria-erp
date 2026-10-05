"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/project/rap-rab-bundles";

export async function addRabManualItem(
  ...args: WebRpcArgs<"app/actions/project/rap-rab-bundles.addRabManualItem">
): Promise<WebRpcResult<"app/actions/project/rap-rab-bundles.addRabManualItem">> {
  return callBackendAction("app/actions/project/rap-rab-bundles.addRabManualItem", args, {
    allowCookieWrites: true,
  });
}

export async function createRabBundle(
  ...args: WebRpcArgs<"app/actions/project/rap-rab-bundles.createRabBundle">
): Promise<WebRpcResult<"app/actions/project/rap-rab-bundles.createRabBundle">> {
  return callBackendAction("app/actions/project/rap-rab-bundles.createRabBundle", args, {
    allowCookieWrites: true,
  });
}

export async function updateRabBundle(
  ...args: WebRpcArgs<"app/actions/project/rap-rab-bundles.updateRabBundle">
): Promise<WebRpcResult<"app/actions/project/rap-rab-bundles.updateRabBundle">> {
  return callBackendAction("app/actions/project/rap-rab-bundles.updateRabBundle", args, {
    allowCookieWrites: true,
  });
}

export async function deleteRabBundle(
  ...args: WebRpcArgs<"app/actions/project/rap-rab-bundles.deleteRabBundle">
): Promise<WebRpcResult<"app/actions/project/rap-rab-bundles.deleteRabBundle">> {
  return callBackendAction("app/actions/project/rap-rab-bundles.deleteRabBundle", args, {
    allowCookieWrites: true,
  });
}
