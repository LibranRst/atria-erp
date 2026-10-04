import crypto from "crypto";
import { cookies } from "@runtime/request-context";

import { auth } from "@backend/lib/auth";
import { assertPermission } from "@backend/lib/auth/permissions";
import { parseNumericToCents } from "@backend/lib/finance/balance-mutation";
import { normalizeCashDirection, type CashDirection } from "@atria/core/finance/cash-direction";
import type { ActionResponse } from "@atria/core/types/action-response";

export async function requireReconciliationUser(): Promise<
  ActionResponse<{ readonly id: string }>
> {
  const session = await auth.api.getSession({ headers: { cookie: (await cookies()).toString() } });
  if (!session?.user) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }
  try {
    await assertPermission(session.user, "reconcile:ledger");
    return { success: true, data: { id: session.user.id } };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: error instanceof Error ? error.message : "Akses ditolak.",
      },
    };
  }
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
