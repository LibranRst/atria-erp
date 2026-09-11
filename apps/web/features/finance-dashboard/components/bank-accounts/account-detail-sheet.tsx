import React from "react";

import { AppIcon, DetailSheet, Button, useSheetPresenceValue } from "@/components/ui";
import { BankAccountCard } from "@/features/finance-dashboard/components/cards/dashboard-cards";
import { AccountTransactionRows } from "./account-transaction-rows";
import type { BankAccount } from "@/features/finance-dashboard/types/bank-account-types";

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
    <DetailSheet
      open={open && account !== null}
      title={presentedAccount?.name ?? "Rekening"}
      onClose={onClose}
      onExitComplete={handleExitComplete}
    >
      {presentedAccount ? (
        <div className="space-y-md">
          <BankAccountCard account={presentedAccount} variant="full" />
          <section className="overflow-hidden rounded-owner bg-surface-container-lowest ring-1 ring-ring-subtle">
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
                <p className="shrink-0 text-meta font-medium text-on-surface-variant">{label}</p>
                <p className="min-w-0 truncate text-right text-xs font-semibold text-on-surface">
                  {value}
                </p>
              </div>
            ))}
          </section>

          <section className="space-y-2.5 rounded-owner bg-surface-container-lowest p-3 ring-1 ring-ring-subtle">
            {/* Satu baris untuk seluruh grup, bukan satu per tombol: penyebabnya
                sama untuk semuanya, dan pemulihannya ada di sheet yang sama. */}
            <div aria-live="polite" className="empty:hidden">
              {!presentedAccount.isActive ? (
                <p className="px-1 text-meta font-medium text-on-surface-variant">
                  Rekening ini diarsipkan. Aktifkan kembali di bawah untuk mencatat mutasi.
                </p>
              ) : !canTransfer ? (
                <p className="px-1 text-meta font-medium text-on-surface-variant">
                  Transfer butuh setidaknya satu rekening aktif lain sebagai tujuan.
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="primary"
                fullWidth
                leadingIcon={<AppIcon name="south_west" className="icon-sm" />}
                disabled={!presentedAccount.isActive}
                onClick={() => onDebit(presentedAccount)}
              >
                Kas masuk
              </Button>
              <Button
                type="button"
                variant="criticalQuiet"
                fullWidth
                leadingIcon={<AppIcon name="north_east" className="icon-sm" />}
                disabled={!presentedAccount.isActive}
                onClick={() => onCredit(presentedAccount)}
              >
                Kas keluar
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-outline-variant/20 pt-2">
              <Button
                type="button"
                variant="secondary"
                fullWidth
                leadingIcon={<AppIcon name="swap_horiz" className="icon-sm" />}
                disabled={!presentedAccount.isActive || !canTransfer}
                onClick={() => onTransfer(presentedAccount)}
              >
                Transfer
              </Button>
              <Button
                type="button"
                variant="secondary"
                fullWidth
                leadingIcon={<AppIcon name="edit" className="icon-sm" />}
                onClick={() => onEdit(presentedAccount)}
              >
                Edit
              </Button>
            </div>
          </section>
          {canArchive ? (
            <Button
              type="button"
              variant="criticalQuiet"
              fullWidth
              leadingIcon={<AppIcon name="restore" className="icon-sm" />}
              disabled={pending}
              onClick={() => onToggleActive(presentedAccount)}
            >
              {presentedAccount.isActive ? "Arsipkan rekening" : "Aktifkan kembali"}
            </Button>
          ) : null}
          <section className="space-y-2.5">
            <h3 className="px-1 text-meta font-bold tracking-[0.11em] text-on-surface uppercase">
              Aktivitas terbaru
            </h3>
            <div className="overflow-hidden rounded-owner bg-surface-container-lowest ring-1 ring-ring-subtle">
              <AccountTransactionRows transactions={presentedAccount.recentTransactions} />
            </div>
          </section>
        </div>
      ) : null}
    </DetailSheet>
  );
}
