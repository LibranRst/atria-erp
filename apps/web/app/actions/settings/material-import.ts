"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/settings/material-import";

export async function previewMaterialImport(
  ...args: WebRpcArgs<"app/actions/settings/material-import.previewMaterialImport">
): Promise<WebRpcResult<"app/actions/settings/material-import.previewMaterialImport">> {
  return callBackendAction("app/actions/settings/material-import.previewMaterialImport", args, {
    allowCookieWrites: true,
  });
}

export async function commitMaterialImport(
  ...args: WebRpcArgs<"app/actions/settings/material-import.commitMaterialImport">
): Promise<WebRpcResult<"app/actions/settings/material-import.commitMaterialImport">> {
  return callBackendAction("app/actions/settings/material-import.commitMaterialImport", args, {
    allowCookieWrites: true,
  });
}
