"use client";

import type { InvoiceSettlementStatus } from "../../utils/project-invoices-utils";
import React from "react";

import { AppIcon, MoneyValue, Button } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

export function ProjectInvoicesSummary({
  canCreateInvoice,
  invoicesCount,
  contractValue,
  schedulePending,
  createError,
  createSuccess,
  totalInvoiceAmount,
  totalPaidAmount,
  unpaidAmount,
  onCreateInvoiceClick,
  onGenerateSchedule,
  onNavigateClosing,
  settlement,
}: {
  readonly canCreateInvoice: boolean;
  readonly invoicesCount: number;
  readonly contractValue: number;
  readonly schedulePending: boolean;
  readonly createError: string | null;
  readonly createSuccess: string | null;
  readonly totalInvoiceAmount: number;
  readonly totalPaidAmount: number;
  readonly unpaidAmount: number;
  readonly onCreateInvoiceClick: () => void;
  readonly onGenerateSchedule: () => void;
  readonly onNavigateClosing?: () => void;
  readonly settlement?: InvoiceSettlementStatus;
}): React.JSX.Element {
  const unbilledContractAmount =
    settlement?.unbilledContractAmount ?? Math.max(0, contractValue - totalInvoiceAmount);
  const billedCoverage =
    settlement?.billedCoverage ??
    (contractValue > 0 ? (totalInvoiceAmount / contractValue) * 100 : 0);
  const isFullySettled =
    settlement?.isFullySettled ??
    (invoicesCount > 0 &&
      contractValue > 0 &&
      totalPaidAmount >= contractValue &&
      unpaidAmount <= 0);
  const isCurrentInvoicesSettled =
    settlement?.isCurrentInvoicesSettled ??
    (invoicesCount > 0 && unpaidAmount <= 0 && !isFullySettled && unbilledContractAmount > 0);

  return (
    <section className="rounded-owner bg-primary p-5 text-white shadow-inverse max-[430px]:p-4">
      <div>
        <div className="flex items-start justify-between gap-3">
          {isFullySettled ? (
            <div className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-meta font-bold text-white ring-1 ring-white/30">
              <AppIcon name="check_circle" className="shrink-0 text-[13px] text-white" />
              <span>Lunas Sepenuhnya · 100%</span>
            </div>
          ) : isCurrentInvoicesSettled ? (
            <div className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-meta font-bold text-white/90 ring-1 ring-white/20">
              <AppIcon name="check" className="shrink-0 text-[13px] text-white" />
              <span>Tagihan Berjalan Lunas</span>
            </div>
          ) : (
            <p className="text-eyebrow font-bold tracking-[0.16em] text-white/55 uppercase">
              Sisa tagihan klien
            </p>
          )}
          {canCreateInvoice ? (
            <Button
              type="button"
              onClick={onCreateInvoiceClick}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1.5 text-support font-bold text-white ring-1 ring-white/15 hover:bg-white/15"
              title={isFullySettled ? "Buat invoice jika ada tagihan addendum" : undefined}
              variant="secondary"
              size="mini"
            >
              <AppIcon name="add" className="text-[17px]" />{" "}
              {isFullySettled ? "Addendum" : "Invoice"}
            </Button>
          ) : null}
        </div>
        {isFullySettled || isCurrentInvoicesSettled ? (
          <p className="mt-2 text-eyebrow font-bold tracking-[0.16em] text-white/55 uppercase">
            {isFullySettled ? "Total kas masuk diterima" : "Sisa kontrak belum ditagihkan"}
          </p>
        ) : null}
        <MoneyValue
          amount={
            isFullySettled
              ? totalPaidAmount
              : isCurrentInvoicesSettled
                ? unbilledContractAmount
                : unpaidAmount
          }
          variant="fullDynamic"
          tone="inverse"
          size="hero"
          className="mt-1"
        />
        <p className="mt-1 text-meta text-white/60">
          {isFullySettled
            ? `${invoicesCount} termin lunas · Rp 0 piutang tersisa`
            : isCurrentInvoicesSettled
              ? `${invoicesCount} termin selesai · ${billedCoverage.toFixed(0)}% nilai kontrak sudah ditagihkan`
              : `${invoicesCount} termin · ${billedCoverage.toFixed(0)}% nilai kontrak sudah ditagihkan`}
        </p>
      </div>
      <div className="mt-2 flex flex-row gap-3">
        <InvoiceFact label="Kontrak" amount={contractValue} />
        <InvoiceFact label="Ditagihkan" amount={totalInvoiceAmount} />
        <InvoiceFact label="Diterima" amount={totalPaidAmount} />
      </div>
      {isFullySettled && onNavigateClosing ? (
        <Button
          type="button"
          onClick={onNavigateClosing}
          className="mt-3.5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-4 text-xs font-bold text-primary shadow-sm ring-1 ring-white/20 hover:bg-white/95 active:z-10 active:shadow-raised"
          variant="secondary"
        >
          <span>Cek Kesiapan Closing</span>
          <AppIcon name="arrow_forward" className="text-[15px]" />
        </Button>
      ) : null}
      {canCreateInvoice && invoicesCount === 0 ? (
        <Button
          type="button"
          onClick={onGenerateSchedule}
          disabled={schedulePending || contractValue <= 0}
          className="mt-4 min-h-12 w-full rounded-full bg-white/10 px-4 text-xs font-bold text-white ring-1 ring-white/15 disabled:opacity-40"
          variant="secondary"
        >
          {schedulePending ? "Membuat termin…" : "Buat termin 30% · 35% · 25% · 10%"}
        </Button>
      ) : null}
      {/* Termin dihitung dari nilai kontrak, jadi tanpa nilai itu tidak ada
          yang bisa dibagi. Teksnya memakai tint di atas permukaan gelap ini,
          bukan abu-abu netral. */}
      {contractValue <= 0 && !schedulePending ? (
        <p className="mt-2 px-1 text-meta font-medium text-white/60">
          Isi nilai kontrak proyek dulu; termin dihitung dari nilai itu.
        </p>
      ) : null}
      {createError || createSuccess ? (
        <p
          className={`mt-3 rounded-2xl px-3 py-2 text-support ${createError ? "bg-error/18 text-critical-on-inverse" : "bg-white/10 text-white"}`}
        >
          {createError ?? createSuccess}
        </p>
      ) : null}
    </section>
  );
}

function InvoiceFact({
  label,
  amount,
  align = "left",
}: {
  readonly label: string;
  readonly amount: number;
  readonly align?: "left" | "center" | "right";
}): React.JSX.Element {
  const className =
    align === "center" ? "px-2 text-center" : align === "right" ? "pl-2 text-right" : "pr-2";
  return (
    <div className={cn("flex w-full flex-col gap-2 rounded-2xl bg-white/7.5 p-3", className)}>
      <p className="truncate text-[8px] leading-none font-bold tracking-wide text-white/50 uppercase">
        {label}
      </p>
      <MoneyValue
        amount={amount}
        variant="compact"
        tone="inverse"
        size="xs"
        align={align === "right" ? "right" : "left"}
        className={align === "center" ? "text-center" : ""}
      />
    </div>
  );
}
