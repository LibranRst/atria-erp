import { db } from "@backend/db";
import { vendorBill } from "@backend/db/schema";
import { resolveActor } from "@backend/server/actor";
import {
  correctVendorBillTx,
  VendorBillCorrectionError,
} from "@backend/server/usecases/finance/vendor-bill-correction-writer";
import { vendorBillCorrectionInputSchema } from "@atria/core/ai/procurement-warehouse";
import type { ActionResponse } from "@atria/core/types/action-response";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
export async function correctVendorBill(
  raw: unknown,
): Promise<ActionResponse<typeof vendorBill.$inferSelect>> {
  const actor = await resolveActor(),
    parsed = vendorBillCorrectionInputSchema.safeParse(raw);
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak tersedia." } };
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message:
          "Lengkapi koreksi dengan nomor, tanggal, nominal yang valid dan alasan minimal 10 karakter.",
      },
    };
  try {
    const bill = await db.transaction((tx) => correctVendorBillTx(tx, actor, parsed.data));
    for (const path of ["/expenses", "/ledger", "/projects", `/projects/${bill.projectId}`])
      revalidateWorkspacePath(path);
    return { success: true, data: bill };
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        code:
          error instanceof VendorBillCorrectionError
            ? error.code
            : error instanceof Error && error.message.startsWith("FORBIDDEN")
              ? "FORBIDDEN"
              : "CONFLICT",
        message:
          error instanceof VendorBillCorrectionError
            ? error.message
            : "Sumber atau akses tagihan berubah. Periksa tagihan terbaru sebelum mengoreksi.",
      },
    };
  }
}
