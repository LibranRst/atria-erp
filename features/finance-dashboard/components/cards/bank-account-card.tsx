"use client";

import React from "react";

import { AppIcon, MoneyValue } from "@/components/ui";
import type { FinanceDashboardOverview } from "@/app/actions/finance/dashboard-overview";
export function BankAccountCard({
  account,
  onSelect,
  variant = "compact",
}: {
  readonly account: FinanceDashboardOverview["bankAccounts"][number];
  readonly onSelect?: (account: FinanceDashboardOverview["bankAccounts"][number]) => void;
  readonly variant?: "compact" | "full";
}): React.JSX.Element {
  const textClass = account.cardTextColor === "dark" ? "text-on-surface" : "text-white";
  const inactiveClass = account.isActive ? "" : "opacity-60 grayscale";
  const full = variant === "full";

  const content = full ? (
    <div
      className={`relative flex aspect-[1.586/1] w-full flex-col overflow-hidden rounded-[28px] p-5 text-left shadow-floating ring-1 ${textClass} ${inactiveClass} ${account.cardTextColor === "dark" ? "ring-ring-subtle" : "ring-white/16"}`}
      style={{
        backgroundImage: `linear-gradient(135deg, ${account.cardColorFrom}, ${account.cardColorTo})`,
      }}
    >
      <span
        className="pointer-events-none absolute top-0 right-0 h-32 w-32 rounded-full bg-white/12 blur-2xl"
        aria-hidden="true"
      />
      <div className="relative flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-white/14 ring-1 ring-white/15 backdrop-blur-sm">
          <AppIcon name="account_balance" className="text-[21px]" />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="truncate text-sm leading-[1.15] font-semibold tracking-[-0.01em]">
            {account.name}
          </h3>
          <p className="mt-1 truncate text-[10px] leading-[1.2] font-medium tracking-[0.08em] uppercase opacity-65">
            {account.bankName}
          </p>
        </div>
        <AppIcon name="contactless" className="shrink-0 pt-1 text-[23px] opacity-65" />
      </div>

      <div className="relative mt-auto pt-3">
        <p className="text-[9px] font-semibold tracking-[0.13em] uppercase opacity-60">
          Saldo tersedia
        </p>
        <MoneyValue
          amount={account.balance}
          variant="fullDynamic"
          tone={account.cardTextColor === "dark" ? "inherit" : "inverse"}
          size="lg"
          className="mt-1.5"
        />
      </div>

      <div className="relative mt-4 flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] font-semibold tracking-[0.16em] opacity-75">
          •••• {account.accountNumber.slice(-4)}
        </p>
        <p className="max-w-[55%] min-w-0 truncate text-right text-[9px] font-semibold tracking-widest uppercase opacity-60">
          {account.holderName}
        </p>
      </div>
    </div>
  ) : (
    <div
      className={`relative flex min-h-30 w-60 shrink-0 snap-start flex-col justify-between overflow-hidden rounded-2xl p-4 text-left shadow-surface transition active:scale-[0.99] ${textClass} ${inactiveClass}`}
      style={{
        backgroundImage: `linear-gradient(135deg, ${account.cardColorFrom}, ${account.cardColorTo})`,
      }}
    >
      <div className="relative z-10 flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[9px] leading-none font-bold tracking-wider uppercase opacity-75">
              {account.bankName}
            </p>
            <h3 className="mt-1 truncate text-xs leading-normal font-black tracking-tight">
              {account.name}
            </h3>
          </div>
        </div>
        <AppIcon name="account_balance" className="icon-md shrink-0 opacity-75" />
      </div>

      <div className="relative z-10 mt-4">
        <p className="font-mono text-[10px] leading-none tracking-[0.18em] opacity-75">
          •••• {account.accountNumber.slice(-4)}
        </p>
        <MoneyValue
          amount={account.balance}
          variant="compactWithFull"
          tone={account.cardTextColor === "dark" ? "inherit" : "inverse"}
          size="md"
          className="mt-1"
        />
      </div>
    </div>
  );

  if (!onSelect) return content;

  return (
    <button
      type="button"
      onClick={() => onSelect(account)}
      className={`shrink-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
        full ? "w-full rounded-[28px]" : "rounded-2xl"
      }`}
      aria-label={`Buka rekening ${account.name}`}
    >
      {content}
    </button>
  );
}
