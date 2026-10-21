import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";
import { db } from "@backend/db";
import { resolveActor } from "@backend/server/actor";
import {
  postGoodsReceiptTx,
  type GoodsReceipt,
} from "@backend/server/usecases/material/post-goods-receipt";
import type { ActionResponse } from "@atria/core/types/action-response";
import { createGoodsReceiptSchema } from "@atria/core/validations/workflow-governance";

export async function postGoodsReceipt(input: unknown): Promise<ActionResponse<GoodsReceipt>> {
  const validation = createGoodsReceiptSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Goods Receipt tidak valid.",
      },
    };
  }
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const posted = await db.transaction((tx): Promise<GoodsReceipt> =>
      postGoodsReceiptTx(tx, actor, validation.data),
    );

    revalidatePath("/materials");
    revalidatePath(`/projects/${posted.projectId}`);
    return { success: true, data: posted };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal posting Goods Receipt.";
    if (message.startsWith("SETUP_REQUIRED:")) {
      return {
        success: false,
        error: { code: "CONFLICT", message: message.replace("SETUP_REQUIRED: ", "") },
      };
    }
    const businessMessages: Record<string, string> = {
      GOODS_RECEIPT_VENDOR_BILL_MISMATCH: "Tagihan vendor tidak sesuai dengan proyek penerimaan.",
      GOODS_RECEIPT_VENDOR_BILL_ITEM_MISMATCH:
        "Material atau item RAP tidak sesuai dengan tagihan vendor.",
      GOODS_RECEIPT_RAP_ITEM_MISMATCH:
        "Item RAP tidak sesuai dengan proyek atau material penerimaan.",
      GOODS_RECEIPT_EXCEEDS_VENDOR_BILL:
        "Total nilai penerimaan melebihi sisa nilai tagihan vendor.",
      GOODS_RECEIPT_EXCEEDS_RAP_QUANTITY: "Jumlah penerimaan melebihi sisa kebutuhan item RAP.",
    };
    if (businessMessages[message]) {
      return {
        success: false,
        error: { code: "VALIDATION_ERROR", message: businessMessages[message] },
      };
    }
    if (message.includes("FORBIDDEN") || message.includes("Akses"))
      return { success: false, error: { code: "FORBIDDEN", message } };
    return { success: false, error: { code: "TRANSACTION_FAILED", message } };
  }
}
