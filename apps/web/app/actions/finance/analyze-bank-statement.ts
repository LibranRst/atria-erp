"use server";

import { resolveActor } from "@/server/actor";
import { assertPermission } from "@/lib/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  analyzeBankStatementUseCase,
  type AnalyzeBankStatementInput,
  type BankStatementAnalysisResult,
} from "@/server/usecases/ai/bank-statement-analyzer";
import { z } from "zod";

const analyzeBankStatementSchema = z.object({
  fileName: z.string().trim().min(1, "Nama file wajib ada.").max(255),
  fileBase64: z.string().optional(),
  fileContent: z.string().optional(),
  fileUrl: z.string().optional(),
  mimeType: z.string().optional(),
});

/**
 * Server Action untuk menganalisis file mutasi bank (Excel, CSV, Gambar/PDF).
 * Dilindungi izin "reconcile:ledger".
 */
export async function analyzeBankStatement(
  input: AnalyzeBankStatementInput,
): Promise<ActionResponse<BankStatementAnalysisResult>> {
  const actor = await resolveActor();
  if (!actor) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Harap login kembali." },
    };
  }

  try {
    await assertPermission({ id: actor.userId, roleId: actor.roleId }, "reconcile:ledger");
  } catch (error) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: error instanceof Error ? error.message : "Akses rekonsiliasi ditolak.",
      },
    };
  }

  const validation = analyzeBankStatementSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Input file rekening koran tidak valid.",
      },
    };
  }

  return analyzeBankStatementUseCase(actor, validation.data);
}
