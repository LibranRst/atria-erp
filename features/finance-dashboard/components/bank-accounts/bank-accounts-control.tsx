"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
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
import { fullMoney } from "@/features/finance-dashboard/lib/dashboard-formatters";
import { BankAccountCard } from "@/features/finance-dashboard/components/dashboard-cards";
import { DashboardSummarySurface } from "@/features/finance-dashboard/components/dashboard-primitives";
import { MoneyValue } from "@/components/ui/page-primitives";
import { AccountDetailSheet } from "./account-detail-sheet";
import { AccountFormSheet } from "./account-form-sheet";
import { MovementSheet } from "./movement-sheet";
import { TransferSheet } from "./transfer-sheet";
import {
  FinanceSuccessSheet,
  type FinanceOperationSuccess,
} from "@/features/finance/components/finance-form-patterns";
import { useLocalFormRecovery } from "@/features/forms/use-local-form-recovery";
import { transitionSpringSnappy } from "@/lib/utils/motion";
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

const accountCardPressScale = { scale: 0.985 } as const;

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
    <div className="ring-outline-variant/10 rounded-[28px] bg-white px-5 py-6 text-center shadow-[0_12px_28px_rgba(17,17,17,0.04)] ring-1">
      <span
        className="material-symbols-outlined bg-primary/8 text-primary mx-auto flex! h-12 w-12 items-center justify-center rounded-full text-[24px] leading-none"
        aria-hidden="true"
      >
        account_balance
      </span>
      <h3 className="text-on-surface mt-3 text-base font-bold">Belum ada rekening</h3>
      <p className="text-on-surface-variant mx-auto mt-1 max-w-[260px] text-xs leading-5">
        Tambahkan rekening kas perusahaan untuk mulai mencatat saldo dan mutasi.
      </p>
      <button
        type="button"
        disabled={!canCreate}
        onClick={onCreate}
        className="bg-primary text-on-primary mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-xs font-bold active:scale-[0.97] disabled:opacity-45"
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

export function BankAccountsControl({
  accounts,
  role,
  variant,
  payablesDueSoon = 0,
}: {
  readonly accounts: readonly BankAccount[];
  readonly role: FinanceDashboardOverview["role"];
  readonly variant: "preview" | "tab";
  readonly payablesDueSoon?: number;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
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
  const initialMovementRecovery = React.useCallback(
    () => ({
      accountId: "",
      draft: newMovementDraft("DEBIT"),
    }),
    [],
  );
  const movementRecovery = useLocalFormRecovery({
    storageKey: "atria:finance:bank-movement",
    schema: movementRecoverySchema,
    initialPayload: initialMovementRecovery,
  });
  const initialTransferRecovery = React.useCallback(
    () => ({
      accountId: "",
      draft: newTransferDraft(accounts, null),
    }),
    [accounts],
  );
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
  const selectedTransferOptions = accountOptions(items, selected?.id);
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
      movementRecovery.reset({
        accountId: account.id,
        draft: newMovementDraft(type),
      });
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
          sheet === "create" ? "Rekening baru berhasil dibuat." : "Rekening berhasil diperbarui.",
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
        const nextBalance =
          movementDraft.type === "DEBIT" ? selected.balance + amount : selected.balance - amount;
        setItems((current) =>
          current.map((item) =>
            item.id === selected.id ? { ...item, balance: nextBalance } : item,
          ),
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
              value: `${movementDraft.type === "DEBIT" ? "+" : "−"}${fullMoney.format(amount)}`,
            },
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
        setItems((current) =>
          current.map((item) => {
            if (item.id === selected.id) return { ...item, balance: item.balance - amount };
            if (item.id === transferDraft.toBankAccountId)
              return { ...item, balance: item.balance + amount };
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
            item.id === account.id ? { ...item, isActive: result.data.isActive } : item,
          ),
        );
        setSelected((current) =>
          current && current.id === account.id
            ? { ...current, isActive: result.data.isActive }
            : current,
        );
        toast.success(
          result.data.isActive ? "Rekening diaktifkan kembali." : "Rekening diarsipkan.",
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
          ? "-my-3 flex snap-x snap-mandatory scrollbar-none gap-3 overflow-x-auto px-5 py-5"
          : "grid grid-cols-1 gap-3 min-[560px]:grid-cols-2"
      }
    >
      {items.map((account) => (
        <BankAccountCard key={account.id} account={account} onSelect={openDetail} />
      ))}
    </div>
  );

  return (
    <>
      {variant === "preview" ? (
        cardList
      ) : (
        <div className="space-y-lg max-[430px]:space-y-5">
          <DashboardSummarySurface
            ariaLabel="Posisi kas rekening"
            eyebrow="Posisi kas"
            icon="account_balance"
            status={
              unreconciledCount > 0
                ? `${unreconciledCount} belum rekonsiliasi`
                : "Rekonsiliasi selesai"
            }
            statusTone={unreconciledCount > 0 ? "warning" : "positive"}
          >
            <MoneyValue
              amount={totalCash}
              variant="fullDynamic"
              size="hero"
              tone={totalCash < 0 ? "danger" : "default"}
              className="mt-1"
            />
            <div className="bg-surface-container-low/65 mt-3.5 grid grid-cols-3 divide-x divide-black/5.5 rounded-[18px] px-3 py-2.5">
              <div>
                <p className="text-on-surface-variant/60 text-[9px] font-semibold">
                  Rekening aktif
                </p>
                <p className="mt-1 font-mono text-sm font-black">{activeAccounts}</p>
              </div>
              <div className="pl-3">
                <p className="text-on-surface-variant/60 text-[9px] font-semibold max-[430px]:text-[8px]">
                  Rekonsiliasi
                </p>
                <p
                  className={`mt-1 font-mono text-sm font-black ${unreconciledCount > 0 ? "text-warning" : "text-success"}`}
                >
                  {unreconciledCount > 0 ? `${unreconciledCount} terbuka` : "Selesai"}
                </p>
              </div>
              <div className="pl-3">
                <p className="text-on-surface-variant/60 text-[9px] font-semibold">Cakupan dekat</p>
                <p
                  className={`mt-1 font-mono text-sm font-black ${coverage !== null && coverage < 1 ? "text-error" : "text-success"}`}
                >
                  {coverage === null ? "Aman" : `${coverage.toFixed(1)}×`}
                </p>
              </div>
            </div>
          </DashboardSummarySurface>

          <section className="space-y-2.5">
            <div className="flex min-h-12 items-center justify-between gap-3 px-1">
              <div className="min-w-0">
                <h2 className="text-on-surface truncate text-[18px] font-semibold tracking-[-0.015em] max-[430px]:text-[17px]">
                  Posisi rekening
                </h2>
                <p className="text-on-surface-variant mt-0.5 text-[10px] leading-tight">
                  Pilih rekening untuk melihat transaksi dan tindakan.
                </p>
              </div>
              <button
                type="button"
                disabled={!canCreate}
                onClick={openCreate}
                className="relative inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-[#007AFF]/8 px-3 text-[10px] font-semibold text-[#007AFF] outline-none after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] focus-visible:ring-2 focus-visible:ring-[#007AFF]/30 active:bg-[#007AFF]/[0.14] disabled:opacity-45"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden min-[360px]:inline">Tambah rekening</span>
                <span className="min-[360px]:hidden">Tambah</span>
              </button>
            </div>
            {items.length === 0 ? (
              <EmptyAccountsState canCreate={canCreate} onCreate={openCreate} />
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {items.map((account) => (
                  <motion.button
                    key={account.id}
                    type="button"
                    onClick={() => openDetail(account)}
                    aria-label={`Buka rekening ${account.name}`}
                    whileTap={reduceMotion ? undefined : accountCardPressScale}
                    transition={transitionSpringSnappy}
                    className={`relative flex aspect-[1.586/1] w-full flex-col overflow-hidden rounded-[28px] px-5 py-4.5 text-left shadow-[0_3px_6px_rgba(17,17,17,0.08),0_18px_42px_rgba(17,17,17,0.13)] ring-1 outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/45 max-[430px]:rounded-[24px] max-[430px]:px-4 max-[430px]:py-4 ${account.cardTextColor === "dark" ? "text-[#141414] ring-black/[0.07]" : "text-white ring-white/16"} ${account.isActive ? "" : "opacity-60 grayscale"}`}
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${account.cardColorFrom}, ${account.cardColorTo})`,
                    }}
                  >
                    <span
                      className="pointer-events-none absolute top-0 right-0 h-28 w-28 rounded-full bg-white/12 blur-2xl"
                      aria-hidden="true"
                    />
                    <span
                      className={`pointer-events-none absolute inset-x-6 top-0 h-px ${account.cardTextColor === "dark" ? "bg-white/35" : "bg-white/45"}`}
                      aria-hidden="true"
                    />
                    <span className="relative flex w-full items-start gap-3">
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] ring-1 backdrop-blur-md max-[430px]:h-10 max-[430px]:w-10 max-[430px]:rounded-[14px] ${account.cardTextColor === "dark" ? "bg-black/5.5 ring-black/8" : "bg-white/[0.14] ring-white/18"}`}
                      >
                        <span
                          className="material-symbols-outlined text-[21px] max-[430px]:text-[19px]"
                          aria-hidden="true"
                        >
                          account_balance
                        </span>
                      </span>
                      <span className="min-w-0 flex-1 pt-0.5">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm leading-[1.15] font-semibold tracking-[-0.01em]">
                            {account.name}
                          </span>
                          {!account.isActive ? (
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-semibold ring-1 ${account.cardTextColor === "dark" ? "bg-black/5.5 ring-black/8" : "bg-white/[0.14] ring-white/18"}`}
                            >
                              Tidak aktif
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 block truncate text-[10px] leading-[1.2] font-medium tracking-[0.08em] uppercase opacity-65">
                          {account.bankName}
                        </span>
                      </span>
                      <span
                        className="material-symbols-outlined shrink-0 pt-1 text-[23px] opacity-65"
                        aria-hidden="true"
                      >
                        contactless
                      </span>
                    </span>

                    <span className="relative mt-auto block pt-3">
                      <span className="block text-[9px] font-semibold tracking-[0.13em] uppercase opacity-60">
                        Saldo tersedia
                      </span>
                      <MoneyValue
                        amount={account.balance}
                        variant="fullDynamic"
                        size="lg"
                        tone={
                          account.balance < 0
                            ? "danger"
                            : account.cardTextColor === "dark"
                              ? "inherit"
                              : "inverse"
                        }
                        className="mt-1.5"
                      />
                    </span>

                    <span className="relative mt-3 flex items-center justify-between gap-3">
                      <span className="font-mono text-[11px] font-semibold tracking-[0.16em] opacity-75">
                        •••• {account.accountNumber.slice(-4)}
                      </span>
                      <span className="max-w-[55%] min-w-0 truncate text-right text-[9px] font-semibold tracking-widest uppercase opacity-60">
                        {account.holderName}
                      </span>
                    </span>
                    <span
                      className={`relative mt-3 flex min-h-9 w-full items-center gap-2 rounded-[14px] px-2.5 py-1.5 ring-1 backdrop-blur-md ${account.cardTextColor === "dark" ? "bg-black/4.5 ring-black/6" : "bg-white/10 ring-white/12"}`}
                    >
                      <span
                        className="material-symbols-outlined shrink-0 text-[15px] opacity-65"
                        aria-hidden="true"
                      >
                        receipt_long
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[9px] font-medium opacity-75">
                        {account.recentTransactions[0]?.description ?? "Belum ada transaksi"}
                      </span>
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${account.cardTextColor === "dark" ? "bg-black/6" : "bg-white/12"}`}
                        aria-hidden="true"
                      >
                        <span className="material-symbols-outlined text-[15px] opacity-70">
                          chevron_right
                        </span>
                      </span>
                    </span>
                  </motion.button>
                ))}
              </div>
            )}
          </section>
        </div>
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
        onDiscard={() => {
          accountRecovery.reset();
          closeSheet();
        }}
        onSave={saveAccount}
      />

      <MovementSheet
        key={`movement-${sheet ?? "closed"}-${selected?.id ?? "none"}`}
        open={sheet === "movement" && selected !== null}
        account={selected}
        draft={movementDraft}
        setDraft={(update) =>
          movementRecovery.setPayload((current) => ({
            ...current,
            draft: typeof update === "function" ? update(current.draft) : update,
          }))
        }
        isDirty={movementRecovery.isDirty}
        pending={pending}
        onClose={closeSheet}
        onDiscard={() => {
          movementRecovery.reset();
          closeSheet();
        }}
        onSave={saveMovement}
      />

      <TransferSheet
        key={`transfer-${sheet ?? "closed"}-${selected?.id ?? "none"}`}
        open={sheet === "transfer" && selected !== null}
        account={selected}
        accounts={items}
        options={selectedTransferOptions}
        draft={transferDraft}
        setDraft={(update) =>
          transferRecovery.setPayload((current) => ({
            ...current,
            draft: typeof update === "function" ? update(current.draft) : update,
          }))
        }
        isDirty={transferRecovery.isDirty}
        pending={pending}
        onClose={closeSheet}
        onDiscard={() => {
          transferRecovery.reset();
          closeSheet();
        }}
        onSave={saveTransfer}
      />
      <FinanceSuccessSheet success={success} onClose={() => setSuccess(null)} />
    </>
  );
}
