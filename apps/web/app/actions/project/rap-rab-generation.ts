"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/project/rap-rab-generation";

export async function generateRabFromRap(
  ...args: WebRpcArgs<"app/actions/project/rap-rab-generation.generateRabFromRap">
): Promise<WebRpcResult<"app/actions/project/rap-rab-generation.generateRabFromRap">> {
  return callBackendAction("app/actions/project/rap-rab-generation.generateRabFromRap", args, {
    allowCookieWrites: true,
  });
}

export async function generateRabFromSelectedSources(
  ...args: WebRpcArgs<"app/actions/project/rap-rab-generation.generateRabFromSelectedSources">
): Promise<WebRpcResult<"app/actions/project/rap-rab-generation.generateRabFromSelectedSources">> {
  return callBackendAction(
    "app/actions/project/rap-rab-generation.generateRabFromSelectedSources",
    args,
    { allowCookieWrites: true },
  );
}
