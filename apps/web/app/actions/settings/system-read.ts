"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/settings/system-read";

export async function getItemPriceLibrary(
  ...args: WebRpcArgs<"app/actions/settings/system-read.getItemPriceLibrary">
): Promise<WebRpcResult<"app/actions/settings/system-read.getItemPriceLibrary">> {
  return callBackendAction("app/actions/settings/system-read.getItemPriceLibrary", args, {
    allowCookieWrites: true,
  });
}

export async function getSettingsHubOverview(
  ...args: WebRpcArgs<"app/actions/settings/system-read.getSettingsHubOverview">
): Promise<WebRpcResult<"app/actions/settings/system-read.getSettingsHubOverview">> {
  return callBackendAction("app/actions/settings/system-read.getSettingsHubOverview", args, {
    allowCookieWrites: true,
  });
}

export async function getBudgetSettings(
  ...args: WebRpcArgs<"app/actions/settings/system-read.getBudgetSettings">
): Promise<WebRpcResult<"app/actions/settings/system-read.getBudgetSettings">> {
  return callBackendAction("app/actions/settings/system-read.getBudgetSettings", args, {
    allowCookieWrites: true,
  });
}

export async function getExpenseCategorySettings(
  ...args: WebRpcArgs<"app/actions/settings/system-read.getExpenseCategorySettings">
): Promise<WebRpcResult<"app/actions/settings/system-read.getExpenseCategorySettings">> {
  return callBackendAction("app/actions/settings/system-read.getExpenseCategorySettings", args, {
    allowCookieWrites: true,
  });
}

export async function getItemLibrarySettings(
  ...args: WebRpcArgs<"app/actions/settings/system-read.getItemLibrarySettings">
): Promise<WebRpcResult<"app/actions/settings/system-read.getItemLibrarySettings">> {
  return callBackendAction("app/actions/settings/system-read.getItemLibrarySettings", args, {
    allowCookieWrites: true,
  });
}

export async function getMaterialSettings(
  ...args: WebRpcArgs<"app/actions/settings/system-read.getMaterialSettings">
): Promise<WebRpcResult<"app/actions/settings/system-read.getMaterialSettings">> {
  return callBackendAction("app/actions/settings/system-read.getMaterialSettings", args, {
    allowCookieWrites: true,
  });
}

export async function getSettingsOverview(
  ...args: WebRpcArgs<"app/actions/settings/system-read.getSettingsOverview">
): Promise<WebRpcResult<"app/actions/settings/system-read.getSettingsOverview">> {
  return callBackendAction("app/actions/settings/system-read.getSettingsOverview", args, {
    allowCookieWrites: true,
  });
}
