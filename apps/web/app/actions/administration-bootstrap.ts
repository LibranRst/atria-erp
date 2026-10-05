"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/administration-bootstrap";

export async function getBootstrapStatus(
  ...args: WebRpcArgs<"app/actions/administration-bootstrap.getBootstrapStatus">
): Promise<WebRpcResult<"app/actions/administration-bootstrap.getBootstrapStatus">> {
  return callBackendAction("app/actions/administration-bootstrap.getBootstrapStatus", args, {
    allowCookieWrites: true,
  });
}

export async function bootstrapFirstOwner(
  ...args: WebRpcArgs<"app/actions/administration-bootstrap.bootstrapFirstOwner">
): Promise<WebRpcResult<"app/actions/administration-bootstrap.bootstrapFirstOwner">> {
  return callBackendAction("app/actions/administration-bootstrap.bootstrapFirstOwner", args, {
    allowCookieWrites: true,
  });
}
