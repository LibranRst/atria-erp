import React from "react";
import { ArchiveRestore, ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Pencil } from "lucide-react";

import { BottomSheet, useSheetPresenceValue } from "@/components/ui";
import { BankAccountCard } from "@/features/finance-dashboard/components/dashboard-cards";
import { AccountTransactionRows } from "./account-transaction-rows";
import type { BankAccount } from "./types";

export function AccountDetailSheet({
  open,
  account,
  canArchive,
  canTransfer,
  pending,
  onClose,
  onDebit,
  onCredit,
  onTransfer,
  onEdit,
  onToggleActive,
}: {
  readonly open: boolean;
  readonly account: BankAccount | null;
  readonly canArchive: boolean;
  readonly canTransfer: boolean;
  readonly pending: boolean;
  readonly onClose: () => void;
  readonly onDebit: (account: BankAccount) => void;
  readonly onCredit: (account: BankAccount) => void;
  readonly onTransfer: (account: BankAccount) => void;
  readonly onEdit: (account: BankAccount) => void;
  readonly onToggleActive: (account: BankAccount) => void;
}): React.JSX.Element {
  const { presentedValue: presentedAccount, handleExitComplete } = useSheetPresenceValue(
    open ? account : null,
    open ? account?.id : null,
  );

  return (
    <BottomSheet
      open={open && account !== null}
      title={presentedAccount?.name ?? "Rekening"}
      onClose={onClose}
      onExitComplete={handleExitComplete}
    >
      {presentedAccount ? (
        <div className="space-y-md">
          <BankAccountCard account={presentedAccount} variant="full" />
          <section className="bg-surface-container-lowest ring-outline-variant/15 overflow-hidden rounded-[24px] shadow-[0_10px_28px_rgba(17,17,17,0.035)] ring-1">
            {[
              ["Bank", presentedAccount.bankName],
              ["Pemegang", presentedAccount.holderName],
              ["Nomor rekening", presentedAccount.accountNumber],
              ["Status", presentedAccount.isActive ? "Aktif" : "Diarsipkan"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="border-outline-variant/20 flex min-h-12 items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0"
              >
                <p className="text-on-surface-variant shrink-0 text-[10px] font-medium">{label}</p>
                <p className="text-on-surface min-w-0 truncate text-right text-xs font-semibold">
                  {value}
                </p>
              </div>
            ))}
          </section>

          <section className="bg-surface-container-lowest ring-outline-variant/15 space-y-2.5 rounded-[24px] p-3 shadow-[0_10px_28px_rgba(17,17,17,0.035)] ring-1">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!presentedAccount.isActive}
                onClick={() => onDebit(presentedAccount)}
                className="bg-primary text-on-primary flex min-h-12 items-center justify-center gap-2 rounded-full px-4 text-xs font-bold active:scale-[0.97] disabled:opacity-45"
              >
                <ArrowDownLeft className="h-4 w-4" />
                Kas masuk
              </button>
              <button
                type="button"
                disabled={!presentedAccount.isActive}
                onClick={() => onCredit(presentedAccount)}
                className="bg-error-container/35 text-error flex min-h-12 items-center justify-center gap-2 rounded-full px-4 text-xs font-bold active:scale-[0.97] disabled:opacity-45"
              >
                <ArrowUpRight className="h-4 w-4" />
                Kas keluar
              </button>
            </div>
            <div className="divide-outline-variant/20 border-outline-variant/20 grid grid-cols-2 divide-x border-t pt-1">
              <button
                type="button"
                disabled={!presentedAccount.isActive || !canTransfer}
                onClick={() => onTransfer(presentedAccount)}
                className="text-on-surface active:bg-surface-container-low flex min-h-12 items-center justify-center gap-2 rounded-full text-xs font-bold disabled:opacity-45"
              >
                <ArrowRightLeft className="h-4 w-4" />
                Transfer
              </button>
              <button
                type="button"
                onClick={() => onEdit(presentedAccount)}
                className="text-on-surface active:bg-surface-container-low flex min-h-12 items-center justify-center gap-2 rounded-full text-xs font-bold"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>
            </div>
          </section>
          {canArchive ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => onToggleActive(presentedAccount)}
              className="bg-error-container/20 text-error flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-4 text-xs font-bold active:scale-[0.97] disabled:opacity-45"
            >
              <ArchiveRestore className="h-4 w-4" />
              {presentedAccount.isActive ? "Arsipkan rekening" : "Aktifkan kembali"}
            </button>
          ) : null}
          <section className="space-y-2.5">
            <h3 className="text-on-surface px-1 text-[10px] font-bold tracking-[0.11em] uppercase">
              Aktivitas terbaru
            </h3>
            <div className="bg-surface-container-lowest ring-outline-variant/15 overflow-hidden rounded-[24px] shadow-[0_10px_28px_rgba(17,17,17,0.035)] ring-1">
              <AccountTransactionRows transactions={presentedAccount.recentTransactions} />
            </div>
          </section>
        </div>
      ) : null}
    </BottomSheet>
  );
}
