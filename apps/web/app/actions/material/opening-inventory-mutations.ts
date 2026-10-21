"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/material/opening-inventory-mutations";

export async function createInventoryOpening(
  ...args: WebRpcArgs<"app/actions/material/opening-inventory-mutations.createInventoryOpening">
): Promise<
  WebRpcResult<"app/actions/material/opening-inventory-mutations.createInventoryOpening">
> {
  return callBackendAction(
    "app/actions/material/opening-inventory-mutations.createInventoryOpening",
    args,
    { allowCookieWrites: true },
  );
}

export async function decideInventoryOpening(
  ...args: WebRpcArgs<"app/actions/material/opening-inventory-mutations.decideInventoryOpening">
): Promise<
  WebRpcResult<"app/actions/material/opening-inventory-mutations.decideInventoryOpening">
> {
  return callBackendAction(
    "app/actions/material/opening-inventory-mutations.decideInventoryOpening",
    args,
    { allowCookieWrites: true },
  );
}

export async function reverseInventoryOpening(
  ...args: WebRpcArgs<"app/actions/material/opening-inventory-mutations.reverseInventoryOpening">
): Promise<
  WebRpcResult<"app/actions/material/opening-inventory-mutations.reverseInventoryOpening">
> {
  return callBackendAction(
    "app/actions/material/opening-inventory-mutations.reverseInventoryOpening",
    args,
    { allowCookieWrites: true },
  );
}
