import { z } from "zod";
import { db } from "@backend/db";
import { resolveActor } from "@backend/server/actor";
import { assertReconciliationRights } from "@backend/server/usecases/ai/reconciliation-context";
import { readOwnedStoredProposal } from "@backend/server/usecases/ai/stored-proposal";
import {
  reconciliationIdentitySchema,
  reconciliationSaveSchema,
} from "@atria/core/ai/bank-reconciliation";
import { confirmAiReconciliationProposal } from "./bank-reconciliation";
import type { ActionResponse } from "@atria/core/types/action-response";
export type ConfirmAiBankReconciliationResult = {
  readonly importId: string;
  readonly matchedCount: number;
  readonly alreadyConfirmed: boolean;
};
/** Historical client-payload proposals are readable history, never authority for a new write. */
export async function confirmAiBankReconciliationProposal(
  raw: unknown,
): Promise<ActionResponse<ConfirmAiBankReconciliationResult>> {
  const current = reconciliationSaveSchema.safeParse(raw);
  if (current.success) {
    const result = await confirmAiReconciliationProposal(current.data);
    return result.success
      ? {
          success: true,
          data: {
            importId: result.data.resultId,
            matchedCount: 0,
            alreadyConfirmed: result.data.alreadyConfirmed,
          },
        }
      : result;
  }
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  const identity = reconciliationIdentitySchema.safeParse(
    typeof raw === "object" && raw !== null
      ? {
          conversationId: Reflect.get(raw, "conversationId"),
          toolCallId: Reflect.get(raw, "toolCallId"),
        }
      : raw,
  );
  if (!identity.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Identitas usulan tidak valid." },
    };
  try {
    assertReconciliationRights(actor);
    await readOwnedStoredProposal(
      db,
      actor,
      identity.data,
      "proposeBankReconciliation",
      z.object({ kind: z.literal("BANK_RECONCILIATION") }),
    );
  } catch {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Usulan tidak tersedia atau akses rekonsiliasi ditolak.",
      },
    };
  }
  return {
    success: false,
    error: {
      code: "CONFLICT",
      message:
        "Usulan lama perlu dibuat ulang. Minta preview rekonsiliasi terbaru agar pilihan dan sumber diperiksa dari draft server.",
    },
  };
}
