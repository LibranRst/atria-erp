import React from "react";
import {
  ArchiveRestore,
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Pencil,
} from "lucide-react";

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
  const { presentedValue: presentedAccount, handleExitComplete } =
    useSheetPresenceValue(open ? account : null, open ? account?.id : null);

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
          <section className="overflow-hidden rounded-[24px] bg-surface-container-lowest shadow-[0_10px_28px_rgba(17,17,17,0.035)] ring-1 ring-outline-variant/15">
            {[
              ["Bank", presentedAccount.bankName],
              ["Pemegang", presentedAccount.holderName],
              ["Nomor rekening", presentedAccount.accountNumber],
              ["Status", presentedAccount.isActive ? "Aktif" : "Diarsipkan"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex min-h-12 items-center justify-between gap-4 border-b border-outline-variant/20 px-4 py-3 last:border-b-0"
              >
                <p className="shrink-0 text-[10px] font-medium text-on-surface-variant">
                  {label}
                </p>
                <p className="min-w-0 truncate text-right text-xs font-semibold text-on-surface">
                  {value}
                </p>
              </div>
            ))}
          </section>

          <section className="space-y-2.5 rounded-[24px] bg-surface-container-lowest p-3 shadow-[0_10px_28px_rgba(17,17,17,0.035)] ring-1 ring-outline-variant/15">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!presentedAccount.isActive}
                onClick={() => onDebit(presentedAccount)}
                className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-bold text-on-primary active:scale-[0.97] disabled:opacity-45"
              >
                <ArrowDownLeft className="h-4 w-4" />
                Kas masuk
              </button>
              <button
                type="button"
                disabled={!presentedAccount.isActive}
                onClick={() => onCredit(presentedAccount)}
                className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-error-container/35 px-4 text-xs font-bold text-error active:scale-[0.97] disabled:opacity-45"
              >
                <ArrowUpRight className="h-4 w-4" />
                Kas keluar
              </button>
            </div>
            <div className="grid grid-cols-2 divide-x divide-outline-variant/20 border-t border-outline-variant/20 pt-1">
              <button
                type="button"
                disabled={!presentedAccount.isActive || !canTransfer}
                onClick={() => onTransfer(presentedAccount)}
                className="flex min-h-12 items-center justify-center gap-2 rounded-full text-xs font-bold text-on-surface active:bg-surface-container-low disabled:opacity-45"
              >
                <ArrowRightLeft className="h-4 w-4" />
                Transfer
              </button>
              <button
                type="button"
                onClick={() => onEdit(presentedAccount)}
                className="flex min-h-12 items-center justify-center gap-2 rounded-full text-xs font-bold text-on-surface active:bg-surface-container-low"
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
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-error-container/20 px-4 text-xs font-bold text-error active:scale-[0.97] disabled:opacity-45"
            >
              <ArchiveRestore className="h-4 w-4" />
              {presentedAccount.isActive
                ? "Arsipkan rekening"
                : "Aktifkan kembali"}
            </button>
          ) : null}
          <section className="space-y-2.5">
            <h3 className="px-1 text-[10px] font-bold uppercase tracking-[0.11em] text-on-surface">
              Aktivitas terbaru
            </h3>
            <div className="overflow-hidden rounded-[24px] bg-surface-container-lowest shadow-[0_10px_28px_rgba(17,17,17,0.035)] ring-1 ring-outline-variant/15">
              <AccountTransactionRows
                transactions={presentedAccount.recentTransactions}
              />
            </div>
          </section>
        </div>
      ) : null}
    </BottomSheet>
  );
}
