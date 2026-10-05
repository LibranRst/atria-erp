"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/material/opening-inventory-queries";

export async function getInitialStockCandidates(
  ...args: WebRpcArgs<"app/actions/material/opening-inventory-queries.getInitialStockCandidates">
): Promise<
  WebRpcResult<"app/actions/material/opening-inventory-queries.getInitialStockCandidates">
> {
  return callBackendAction(
    "app/actions/material/opening-inventory-queries.getInitialStockCandidates",
    args,
    { allowCookieWrites: true },
  );
}

export async function previewInitialStockImport(
  ...args: WebRpcArgs<"app/actions/material/opening-inventory-queries.previewInitialStockImport">
): Promise<
  WebRpcResult<"app/actions/material/opening-inventory-queries.previewInitialStockImport">
> {
  return callBackendAction(
    "app/actions/material/opening-inventory-queries.previewInitialStockImport",
    args,
    { allowCookieWrites: true },
  );
}

export async function getInventoryOpeningBatches(
  ...args: WebRpcArgs<"app/actions/material/opening-inventory-queries.getInventoryOpeningBatches">
): Promise<
  WebRpcResult<"app/actions/material/opening-inventory-queries.getInventoryOpeningBatches">
> {
  return callBackendAction(
    "app/actions/material/opening-inventory-queries.getInventoryOpeningBatches",
    args,
    { allowCookieWrites: true },
  );
}
