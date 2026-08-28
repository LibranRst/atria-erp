"use client";

import { actorHasPermission } from "@atria/core/auth/permissions";
import React from "react";
import { toast } from "sonner";
import { z } from "zod";

import {
  createBankAccount,
  postManualCashMovement,
  setBankAccountActive,
  transferBetweenBankAccounts,
  updateBankAccount,
} from "@/app/actions/finance/bank-accounts";
import type { FinanceDashboardOverview } from "@/app/actions/finance/dashboard-overview";
import type { OperationSuccess, SelectOption } from "@/components/ui";
import { useLocalFormRecovery } from "@/lib/hooks/use-local-form-recovery";
import type {
  AccountDraft,
  BankAccount,
  MovementDraft,
  MovementType,
  SheetMode,
  TransferDraft,
} from "@/features/finance-dashboard/types/bank-account-types";
import {
  accountOptions,
  accountToDraft,
  applyAccountUpdate,
  newAccountDraft,
  newMovementDraft,
  newTransferDraft,
} from "@/features/finance-dashboard/utils/bank-account-utils";
import { fullMoney } from "@/features/finance-dashboard/utils/dashboard-formatters";
const movementRecoverySchema = z.object({
  accountId: z.string(),
  draft: z.object({
    type: z.enum(["INFLOW", "OUTFLOW"]),
    amount: z.string(),
    category: z.enum(["owner_capital", "bank_fee", "correction", "cash_adjustment", "other"]),
    description: z.string(),
    transactionDate: z.string(),
    referenceNumber: z.string(),
  }),
});

const accountRecoverySchema = z.object({
  id: z.string().nullable(),
  name: z.string(),
  accountNumber: z.string(),
  bankName: z.string(),
  holderName: z.string(),
  openingBalance: z.string(),
  cardColorFrom: z.string(),
  cardColorTo: z.string(),
  cardTextColor: z.enum(["light", "dark"]),
  isActive: z.boolean(),
});

const transferRecoverySchema = z.object({
  accountId: z.string(),
  draft: z.object({
    toBankAccountId: z.string(),
    amount: z.string(),
    description: z.string(),
    transactionDate: z.string(),
    referenceNumber: z.string(),
  }),
});

type BankAccountActionData = {
  readonly id: string;
  readonly name: string;
  readonly bankName: string;
  readonly accountNumber: string;
  readonly holderName: string;
  readonly balanceNumber: number;
  readonly cardColorFrom: string;
  readonly cardColorTo: string;
  readonly cardTextColor: string;
  readonly isActive: boolean;
};

type UseBankAccountsControlArgs = {
  readonly accounts: readonly BankAccount[];
  readonly role: FinanceDashboardOverview["role"];
  readonly payablesDueSoon: number;
};

export type BankAccountsControlState = {
  readonly items: readonly BankAccount[];
  readonly selected: BankAccount | null;
  readonly sheet: SheetMode | null;
  readonly pending: boolean;
  readonly success: OperationSuccess | null;
  readonly accountDraft: AccountDraft;
  readonly movementDraft: MovementDraft;
  readonly transferDraft: TransferDraft;
  readonly accountIsDirty: boolean;
  readonly movementIsDirty: boolean;
  readonly transferIsDirty: boolean;
  readonly canCreate: boolean;
  readonly canArchive: boolean;
  readonly transferOptions: readonly SelectOption[];
  readonly totalCash: number;
  readonly activeAccounts: number;
  readonly unreconciledCount: number;
  readonly coverage: number | null;
  readonly setAccountDraft: React.Dispatch<React.SetStateAction<AccountDraft>>;
  readonly setMovementDraft: React.Dispatch<React.SetStateAction<MovementDraft>>;
  readonly setTransferDraft: React.Dispatch<React.SetStateAction<TransferDraft>>;
  readonly openDetail: (account: BankAccount) => void;
  readonly openCreate: () => void;
  readonly openEdit: (account: BankAccount) => void;
  readonly openMovement: (account: BankAccount, type: MovementType) => void;
  readonly openTransfer: (account: BankAccount) => void;
  readonly closeSheet: () => void;
  readonly discardAccount: () => void;
  readonly discardMovement: () => void;
  readonly discardTransfer: () => void;
  readonly saveAccount: () => void;
  readonly saveMovement: () => void;
  readonly saveTransfer: () => void;
  readonly toggleActive: (account: BankAccount) => void;
  readonly clearSuccess: () => void;
};

function accountFromActionData(data: BankAccountActionData): BankAccount {
  return {
    id: data.id,
    name: data.name,
    bankName: data.bankName,
    accountNumber: data.accountNumber,
    holderName: data.holderName,
    balance: data.balanceNumber,
    cardColorFrom: data.cardColorFrom,
    cardColorTo: data.cardColorTo,
    cardTextColor: data.cardTextColor === "dark" ? "dark" : "light",
    isActive: data.isActive,
    recentTransactions: [],
  };
}

export function useBankAccountsControl({
  accounts,
  role,
  payablesDueSoon,
}: UseBankAccountsControlArgs): BankAccountsControlState {
  const [items, setItems] = React.useState<readonly BankAccount[]>(accounts);
  const [selected, setSelected] = React.useState<BankAccount | null>(null);
  const [sheet, setSheet] = React.useState<SheetMode | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [success, setSuccess] = React.useState<OperationSuccess | null>(null);

  const initialAccountRecovery = React.useCallback((): AccountDraft => newAccountDraft(), []);
  const accountRecovery = useLocalFormRecovery({
    storageKey: "atria:finance:bank-account",
    schema: accountRecoverySchema,
    initialPayload: initialAccountRecovery,
  });
  const initialMovementRecovery = React.useCallback(
    () => ({ accountId: "", draft: newMovementDraft("INFLOW") }),
    [],
  );
  const movementRecovery = useLocalFormRecovery({
    storageKey: "atria:finance:bank-movement",
    schema: movementRecoverySchema,
    initialPayload: initialMovementRecovery,
  });
  const initialTransferRecovery = React.useCallback(
    () => ({ accountId: "", draft: newTransferDraft(accounts, null) }),
    [accounts],
  );
  const transferRecovery = useLocalFormRecovery({
    storageKey: "atria:finance:bank-transfer",
    schema: transferRecoverySchema,
    initialPayload: initialTransferRecovery,
  });

  const accountDraft = accountRecovery.payload;
  const movementDraft = movementRecovery.payload.draft;
  const transferDraft = transferRecovery.payload.draft;
  const canCreate = actorHasPermission(role, "create:bank_account");
  const canArchive = actorHasPermission(role, "delete:bank_account");
  const transferOptions = accountOptions(items, selected?.id);
  const totalCash = items.reduce((sum, account) => sum + account.balance, 0);
  const activeAccounts = items.filter((account) => account.isActive).length;
  const unreconciledCount = items.reduce(
    (sum, account) =>
      sum + account.recentTransactions.filter((transaction) => !transaction.reconciled).length,
    0,
  );
  const coverage = payablesDueSoon > 0 ? totalCash / payablesDueSoon : null;

  function openDetail(account: BankAccount): void {
    setSelected(account);
    setSheet("detail");
  }

  function openCreate(): void {
    if (!accountRecovery.isDirty || accountRecovery.payload.id !== null) {
      accountRecovery.reset(newAccountDraft());
    }
    setSheet("create");
  }

  function openEdit(account: BankAccount): void {
    setSelected(account);
    if (!accountRecovery.isDirty || accountRecovery.payload.id !== account.id) {
      accountRecovery.reset(accountToDraft(account));
    }
    setSheet("edit");
  }

  function openMovement(account: BankAccount, type: MovementType): void {
    setSelected(account);
    if (!movementRecovery.isDirty || movementRecovery.payload.accountId !== account.id) {
      movementRecovery.reset({ accountId: account.id, draft: newMovementDraft(type) });
    }
    setSheet("movement");
  }

  function openTransfer(account: BankAccount): void {
    setSelected(account);
    if (!transferRecovery.isDirty || transferRecovery.payload.accountId !== account.id) {
      transferRecovery.reset({
        accountId: account.id,
        draft: newTransferDraft(items, account),
      });
    }
    setSheet("transfer");
  }

  function closeSheet(): void {
    setSheet(null);
  }

  function discardAccount(): void {
    accountRecovery.reset();
    closeSheet();
  }

  function discardMovement(): void {
    movementRecovery.reset();
    closeSheet();
  }

  function discardTransfer(): void {
    transferRecovery.reset();
    closeSheet();
  }

  function setMovementDraft(update: React.SetStateAction<MovementDraft>): void {
    movementRecovery.setPayload((current) => ({
      ...current,
      draft: typeof update === "function" ? update(current.draft) : update,
    }));
  }

  function setTransferDraft(update: React.SetStateAction<TransferDraft>): void {
    transferRecovery.setPayload((current) => ({
      ...current,
      draft: typeof update === "function" ? update(current.draft) : update,
    }));
  }

  function saveAccount(): void {
    startTransition(async () => {
      const openingBalance = Number(accountDraft.openingBalance || 0);
      const result =
        sheet === "create"
          ? await createBankAccount({
              name: accountDraft.name,
              bankName: accountDraft.bankName,
              accountNumber: accountDraft.accountNumber,
              holderName: accountDraft.holderName,
              openingBalance,
              openingNote: openingBalance > 0 ? "Saldo awal rekening" : null,
              cardColorFrom: accountDraft.cardColorFrom,
              cardColorTo: accountDraft.cardColorTo,
              cardTextColor: accountDraft.cardTextColor,
            })
          : accountDraft.id
            ? await updateBankAccount({
                bankAccountId: accountDraft.id,
                name: accountDraft.name,
                bankName: accountDraft.bankName,
                accountNumber: accountDraft.accountNumber,
                holderName: accountDraft.holderName,
                isActive: accountDraft.isActive,
                cardColorFrom: accountDraft.cardColorFrom,
                cardColorTo: accountDraft.cardColorTo,
                cardTextColor: accountDraft.cardTextColor,
              })
            : {
                success: false as const,
                error: { code: "VALIDATION_ERROR", message: "Rekening belum dipilih." },
              };

      if (!result.success) {
        toast.error(result.error.message);
        return;
      }

      const updatedAccount = accountFromActionData(result.data);
      setItems((current) => applyAccountUpdate(current, updatedAccount));
      setSelected(updatedAccount);
      accountRecovery.clear();
      setSheet("detail");
      toast.success(
        sheet === "create" ? "Rekening baru berhasil dibuat." : "Rekening berhasil diperbarui.",
      );
    });
  }

  function saveMovement(): void {
    if (!selected) return;
    startTransition(async () => {
      const result = await postManualCashMovement({
        bankAccountId: selected.id,
        type: movementDraft.type,
        amount: Number(movementDraft.amount || 0),
        category: movementDraft.category,
        description: movementDraft.description,
        transactionDate: new Date(movementDraft.transactionDate),
        referenceNumber: movementDraft.referenceNumber || null,
      });

      if (!result.success) {
        toast.error(result.error.message);
        return;
      }

      const amount = Number(movementDraft.amount || 0);
      const nextBalance =
        movementDraft.type === "INFLOW" ? selected.balance + amount : selected.balance - amount;
      setItems((current) =>
        current.map((item) => (item.id === selected.id ? { ...item, balance: nextBalance } : item)),
      );
      setSelected((current) => (current ? { ...current, balance: nextBalance } : current));
      movementRecovery.clear();
      setSheet(null);
      setSuccess({
        title: "Mutasi kas tercatat",
        description: "Ledger dan saldo rekening sudah diperbarui dalam satu transaksi.",
        facts: [
          { label: "Rekening", value: selected.name },
          {
            label: "Mutasi",
            value: `${movementDraft.type === "INFLOW" ? "+" : "−"}${fullMoney.format(amount)}`,
          },
          { label: "Saldo sekarang", value: fullMoney.format(nextBalance) },
        ],
      });
    });
  }

  function saveTransfer(): void {
    if (!selected) return;
    startTransition(async () => {
      const result = await transferBetweenBankAccounts({
        fromBankAccountId: selected.id,
        toBankAccountId: transferDraft.toBankAccountId,
        amount: Number(transferDraft.amount || 0),
        description: transferDraft.description,
        transactionDate: new Date(transferDraft.transactionDate),
        referenceNumber: transferDraft.referenceNumber || null,
      });

      if (!result.success) {
        toast.error(result.error.message);
        return;
      }

      const amount = Number(transferDraft.amount || 0);
      const target = items.find((item) => item.id === transferDraft.toBankAccountId);
      setItems((current) =>
        current.map((item) => {
          if (item.id === selected.id) return { ...item, balance: item.balance - amount };
          if (item.id === transferDraft.toBankAccountId) {
            return { ...item, balance: item.balance + amount };
          }
          return item;
        }),
      );
      transferRecovery.clear();
      setSheet(null);
      setSuccess({
        title: "Transfer rekening tercatat",
        description:
          "Saldo sumber dan tujuan sudah diperbarui dengan referensi transfer yang sama.",
        facts: [
          { label: "Dari", value: selected.name },
          { label: "Ke", value: target?.name ?? "Rekening tujuan" },
          { label: "Nominal", value: fullMoney.format(amount) },
        ],
      });
    });
  }

  function toggleActive(account: BankAccount): void {
    startTransition(async () => {
      const result = await setBankAccountActive({
        bankAccountId: account.id,
        isActive: !account.isActive,
      });
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }

      setItems((current) =>
        current.map((item) =>
          item.id === account.id ? { ...item, isActive: result.data.isActive } : item,
        ),
      );
      setSelected((current) =>
        current && current.id === account.id
          ? { ...current, isActive: result.data.isActive }
          : current,
      );
      toast.success(result.data.isActive ? "Rekening diaktifkan kembali." : "Rekening diarsipkan.");
    });
  }

  return {
    items,
    selected,
    sheet,
    pending,
    success,
    accountDraft,
    movementDraft,
    transferDraft,
    accountIsDirty: accountRecovery.isDirty,
    movementIsDirty: movementRecovery.isDirty,
    transferIsDirty: transferRecovery.isDirty,
    canCreate,
    canArchive,
    transferOptions,
    totalCash,
    activeAccounts,
    unreconciledCount,
    coverage,
    setAccountDraft: accountRecovery.setPayload,
    setMovementDraft,
    setTransferDraft,
    openDetail,
    openCreate,
    openEdit,
    openMovement,
    openTransfer,
    closeSheet,
    discardAccount,
    discardMovement,
    discardTransfer,
    saveAccount,
    saveMovement,
    saveTransfer,
    toggleActive,
    clearSuccess: () => setSuccess(null),
  };
}
