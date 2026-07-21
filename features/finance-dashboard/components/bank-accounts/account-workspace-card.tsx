import React from "react";
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Pencil } from "lucide-react";

import { BankAccountCard } from "@/features/finance-dashboard/components/dashboard-cards";
import type { BankAccount } from "./types";

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
      className={`flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-full px-1 text-[9px] font-bold transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 min-[430px]:gap-1.5 min-[500px]:px-3 min-[500px]:text-[10px] ${toneClass}`}
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
          icon={<ArrowDownLeft className="h-4 w-4" />}
          disabled={!account.isActive}
          tone="primary"
          onClick={onDebit}
        />
        <QuickActionButton
          label="Keluar"
          icon={<ArrowUpRight className="h-4 w-4" />}
          disabled={!account.isActive}
          tone="danger"
          onClick={onCredit}
        />
        <QuickActionButton
          label="Transfer"
          compactLabel="Pindah"
          icon={<ArrowRightLeft className="h-4 w-4" />}
          disabled={!account.isActive || !canTransfer}
          onClick={onTransfer}
        />
        <QuickActionButton label="Edit" icon={<Pencil className="h-4 w-4" />} onClick={onEdit} />
      </div>
    </article>
  );
}
