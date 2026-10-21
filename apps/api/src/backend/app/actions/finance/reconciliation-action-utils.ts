import crypto from "crypto";
import { resolveActor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import { parseNumericToCents } from "@backend/lib/finance/balance-mutation";
import { normalizeCashDirection, type CashDirection } from "@atria/core/finance/cash-direction";
import type { ActionResponse } from "@atria/core/types/action-response";

export async function requireReconciliationUser(): Promise<
  ActionResponse<{ readonly id: string }>
> {
  const actor = await resolveActor();
  if (!actor) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }
  if (!actor.isActive || !actorCan(actor, "reconcile:ledger") || actor.dataScope !== "GLOBAL") {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Rekonsiliasi memerlukan izin buku kas dan akses data global.",
      },
    };
  }
  return { success: true, data: { id: actor.userId } };
}

export function normalizeReconciliationDescription(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
}

export function createStatementFingerprint(input: {
  readonly bankAccountId: string;
  readonly transactionDate: Date;
  readonly type: CashDirection;
  readonly amount: string;
  readonly description: string;
}): string {
  return crypto
    .createHash("sha256")
    .update(
      `${input.bankAccountId}|${input.transactionDate.toISOString().slice(0, 10)}|${input.type}|${input.amount}|${normalizeReconciliationDescription(input.description)}`,
    )
    .digest("hex");
}

export function findSuggestedTransactionId(
  statement: {
    readonly bankAccountId: string;
    readonly type: CashDirection;
    readonly amount: string;
    readonly description: string;
  },
  transactions: readonly {
    readonly id: string;
    readonly bankAccountId: string;
    readonly type: string;
    readonly amount: string;
    readonly bankReference: string | null;
  }[],
): { readonly id: string | null; readonly candidateCount: number } {
  const candidates = transactions.filter(
    (transaction) =>
      transaction.bankAccountId === statement.bankAccountId &&
      normalizeCashDirection(transaction.type) === statement.type &&
      parseNumericToCents(transaction.amount) === parseNumericToCents(statement.amount),
  );
  if (candidates.length === 1) return { id: candidates[0]?.id ?? null, candidateCount: 1 };
  const normalizedDescription = normalizeReconciliationDescription(statement.description);
  const referenceMatches = candidates.filter((candidate) => {
    const reference = candidate.bankReference?.trim().toLocaleLowerCase("id-ID");
    return Boolean(reference && normalizedDescription.includes(reference));
  });
  return {
    id: referenceMatches.length === 1 ? (referenceMatches[0]?.id ?? null) : null,
    candidateCount: candidates.length,
  };
}
