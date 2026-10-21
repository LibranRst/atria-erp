"use server";
import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export async function getAiProcurementWarehouseProposal(
  ...args: WebRpcArgs<"app/actions/ai/procurement-warehouse.getAiProcurementWarehouseProposal">
): Promise<WebRpcResult<"app/actions/ai/procurement-warehouse.getAiProcurementWarehouseProposal">> {
  return callBackendAction(
    "app/actions/ai/procurement-warehouse.getAiProcurementWarehouseProposal",
    args,
    { allowCookieWrites: true },
  );
}
export async function confirmAiProcurementWarehouseProposal(
  ...args: WebRpcArgs<"app/actions/ai/procurement-warehouse.confirmAiProcurementWarehouseProposal">
): Promise<
  WebRpcResult<"app/actions/ai/procurement-warehouse.confirmAiProcurementWarehouseProposal">
> {
  return callBackendAction(
    "app/actions/ai/procurement-warehouse.confirmAiProcurementWarehouseProposal",
    args,
    { allowCookieWrites: true },
  );
}
