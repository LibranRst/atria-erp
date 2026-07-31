"use server";

import { cookies } from "next/headers";

import { auth } from "@/lib/auth";
import { assertPermission, resolveRoleName, type PermissionKey } from "@/lib/auth/permissions";
import { type ActivityDetailRequest, type ActivityDetailView } from "@/lib/activity-detail/types";
import { activityDetailRequestSchema } from "@/lib/activity-detail/validation";
import type { ActionResponse } from "@/lib/types/action-response";
import {
  resolveCashTransaction,
  resolveClientInvoice,
  resolveClientPayment,
  resolveProjectCost,
  resolveVendorBill,
  resolveVendorPayment,
} from "./activity-detail-finance-resolvers";
import {
  resolveGoodsReceipt,
  resolveOpening,
  resolveStockCount,
  resolveStockMovement,
  resolveStockTransfer,
} from "./activity-detail-inventory-resolvers";
import {
  resolveApproval,
  resolveChangeOrder,
  resolveRabRevision,
} from "./activity-detail-project-resolvers";
import type { ActivityUser } from "./activity-detail-resolver-utils";

const permissionByKind: Record<ActivityDetailRequest["kind"], PermissionKey> = {
  STOCK_MOVEMENT: "view:inventory",
  GOODS_RECEIPT: "view:inventory",
  STOCK_TRANSFER: "view:inventory",
  STOCK_COUNT: "view:inventory",
  INVENTORY_OPENING: "view:inventory",
  PROJECT_COST: "view:cost",
  VENDOR_BILL: "view:vendor_bill",
  VENDOR_PAYMENT: "view:vendor_bill",
  CASH_TRANSACTION: "view:ledger",
  CLIENT_INVOICE: "view:client_invoice",
  CLIENT_PAYMENT: "view:client_invoice",
  RAB_REVISION: "view:rab",
  CHANGE_ORDER: "view:rab",
  APPROVAL_DECISION: "view:cost",
};

async function resolveDetail(
  input: ActivityDetailRequest,
  user: ActivityUser,
  roleName: string,
): Promise<ActivityDetailView | null> {
  switch (input.kind) {
    case "STOCK_MOVEMENT":
      return resolveStockMovement(input.id, user, roleName);
    case "GOODS_RECEIPT":
      return resolveGoodsReceipt(input.id, user, roleName);
    case "STOCK_TRANSFER":
      return resolveStockTransfer(input.id);
    case "STOCK_COUNT":
      return resolveStockCount(input.id);
    case "INVENTORY_OPENING":
      return resolveOpening(input.id);
    case "PROJECT_COST":
      return resolveProjectCost(input.id, user, roleName);
    case "VENDOR_BILL":
      return resolveVendorBill(input.id, user, roleName);
    case "VENDOR_PAYMENT":
      return resolveVendorPayment(input.id, user, roleName);
    case "CASH_TRANSACTION":
      return resolveCashTransaction(input.id);
    case "CLIENT_INVOICE":
      return resolveClientInvoice(input.id, user, roleName);
    case "CLIENT_PAYMENT":
      return resolveClientPayment(input.id, user, roleName);
    case "RAB_REVISION":
      return resolveRabRevision(input.id, user, roleName);
    case "CHANGE_ORDER":
      return resolveChangeOrder(input.id, user, roleName);
    case "APPROVAL_DECISION":
      return resolveApproval(input.id);
  }
}

export async function getActivityDetail(
  input: unknown,
): Promise<ActionResponse<ActivityDetailView>> {
  const parsed = activityDetailRequestSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Referensi aktivitas tidak valid." },
    };
  const session = await auth.api.getSession({ headers: { cookie: (await cookies()).toString() } });
  if (!session?.user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    await assertPermission(session.user, permissionByKind[parsed.data.kind]);
    const roleName = await resolveRoleName(session.user.roleId);
    const detail = await resolveDetail(
      parsed.data,
      { id: session.user.id, roleId: session.user.roleId },
      roleName,
    );
    if (!detail)
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Aktivitas tidak ditemukan atau sumbernya sudah tidak tersedia.",
        },
      };
    return { success: true, data: detail };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Detail aktivitas belum dapat dimuat.";
    const forbidden = message.includes("UNAUTHORIZED") || message.includes("FORBIDDEN");
    return {
      success: false,
      error: {
        code: forbidden ? "FORBIDDEN" : "INTERNAL_SERVER_ERROR",
        message: forbidden ? "Anda tidak memiliki akses ke detail aktivitas ini." : message,
      },
    };
  }
}
