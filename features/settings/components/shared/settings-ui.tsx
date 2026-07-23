"use client";

import React from "react";
import { Info } from "lucide-react";

import { MoneyValue, type MoneyValueVariant } from "@/components/ui/feedback/page-primitives";
import { MetadataChip } from "@/components/ui/badge/badge";

export { BottomSheet, ConfirmationSheet, SheetActionButton } from "@/components/ui/overlay/bottom-sheet";
export { FilterPills } from "@/components/ui/navigation/filter-pills";
export { PanelEmptyState as EmptyState } from "@/components/ui/feedback/panel-empty-state";

type SettingsHeaderProps = {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly role: string;
  readonly canManage?: boolean;
  readonly action?: React.ReactNode;
};

export function SettingsHeader({
  eyebrow,
  title,
  description,
  role,
  canManage,
  action,
}: SettingsHeaderProps): React.JSX.Element {
  return (
    <header className="min-w-0">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-bold tracking-[0.15em] text-on-surface-variant/65 uppercase">
            {eyebrow}
          </p>
          <h1 className="mt-1.5 text-[24px] leading-[1.12] font-semibold tracking-tight text-on-surface max-[360px]:text-[22px]">
            {title}
          </h1>
          <p className="mt-1 text-[11px] leading-[1.35] text-on-surface-variant">{description}</p>
        </div>
        <MetadataChip className="mt-0.5 font-extrabold tracking-[0.08em] uppercase">
          {canManage === false ? "Hanya baca" : role}
        </MetadataChip>
      </div>
      {action && <div className="w-full">{action}</div>}
    </header>
  );
}

type CompactMetricProps = {
  readonly label: string;
  readonly value?: string;
  readonly supportingValue?: string;
  readonly amount?: number;
  readonly moneyVariant?: MoneyValueVariant;
  readonly fullValue?: string;
  readonly tone?: "default" | "primary" | "warning" | "danger";
};

export function CompactMetric({
  label,
  value,
  supportingValue,
  amount,
  moneyVariant = "compactWithFull",
  fullValue,
  tone = "default",
}: CompactMetricProps): React.JSX.Element {
  const valueClass =
    tone === "primary"
      ? "text-primary"
      : tone === "warning"
        ? "text-secondary"
        : tone === "danger"
          ? "text-error"
          : "text-on-surface";
  return (
    <div className="min-w-0 rounded-2xl bg-surface-container-low px-3 py-2.5">
      <p className="truncate text-[9px] font-bold tracking-wide text-on-surface-variant uppercase">
        {label}
      </p>
      {typeof amount === "number" ? (
        <>
          {supportingValue && (
            <p
              className={`mt-0.5 font-mono text-[11px] font-bold wrap-anywhere wrap-break-word tabular-nums ${valueClass}`}
            >
              {supportingValue}
            </p>
          )}
          <MoneyValue
            amount={amount}
            variant={moneyVariant}
            tone={
              tone === "primary"
                ? "primary"
                : tone === "warning"
                  ? "warning"
                  : tone === "danger"
                    ? "danger"
                    : "default"
            }
            className={supportingValue ? "mt-1" : "mt-0.5"}
          />
        </>
      ) : (
        <p
          className={`financial-amount mt-0.5 font-mono text-[13px] font-bold wrap-anywhere wrap-break-word tabular-nums ${valueClass}`}
        >
          {value}
        </p>
      )}
      {typeof amount !== "number" && fullValue && fullValue !== value && (
        <p className="financial-amount mt-1 font-mono text-[9px] wrap-anywhere wrap-break-word text-on-surface-variant/75 tabular-nums">
          {fullValue}
        </p>
      )}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="min-w-0 space-y-1.5">
      <label className="block text-[9px] font-bold tracking-[0.12em] text-on-surface-variant uppercase">
        {label}
      </label>
      {children}
      {hint && (
        <span className="block text-[10px] leading-4 font-normal text-on-surface-variant">
          {hint}
        </span>
      )}
    </div>
  );
}

export const inputClass =
  "min-h-12 w-full min-w-0 rounded-full border border-outline-variant/40 bg-surface px-5 text-sm text-on-surface outline-none transition focus:border-outline focus:ring-0 disabled:cursor-not-allowed disabled:bg-surface-container-low disabled:text-on-surface-variant";
export const textareaClass =
  "min-h-24 w-full min-w-0 rounded-2xl border border-outline-variant/40 bg-surface px-5 py-3 text-sm text-on-surface outline-none transition focus:border-outline focus:ring-0 disabled:cursor-not-allowed disabled:bg-surface-container-low disabled:text-on-surface-variant resize-none";

export function SettingsNotice(): React.JSX.Element {
  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-2xl bg-primary/5 px-3 py-2.5 text-[11px] leading-4 text-on-surface-variant ring-1 ring-primary/15">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <p className="min-w-0">
        <strong className="font-bold text-on-surface">Untuk proyek baru.</strong> Default ini tidak
        mengubah budget proyek yang sudah aktif.
      </p>
    </div>
  );
}
