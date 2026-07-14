"use client";

import React from "react";
import { Plus } from "lucide-react";
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
import {
  fullMoney,
  shortMoney,
} from "@/features/finance-dashboard/lib/dashboard-formatters";
import { BankAccountCard } from "@/features/finance-dashboard/components/dashboard-cards";
import {
  DashboardTabShell,
  type DashboardMetricItem,
} from "@/features/finance-dashboard/components/dashboard-primitives";
import { AccountDetailSheet } from "./account-detail-sheet";
import { AccountFormSheet } from "./account-form-sheet";
import { AccountWorkspaceCard } from "./account-workspace-card";
import { MovementSheet } from "./movement-sheet";
import { TransferSheet } from "./transfer-sheet";
import { FinanceSuccessSheet, type FinanceOperationSuccess } from "@/features/finance/components/finance-form-patterns";
import { useLocalFormRecovery } from "@/features/forms/use-local-form-recovery";
import type {
  AccountDraft,
  BankAccount,
  MovementDraft,
  MovementType,
  SheetMode,
  TransferDraft,
} from "./types";
import {
  accountOptions,
  accountToDraft,
  applyAccountUpdate,
  newAccountDraft,
  newMovementDraft,
  newTransferDraft,
} from "./utils";

const movementRecoverySchema = z.object({
  accountId: z.string(),
  draft: z.object({
    type: z.enum(["DEBIT", "CREDIT"]),
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

function EmptyAccountsState({
  canCreate,
  onCreate,
}: {
  readonly canCreate: boolean;
  readonly onCreate: () => void;
}): React.JSX.Element {
  return (
    <div className="rounded-[28px] bg-white px-5 py-6 text-center shadow-[0_12px_28px_rgba(17,17,17,0.04)] ring-1 ring-outline-variant/10">
      <span className="material-symbols-outlined mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/8 text-[24px] text-primary">
        account_balance
      </span>
      <h3 className="mt-3 text-base font-bold text-on-surface">
        Belum ada rekening
      </h3>
      <p className="mx-auto mt-1 max-w-[260px] text-xs leading-5 text-on-surface-variant">
        Tambahkan rekening kas perusahaan untuk mulai mencatat saldo dan mutasi.
      </p>
      <button
        type="button"
        disabled={!canCreate}
        onClick={onCreate}
        className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-xs font-bold text-on-primary active:scale-[0.97] disabled:opacity-45"
      >
        <Plus className="h-4 w-4" />
        Tambah rekening
      </button>
    </div>
  );
}

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

function useBankAccountMetrics(
  items: readonly BankAccount[],
): readonly DashboardMetricItem[] {
  const activeAccounts = items.filter((account) => account.isActive);
  const totalCash = items.reduce((sum, account) => sum + account.balance, 0);

  return [
    {
      label: "Total kas",
      value: shortMoney(totalCash),
      kind: "money",
      amount: totalCash,
      fullValue: fullMoney.format(totalCash),
      tone: totalCash > 0 ? "positive" : "default",
    },
    {
      label: "Aktif",
      value: String(activeAccounts.length),
      tone: activeAccounts.length > 0 ? "positive" : "default",
    },
    {
      label: "Mutasi",
      value: String(
        items.reduce(
          (sum, account) => sum + account.recentTransactions.length,
          0,
        ),
      ),
      tone: "default",
    },
  ];
}

export function BankAccountsControl({
  accounts,
  role,
  variant,
}: {
  readonly accounts: readonly BankAccount[];
  readonly role: FinanceDashboardOverview["role"];
  readonly variant: "preview" | "tab";
}): React.JSX.Element {
  const [items, setItems] = React.useState<readonly BankAccount[]>(accounts);
  const [selected, setSelected] = React.useState<BankAccount | null>(null);
  const [sheet, setSheet] = React.useState<SheetMode | null>(null);
  const initialAccountRecovery = React.useCallback((): AccountDraft => newAccountDraft(), []);
  const accountRecovery = useLocalFormRecovery({
    storageKey: "atria:finance:bank-account",
    schema: accountRecoverySchema,
    initialPayload: initialAccountRecovery,
  });
  const accountDraft: AccountDraft = accountRecovery.payload;
  const initialMovementRecovery = React.useCallback(() => ({
    accountId: "",
    draft: newMovementDraft("DEBIT"),
  }), []);
  const movementRecovery = useLocalFormRecovery({
    storageKey: "atria:finance:bank-movement",
    schema: movementRecoverySchema,
    initialPayload: initialMovementRecovery,
  });
  const initialTransferRecovery = React.useCallback(() => ({
    accountId: "",
    draft: newTransferDraft(accounts, null),
  }), [accounts]);
  const transferRecovery = useLocalFormRecovery({
    storageKey: "atria:finance:bank-transfer",
    schema: transferRecoverySchema,
    initialPayload: initialTransferRecovery,
  });
  const movementDraft: MovementDraft = movementRecovery.payload.draft;
  const transferDraft: TransferDraft = transferRecovery.payload.draft;
  const [pending, startTransition] = React.useTransition();
  const [success, setSuccess] = React.useState<FinanceOperationSuccess | null>(null);

  const canCreate = role === "OWNER";
  const canArchive = role === "OWNER";
  const metrics = useBankAccountMetrics(items);
  const selectedTransferOptions = accountOptions(items, selected?.id);

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
      transferRecovery.reset({ accountId: account.id, draft: newTransferDraft(items, account) });
    }
    setSheet("transfer");
  }

  function closeSheet(): void {
    setSheet(null);
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
                error: {
                  code: "VALIDATION_ERROR",
                  message: "Rekening belum dipilih.",
                },
              };

      if (result.success) {
        const updatedAccount = accountFromActionData(result.data);
        setItems((current) => applyAccountUpdate(current, updatedAccount));
        setSelected(updatedAccount);
        accountRecovery.clear();
        setSheet("detail");
        toast.success(
          sheet === "create"
            ? "Rekening baru berhasil dibuat."
            : "Rekening berhasil diperbarui.",
        );
      } else {
        toast.error(result.error.message);
      }
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

      if (result.success) {
        const amount = Number(movementDraft.amount || 0);
        const nextBalance = movementDraft.type === "DEBIT"
          ? selected.balance + amount
          : selected.balance - amount;
        setItems((current) => current.map((item) => item.id === selected.id ? { ...item, balance: nextBalance } : item));
        setSelected((current) => current ? { ...current, balance: nextBalance } : current);
        movementRecovery.clear();
        setSheet(null);
        setSuccess({
          title: "Mutasi kas tercatat",
          description: "Ledger dan saldo rekening sudah diperbarui dalam satu transaksi.",
          facts: [
            { label: "Rekening", value: selected.name },
            { label: "Mutasi", value: `${movementDraft.type === "DEBIT" ? "+" : "−"}${fullMoney.format(amount)}` },
            { label: "Saldo sekarang", value: fullMoney.format(nextBalance) },
          ],
        });
      } else {
        toast.error(result.error.message);
      }
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

      if (result.success) {
        const amount = Number(transferDraft.amount || 0);
        const target = items.find((item) => item.id === transferDraft.toBankAccountId);
        setItems((current) => current.map((item) => {
          if (item.id === selected.id) return { ...item, balance: item.balance - amount };
          if (item.id === transferDraft.toBankAccountId) return { ...item, balance: item.balance + amount };
          return item;
        }));
        transferRecovery.clear();
        setSheet(null);
        setSuccess({
          title: "Transfer rekening tercatat",
          description: "Saldo sumber dan tujuan sudah diperbarui dengan referensi transfer yang sama.",
          facts: [
            { label: "Dari", value: selected.name },
            { label: "Ke", value: target?.name ?? "Rekening tujuan" },
            { label: "Nominal", value: fullMoney.format(amount) },
          ],
        });
      } else {
        toast.error(result.error.message);
      }
    });
  }

  function toggleActive(account: BankAccount): void {
    startTransition(async () => {
      const result = await setBankAccountActive({
        bankAccountId: account.id,
        isActive: !account.isActive,
      });
      if (result.success) {
        setItems((current) =>
          current.map((item) =>
            item.id === account.id
              ? { ...item, isActive: result.data.isActive }
              : item,
          ),
        );
        setSelected((current) =>
          current && current.id === account.id
            ? { ...current, isActive: result.data.isActive }
            : current,
        );
        toast.success(
          result.data.isActive
            ? "Rekening diaktifkan kembali."
            : "Rekening diarsipkan.",
        );
      } else {
        toast.error(result.error.message);
      }
    });
  }

  const cardList = (
    <div
      className={
        variant === "preview"
          ? "-my-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 py-5 scrollbar-none"
          : "grid grid-cols-1 gap-3 min-[560px]:grid-cols-2"
      }
    >
      {items.map((account) => (
        <BankAccountCard
          key={account.id}
          account={account}
          onSelect={openDetail}
        />
      ))}
    </div>
  );

  return (
    <>
      {variant === "preview" ? (
        cardList
      ) : (
        <DashboardTabShell metrics={metrics}>
          <section className="space-y-3">
            <div className="flex min-h-12 items-center justify-between gap-3 px-1">
              <div className="min-w-0">
                <h2 className="truncate text-[20px] font-semibold leading-6 text-on-surface">
                  Kas & rekening
                </h2>
              </div>
              <button
                type="button"
                disabled={!canCreate}
                onClick={openCreate}
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-primary px-4 text-[11px] font-bold text-on-primary shadow-[0_10px_24px_rgba(17,17,17,0.08)] transition active:scale-[0.97] disabled:opacity-45 min-[390px]:px-5"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden min-[360px]:inline">
                  Tambah rekening
                </span>
                <span className="min-[360px]:hidden">Tambah</span>
              </button>
            </div>
            {items.length === 0 ? (
              <EmptyAccountsState canCreate={canCreate} onCreate={openCreate} />
            ) : (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-4">
                {items.map((account) => (
                  <AccountWorkspaceCard
                    key={account.id}
                    account={account}
                    canTransfer={accountOptions(items, account.id).length > 0}
                    onSelect={openDetail}
                    onDebit={() => openMovement(account, "DEBIT")}
                    onCredit={() => openMovement(account, "CREDIT")}
                    onTransfer={() => openTransfer(account)}
                    onEdit={() => openEdit(account)}
                  />
                ))}
              </div>
            )}
          </section>
        </DashboardTabShell>
      )}

      <AccountDetailSheet
        open={sheet === "detail"}
        account={selected}
        canArchive={canArchive}
        canTransfer={selectedTransferOptions.length > 0}
        pending={pending}
        onClose={closeSheet}
        onDebit={(account) => openMovement(account, "DEBIT")}
        onCredit={(account) => openMovement(account, "CREDIT")}
        onTransfer={openTransfer}
        onEdit={openEdit}
        onToggleActive={toggleActive}
      />

      <AccountFormSheet
        open={sheet === "create" || sheet === "edit"}
        title={sheet === "create" ? "Tambah rekening" : "Edit rekening"}
        draft={accountDraft}
        setDraft={accountRecovery.setPayload}
        isDirty={accountRecovery.isDirty}
        pending={pending}
        canEditStatus={canArchive && sheet === "edit"}
        onClose={closeSheet}
        onDiscard={() => { accountRecovery.reset(); closeSheet(); }}
        onSave={saveAccount}
      />

      <MovementSheet
        key={`movement-${sheet ?? "closed"}-${selected?.id ?? "none"}`}
        open={sheet === "movement" && selected !== null}
        account={selected}
        draft={movementDraft}
        setDraft={(update) => movementRecovery.setPayload((current) => ({
          ...current,
          draft: typeof update === "function" ? update(current.draft) : update,
        }))}
        isDirty={movementRecovery.isDirty}
        pending={pending}
        onClose={closeSheet}
        onDiscard={() => { movementRecovery.reset(); closeSheet(); }}
        onSave={saveMovement}
      />

      <TransferSheet
        key={`transfer-${sheet ?? "closed"}-${selected?.id ?? "none"}`}
        open={sheet === "transfer" && selected !== null}
        account={selected}
        accounts={items}
        options={selectedTransferOptions}
        draft={transferDraft}
        setDraft={(update) => transferRecovery.setPayload((current) => ({
          ...current,
          draft: typeof update === "function" ? update(current.draft) : update,
        }))}
        isDirty={transferRecovery.isDirty}
        pending={pending}
        onClose={closeSheet}
        onDiscard={() => { transferRecovery.reset(); closeSheet(); }}
        onSave={saveTransfer}
      />
      <FinanceSuccessSheet success={success} onClose={() => setSuccess(null)} />
    </>
  );
}
