import type { SelectOption } from "@/components/ui";
import { fullMoney } from "@/features/finance-dashboard/lib/dashboard-formatters";
import { CARD_PRESETS } from "./constants";
import type {
  AccountDraft,
  BankAccount,
  MovementDraft,
  MovementType,
  TransferDraft,
} from "./types";

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function newAccountDraft(): AccountDraft {
  const preset = CARD_PRESETS[0];
  return {
    id: null,
    name: "",
    accountNumber: "",
    bankName: "",
    holderName: "",
    openingBalance: "",
    cardColorFrom: preset.from,
    cardColorTo: preset.to,
    cardTextColor: preset.text,
    isActive: true,
  };
}

export function accountToDraft(account: BankAccount): AccountDraft {
  return {
    id: account.id,
    name: account.name,
    accountNumber: account.accountNumber,
    bankName: account.bankName,
    holderName: account.holderName,
    openingBalance: "",
    cardColorFrom: account.cardColorFrom,
    cardColorTo: account.cardColorTo,
    cardTextColor: account.cardTextColor,
    isActive: account.isActive,
  };
}

export function newMovementDraft(type: MovementType): MovementDraft {
  return {
    type,
    amount: "",
    category: type === "DEBIT" ? "owner_capital" : "bank_fee",
    description: "",
    transactionDate: todayIso(),
    referenceNumber: "",
  };
}

export function newTransferDraft(
  accounts: readonly BankAccount[],
  selected: BankAccount | null,
): TransferDraft {
  const nextAccount = accounts.find(
    (account) => account.isActive && account.id !== selected?.id,
  );
  return {
    toBankAccountId: nextAccount?.id ?? "",
    amount: "",
    description: "",
    transactionDate: todayIso(),
    referenceNumber: "",
  };
}

export function applyAccountUpdate(
  accounts: readonly BankAccount[],
  account: BankAccount,
): readonly BankAccount[] {
  const exists = accounts.some((item) => item.id === account.id);
  if (!exists) return [account, ...accounts];
  return accounts.map((item) => (item.id === account.id ? account : item));
}

export function accountOptions(
  accounts: readonly BankAccount[],
  selectedId?: string,
): readonly SelectOption[] {
  return accounts
    .filter((account) => account.isActive && account.id !== selectedId)
    .map((account) => ({
      value: account.id,
      label: account.name,
      description: `${account.bankName} •••• ${account.accountNumber.slice(-4)}`,
      meta: fullMoney.format(account.balance),
    }));
}
