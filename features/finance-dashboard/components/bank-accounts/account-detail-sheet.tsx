import React from "react";
import {
  ArchiveRestore,
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Pencil,
} from "lucide-react";

import { BottomSheet } from "@/components/ui";
import { BankAccountCard } from "@/features/finance-dashboard/components/dashboard-cards";
import { AccountTransactionRows } from "./account-transaction-rows";
import { InfoPill } from "./info-pill";
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
  return (
    <BottomSheet
      open={open && account !== null}
      title={account?.name ?? "Rekening"}
      onClose={onClose}
    >
      {account ? (
        <div className="space-y-md">
          <BankAccountCard account={account} variant="full" />
          <div className="grid grid-cols-2 gap-2">
            <InfoPill label="Bank" value={account.bankName} />
            <InfoPill label="Pemegang" value={account.holderName} />
            <InfoPill label="Nomor" value={account.accountNumber} />
            <InfoPill
              label="Status"
              value={account.isActive ? "Aktif" : "Archived"}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!account.isActive}
              onClick={() => onDebit(account)}
              className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-bold text-on-primary active:scale-[0.97] disabled:opacity-45"
            >
              <ArrowDownLeft className="h-4 w-4" />
              Kas masuk
            </button>
            <button
              type="button"
              disabled={!account.isActive}
              onClick={() => onCredit(account)}
              className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-error px-4 text-xs font-bold text-white active:scale-[0.97] disabled:opacity-45"
            >
              <ArrowUpRight className="h-4 w-4" />
              Kas keluar
            </button>
            <button
              type="button"
              disabled={!account.isActive || !canTransfer}
              onClick={() => onTransfer(account)}
              className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-surface-container-low px-4 text-xs font-bold text-on-surface active:scale-[0.97] disabled:opacity-45"
            >
              <ArrowRightLeft className="h-4 w-4" />
              Transfer
            </button>
            <button
              type="button"
              onClick={() => onEdit(account)}
              className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-surface-container-low px-4 text-xs font-bold text-on-surface active:scale-[0.97]"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          </div>
          {canArchive ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => onToggleActive(account)}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-surface-container-low px-4 text-xs font-bold text-on-surface active:scale-[0.97] disabled:opacity-45"
            >
              <ArchiveRestore className="h-4 w-4" />
              {account.isActive ? "Arsipkan rekening" : "Aktifkan kembali"}
            </button>
          ) : null}
          <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_12px_28px_rgba(17,17,17,0.04)] ring-1 ring-outline-variant/10">
            <AccountTransactionRows transactions={account.recentTransactions} />
          </section>
        </div>
      ) : null}
    </BottomSheet>
  );
}
