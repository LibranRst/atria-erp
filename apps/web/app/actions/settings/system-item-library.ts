"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/settings/system-item-library";

export async function createItemPriceLibraryItem(
  ...args: WebRpcArgs<"app/actions/settings/system-item-library.createItemPriceLibraryItem">
): Promise<WebRpcResult<"app/actions/settings/system-item-library.createItemPriceLibraryItem">> {
  return callBackendAction(
    "app/actions/settings/system-item-library.createItemPriceLibraryItem",
    args,
    { allowCookieWrites: true },
  );
}

export async function updateItemPriceLibraryItem(
  ...args: WebRpcArgs<"app/actions/settings/system-item-library.updateItemPriceLibraryItem">
): Promise<WebRpcResult<"app/actions/settings/system-item-library.updateItemPriceLibraryItem">> {
  return callBackendAction(
    "app/actions/settings/system-item-library.updateItemPriceLibraryItem",
    args,
    { allowCookieWrites: true },
  );
}

export async function archiveItemPriceLibraryItem(
  ...args: WebRpcArgs<"app/actions/settings/system-item-library.archiveItemPriceLibraryItem">
): Promise<WebRpcResult<"app/actions/settings/system-item-library.archiveItemPriceLibraryItem">> {
  return callBackendAction(
    "app/actions/settings/system-item-library.archiveItemPriceLibraryItem",
    args,
    { allowCookieWrites: true },
  );
}

export async function setItemPriceLibraryItemActive(
  ...args: WebRpcArgs<"app/actions/settings/system-item-library.setItemPriceLibraryItemActive">
): Promise<WebRpcResult<"app/actions/settings/system-item-library.setItemPriceLibraryItemActive">> {
  return callBackendAction(
    "app/actions/settings/system-item-library.setItemPriceLibraryItemActive",
    args,
    { allowCookieWrites: true },
  );
}
