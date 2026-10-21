import { db } from "@backend/db";
import { clientInvoice } from "@backend/db/schema";
import { resolveActor } from "@backend/server/actor";
import { createClientInvoiceTx } from "@backend/server/usecases/finance/client-invoice-writer";
import {
  createClientInvoiceSchema,
  type CreateClientInvoiceInput,
} from "@atria/core/validations/finance";
import type { ActionResponse } from "@atria/core/types/action-response";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";

export async function createClientInvoice(
  input: CreateClientInvoiceInput,
): Promise<ActionResponse<typeof clientInvoice.$inferSelect>> {
  const validation = createClientInvoiceSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Isian invoice tidak valid.",
      },
    };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const data = await db.transaction((tx) => createClientInvoiceTx(tx, actor, validation.data));
    revalidateWorkspacePath(`/projects/${validation.data.projectId}`);
    revalidateWorkspacePath("/ledger");
    return { success: true, data };
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "";
    const forbidden = reason.startsWith("FORBIDDEN:") || reason.startsWith("PROJECT_NOT_ACTIVE:");
    return {
      success: false,
      error: {
        code: forbidden ? "FORBIDDEN" : "VALIDATION_ERROR",
        message:
          reason === "INVOICE_EXCEEDS_CONTRACT_VALUE"
            ? "Total invoice aktif akan melebihi nilai kontrak proyek. Gunakan Change Order sebelum menambah tagihan."
            : forbidden
              ? "Akses atau status proyek tidak mengizinkan tindakan invoice."
              : reason && !reason.startsWith("Failed query:")
                ? reason
                : "Invoice belum tersimpan. Periksa nomor dan kondisi proyek.",
      },
    };
  }
}
