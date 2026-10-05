"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/project/revision-change-order";

export async function createRapRevision(
  ...args: WebRpcArgs<"app/actions/project/revision-change-order.createRapRevision">
): Promise<WebRpcResult<"app/actions/project/revision-change-order.createRapRevision">> {
  return callBackendAction("app/actions/project/revision-change-order.createRapRevision", args, {
    allowCookieWrites: true,
  });
}

export async function createCategoryPlanRevision(
  ...args: WebRpcArgs<"app/actions/project/revision-change-order.createCategoryPlanRevision">
): Promise<WebRpcResult<"app/actions/project/revision-change-order.createCategoryPlanRevision">> {
  return callBackendAction(
    "app/actions/project/revision-change-order.createCategoryPlanRevision",
    args,
    { allowCookieWrites: true },
  );
}

export async function refreshRabLinkedSources(
  ...args: WebRpcArgs<"app/actions/project/revision-change-order.refreshRabLinkedSources">
): Promise<WebRpcResult<"app/actions/project/revision-change-order.refreshRabLinkedSources">> {
  return callBackendAction(
    "app/actions/project/revision-change-order.refreshRabLinkedSources",
    args,
    { allowCookieWrites: true },
  );
}

export async function createProjectChangeOrder(
  ...args: WebRpcArgs<"app/actions/project/revision-change-order.createProjectChangeOrder">
): Promise<WebRpcResult<"app/actions/project/revision-change-order.createProjectChangeOrder">> {
  return callBackendAction(
    "app/actions/project/revision-change-order.createProjectChangeOrder",
    args,
    { allowCookieWrites: true },
  );
}

export async function confirmChangeOrderClient(
  ...args: WebRpcArgs<"app/actions/project/revision-change-order.confirmChangeOrderClient">
): Promise<WebRpcResult<"app/actions/project/revision-change-order.confirmChangeOrderClient">> {
  return callBackendAction(
    "app/actions/project/revision-change-order.confirmChangeOrderClient",
    args,
    { allowCookieWrites: true },
  );
}

export async function voidRabRevision(
  ...args: WebRpcArgs<"app/actions/project/revision-change-order.voidRabRevision">
): Promise<WebRpcResult<"app/actions/project/revision-change-order.voidRabRevision">> {
  return callBackendAction("app/actions/project/revision-change-order.voidRabRevision", args, {
    allowCookieWrites: true,
  });
}

export async function approveProjectChangeOrder(
  ...args: WebRpcArgs<"app/actions/project/revision-change-order.approveProjectChangeOrder">
): Promise<WebRpcResult<"app/actions/project/revision-change-order.approveProjectChangeOrder">> {
  return callBackendAction(
    "app/actions/project/revision-change-order.approveProjectChangeOrder",
    args,
    { allowCookieWrites: true },
  );
}
