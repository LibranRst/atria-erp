"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { AppIcon, DuotoneIconTile, MoneyValue, SummaryFact, SummarySurface } from "@/components/ui";
import { BankAccountCard } from "@/features/finance-dashboard/components/cards/dashboard-cards";
import type { BankAccount } from "@/features/finance-dashboard/types/bank-account-types";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { PilotBalanceNotice } from "../shared/pilot-balance-notice";

const accountCardPressScale = { scale: 0.985 } as const;

type BankAccountsOverviewProps = {
  readonly accounts: readonly BankAccount[];
  readonly variant: "preview" | "tab";
  readonly canCreate: boolean;
  readonly totalCash: number;
  readonly activeAccounts: number;
  readonly unreconciledCount: number;
  readonly coverage: number | null;
  readonly onCreate: () => void;
  readonly onSelect: (account: BankAccount) => void;
};

function EmptyAccountsState({
  canCreate,
  onCreate,
}: Pick<BankAccountsOverviewProps, "canCreate" | "onCreate">): React.JSX.Element {
  return (
    <div className="rounded-owner bg-white px-5 py-6 text-center ring-1 ring-ring-subtle">
      <DuotoneIconTile
        name="account_balance"
        className="mx-auto h-12 w-12"
        iconClassName="icon-xl"
      />
      <h3 className="mt-3 text-base font-bold text-on-surface">Belum ada rekening</h3>
      <p className="mx-auto mt-1 max-w-65 text-xs leading-5 text-on-surface-variant">
        {canCreate
          ? "Tambahkan rekening kas perusahaan untuk mulai mencatat saldo dan mutasi."
          : "Rekening kas perusahaan belum dibuat. Hanya Owner yang dapat menambahkannya."}
      </p>
      {canCreate ? (
        <button
          type="button"
          onClick={onCreate}
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-xs font-bold text-on-primary active:scale-[0.97]"
        >
          <AppIcon name="add" className="icon-sm" />
          Tambah rekening
        </button>
      ) : null}
    </div>
  );
}

function AccountPositionCard({
  account,
  onSelect,
}: {
  readonly account: BankAccount;
  readonly onSelect: (account: BankAccount) => void;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      tabIndex={0}
      type="button"
      onClick={() => onSelect(account)}
      aria-label={`Buka rekening ${account.name}`}
      whileTap={reduceMotion ? undefined : accountCardPressScale}
      transition={transitionSpringSnappy}
      className={`relative flex aspect-[1.586/1] w-full flex-col overflow-hidden rounded-owner px-5 py-4.5 text-left ring-1 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring-strong max-[430px]:px-4 max-[430px]:py-4 ${account.cardTextColor === "dark" ? "text-on-surface ring-ring-subtle" : "text-white ring-white/16"} ${account.isActive ? "" : "opacity-60 grayscale"}`}
      style={{
        backgroundImage: `linear-gradient(135deg, ${account.cardColorFrom}, ${account.cardColorTo})`,
      }}
    >
      <span className="relative flex w-full items-start gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-icon max-[430px]:h-10 max-[430px]:w-10 ${account.cardTextColor === "dark" ? "bg-black/5.5" : "bg-white/[0.14]"}`}
        >
          <AppIcon name="account_balance" className="text-[21px] max-[430px]:text-[19px]" />
        </span>
        <span className="min-w-0 flex-1 pt-0.5">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm leading-[1.15] font-semibold tracking-[-0.01em]">
              {account.name}
            </span>
            {!account.isActive ? (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-semibold ring-1 ${account.cardTextColor === "dark" ? "bg-black/5.5 ring-ring-subtle" : "bg-white/[0.14] ring-white/18"}`}
              >
                Tidak aktif
              </span>
            ) : null}
          </span>
          <span className="mt-1 block truncate text-[10px] leading-[1.2] font-medium tracking-[0.08em] uppercase opacity-65">
            {account.bankName}
          </span>
        </span>
        <AppIcon name="contactless" className="shrink-0 pt-1 text-[23px] opacity-65" />
      </span>

      <span className="relative mt-auto block pt-3">
        <span className="block text-eyebrow font-semibold tracking-[0.13em] uppercase opacity-60">
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
        <span className="font-mono text-support font-semibold tracking-[0.16em] opacity-75">
          •••• {account.accountNumber.slice(-4)}
        </span>
        <span className="max-w-[55%] min-w-0 truncate text-right text-eyebrow font-semibold tracking-widest uppercase opacity-60">
          {account.holderName}
        </span>
      </span>
      <span
        className={`relative mt-3 flex min-h-9 w-full items-center gap-2 rounded-inset px-2.5 py-1.5 ${account.cardTextColor === "dark" ? "bg-black/4.5" : "bg-white/10"}`}
      >
        <AppIcon name="receipt_long" className="shrink-0 text-[15px] opacity-65" />
        <span className="min-w-0 flex-1 truncate text-eyebrow font-medium opacity-75">
          {account.recentTransactions[0]?.description ?? "Belum ada transaksi"}
        </span>
        <AppIcon
          name="chevron_right"
          className="shrink-0 text-[15px] opacity-70"
          aria-hidden="true"
        />
      </span>
    </motion.button>
  );
}

export function BankAccountsOverview({
  accounts,
  variant,
  canCreate,
  totalCash,
  activeAccounts,
  unreconciledCount,
  coverage,
  onCreate,
  onSelect,
}: BankAccountsOverviewProps): React.JSX.Element {
  if (variant === "preview") {
    return (
      <div className="-my-3 flex snap-x snap-mandatory scrollbar-none gap-3 overflow-x-auto px-5 py-5">
        {accounts.map((account) => (
          <BankAccountCard key={account.id} account={account} onSelect={onSelect} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-sm">
      <SummarySurface
        ariaLabel="Posisi kas rekening"
        eyebrow="Posisi kas"
        icon="account_balance"
        status={
          unreconciledCount > 0 ? `${unreconciledCount} belum rekonsiliasi` : "Rekonsiliasi selesai"
        }
        statusTone={unreconciledCount > 0 ? "warning" : "positive"}
      >
        {process.env.NEXT_PUBLIC_ATRIA_PILOT_MODE === "true" ? (
          <div className="px-3.5 pt-3">
            <PilotBalanceNotice />
          </div>
        ) : null}
        <div className="px-3.5 pt-3 pb-1">
          <p className="text-eyebrow font-semibold text-on-surface-variant/60">Total saldo kas</p>
          <MoneyValue
            amount={totalCash}
            variant="fullDynamic"
            size="hero"
            tone={totalCash < 0 ? "danger" : "default"}
            className="mt-1"
          />
        </div>
        <div className="grid grid-cols-3 gap-2 px-2 pt-1 pb-2">
          <SummaryFact label="Rekening aktif" value={String(activeAccounts)} />
          <SummaryFact
            label="Rekonsiliasi"
            value={unreconciledCount > 0 ? `${String(unreconciledCount)} terbuka` : "Selesai"}
            tone={unreconciledCount > 0 ? "warning" : "positive"}
          />
          <SummaryFact
            label="Cakupan dekat"
            value={coverage === null ? "Aman" : `${coverage.toFixed(1)}×`}
            tone={coverage !== null && coverage < 1 ? "danger" : "positive"}
          />
        </div>
      </SummarySurface>

      <section className="space-y-2.5">
        <div className="flex min-h-12 items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <h2 className="truncate text-section font-semibold tracking-[-0.015em] text-on-surface">
              Posisi rekening
            </h2>
            <p className="mt-0.5 text-[10px] leading-tight text-on-surface-variant">
              Pilih rekening untuk melihat transaksi dan tindakan.
            </p>
          </div>
          {/* Menambah rekening hanya milik Owner. Tombol mati permanen di header
              hanya menjadi gangguan bagi peran lain; ketiadaannya sudah jujur,
              dan empty state yang menjelaskan siapa yang berwenang. */}
          {canCreate ? (
            <button
              type="button"
              onClick={onCreate}
              className="relative inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-surface-container-low px-3 text-meta font-semibold text-on-surface outline-none after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-surface-container-high"
            >
              <AppIcon name="add" className="icon-xs" />
              <span className="hidden min-[360px]:inline">Tambah rekening</span>
              <span className="min-[360px]:hidden">Tambah</span>
            </button>
          ) : null}
        </div>
        {accounts.length === 0 ? (
          <EmptyAccountsState canCreate={canCreate} onCreate={onCreate} />
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
            {accounts.map((account) => (
              <AccountPositionCard key={account.id} account={account} onSelect={onSelect} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
