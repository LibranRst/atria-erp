import React from "react";
import { AppIcon } from "@/components/ui";

import { BankAccountCard } from "@/features/finance-dashboard/components/cards/dashboard-cards";
import type { BankAccount } from "@/features/finance-dashboard/types/bank-account-types";

function QuickActionButton({
  label,
  compactLabel,
  icon,
  onClick,
  disabled,
  tone = "neutral",
}: {
  readonly label: string;
  readonly compactLabel?: string;
  readonly icon: React.ReactNode;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly tone?: "neutral" | "primary" | "danger";
}): React.JSX.Element {
  const toneClass =
    tone === "primary"
      ? "bg-primary/8 text-primary"
      : tone === "danger"
        ? "bg-error/8 text-error"
        : "bg-surface-container-low text-on-surface";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-full px-1 text-eyebrow font-bold transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 min-[430px]:gap-1.5 min-[500px]:px-3 min-[500px]:text-meta ${toneClass}`}
    >
      <span className="shrink-0">{icon}</span>
      {compactLabel ? (
        <>
          <span className="min-w-0 truncate min-[390px]:hidden">{compactLabel}</span>
          <span className="hidden min-w-0 truncate min-[390px]:inline">{label}</span>
        </>
      ) : (
        <span className="min-w-0 truncate">{label}</span>
      )}
    </button>
  );
}

export function AccountWorkspaceCard({
  account,
  canTransfer,
  onSelect,
  onDebit,
  onCredit,
  onTransfer,
  onEdit,
}: {
  readonly account: BankAccount;
  readonly canTransfer: boolean;
  readonly onSelect: (account: BankAccount) => void;
  readonly onDebit: () => void;
  readonly onCredit: () => void;
  readonly onTransfer: () => void;
  readonly onEdit: () => void;
}): React.JSX.Element {
  return (
    <article className="min-w-0 space-y-2.5">
      <BankAccountCard account={account} onSelect={onSelect} variant="full" />
      <div className="grid grid-cols-4 gap-1.5 min-[390px]:gap-2">
        <QuickActionButton
          label="Masuk"
          icon={<AppIcon name="south_west" className="icon-sm" />}
          disabled={!account.isActive}
          tone="primary"
          onClick={onDebit}
        />
        <QuickActionButton
          label="Keluar"
          icon={<AppIcon name="north_east" className="icon-sm" />}
          disabled={!account.isActive}
          tone="danger"
          onClick={onCredit}
        />
        <QuickActionButton
          label="Transfer"
          compactLabel="Pindah"
          icon={<AppIcon name="swap_horiz" className="icon-sm" />}
          disabled={!account.isActive || !canTransfer}
          onClick={onTransfer}
        />
        <QuickActionButton
          label="Edit"
          icon={<AppIcon name="edit" className="icon-sm" />}
          onClick={onEdit}
        />
      </div>
      {/* Hanya kasus terarsip yang dijelaskan di kartu: itu keadaan tak lazim
          yang memang tidak terbaca dari tombol. Alasan tujuan transfer dijelaskan
          di sheet detail, supaya daftar kartu tidak mengulang kalimat yang sama. */}
      {!account.isActive ? (
        <p className="px-1 text-meta font-medium text-on-surface-variant">
          Diarsipkan — buka rekening ini untuk mengaktifkannya kembali.
        </p>
      ) : null}
    </article>
  );
}
