import { cookies } from "@runtime/request-context";
import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";

import { bankAccount } from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { assertPermission, type PermissionKey } from "@backend/lib/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";

export type BankAccountActionUser = {
  readonly id: string;
  readonly roleId?: string;
};

type BankAccountRow = typeof bankAccount.$inferSelect;

export async function authorizeBankAccountAction(
  permission: PermissionKey,
): Promise<ActionResponse<{ readonly user: BankAccountActionUser }>> {
  const session = await auth.api.getSession({
    headers: { cookie: (await cookies()).toString() },
  });
  const user = session?.user ? { id: session.user.id, roleId: session.user.roleId } : null;
  if (!user) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }
  try {
    await assertPermission(user, permission);
    return { success: true, data: { user } };
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

export function toBankMoney(value: number): string {
  return value.toFixed(2);
}

export function revalidateFinanceViews(): void {
  revalidatePath("/ledger");
  revalidatePath("/expenses");
  revalidatePath("/projects");
}

export function bankAccountPayload(
  row: BankAccountRow,
): BankAccountRow & { readonly balanceNumber: number } {
  return { ...row, balanceNumber: Number(row.balance) };
}

export function mapBankAccountError(error: unknown, fallback: string): ActionResponse<never> {
  const message = error instanceof Error ? error.message : fallback;
  if (message.includes("INSUFFICIENT_FUNDS")) {
    return {
      success: false,
      error: { code: "INSUFFICIENT_FUNDS", message: "Saldo rekening tidak mencukupi." },
    };
  }
  if (message.includes("BANK_ACCOUNT_NOT_FOUND")) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Rekening bank tidak ditemukan." },
    };
  }
  if (message.includes("BANK_ACCOUNT_STATUS_FORBIDDEN")) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Hanya Owner yang dapat mengarsipkan atau mengaktifkan rekening.",
      },
    };
  }
  if (message.includes("duplicate key") || message.includes("unique")) {
    return {
      success: false,
      error: { code: "TRANSACTION_FAILED", message: "Nomor rekening sudah terdaftar." },
    };
  }
  if (message.includes("Failed query")) {
    return { success: false, error: { code: "TRANSACTION_FAILED", message: fallback } };
  }
  return { success: false, error: { code: "TRANSACTION_FAILED", message } };
}
