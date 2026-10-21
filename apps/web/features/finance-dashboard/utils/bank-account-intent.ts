import type { BankAccount } from "@/features/finance-dashboard/types/bank-account-types";

export type BankAccountIntent =
  | { readonly action: "create" }
  | { readonly action: "detail" | "edit" | "movement" | "transfer"; readonly accountId: string };

export type BankAccountIntentAccess = {
  readonly canView: boolean;
  readonly canCreate: boolean;
  readonly canEdit: boolean;
  readonly canMove: boolean;
};

/** URL intent opens a permitted sheet only. It never submits or changes account state. */
export function resolveBankAccountIntent({
  accountId,
  action,
  accounts,
  access,
}: {
  readonly accountId: string | null;
  readonly action: string | null;
  readonly accounts: readonly Pick<BankAccount, "id" | "isActive">[];
  readonly access: BankAccountIntentAccess;
}): BankAccountIntent | null {
  if (!access.canView) return null;
  if (action === "create") {
    return access.canCreate && accountId === null ? { action: "create" } : null;
  }
  if (action !== null && action !== "edit" && action !== "movement" && action !== "transfer") {
    return null;
  }
  const account = accounts.find((item) => item.id === accountId);
  if (!account) return null;
  if (action === null) return { action: "detail", accountId: account.id };
  if (action === "edit") {
    return access.canEdit ? { action, accountId: account.id } : null;
  }
  if (!access.canMove || !account.isActive) return null;
  if (action === "transfer" && !accounts.some((item) => item.isActive && item.id !== account.id)) {
    return null;
  }
  return { action, accountId: account.id };
}

/** Consume only the bank intent, retaining workspace presentation, tab and other URL state. */
export function consumeBankAccountIntentHref(href: string): string {
  const url = new URL(href, "https://atria.invalid");
  url.searchParams.delete("account");
  url.searchParams.delete("bank-action");
  return `${url.pathname}${url.search}${url.hash}`;
}
