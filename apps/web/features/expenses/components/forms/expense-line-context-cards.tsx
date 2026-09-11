"use client";

import React from "react";
import {
  AppIcon,
  MoneyValue,
  StatusBadge,
  type StatusBadgeTone,
} from "@/components/ui";

export function ExpenseLineBudgetContextCard({
  categoryName,
  amount,
  remaining,
  usedPercentage,
}: {
  readonly categoryName: string;
  readonly amount: number;
  readonly remaining: number;
  readonly usedPercentage?: number | string;
}): React.JSX.Element {
  const overBudget = amount > remaining;
  const remainingAfter = remaining - amount;

  const statusTone: StatusBadgeTone = overBudget
    ? "warning"
    : amount > 0
      ? "healthy"
      : "neutral";

  const statusLabel = overBudget
    ? "Melebihi Sisa Pagu"
    : amount > 0
      ? "Pagu Aman"
      : "Belum Ada Subtotal";

  return (
    <div className="overflow-hidden rounded-owner bg-white p-4 shadow-surface ring-1 ring-ring-subtle">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-eyebrow font-bold tracking-[0.14em] text-on-surface-variant uppercase">
            Dampak Anggaran Kategori
          </p>
          <h3 className="mt-0.5 truncate text-row font-bold tracking-[-0.01em] text-on-surface">
            Kategori {categoryName}
          </h3>
          {usedPercentage !== undefined && (
            <p className="mt-0.5 truncate text-meta font-medium text-on-surface-variant/75">
              {usedPercentage}% pagu terpakai sebelum item ini
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <StatusBadge tone={statusTone} label={statusLabel} />
        </div>
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-2 border-t border-outline-variant/15 pt-3">
        <div className="rounded-2xl bg-surface-container-low p-2.5">
          <p className="text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
            Subtotal Item Ini
          </p>
          <div className="mt-1">
            <MoneyValue
              amount={amount}
              variant="fullDynamic"
              size="sm"
              className="font-bold text-on-surface"
            />
          </div>
          <p className="mt-0.5 truncate text-[10px] text-on-surface-variant">
            {amount > 0 ? "Beban ke kategori" : "Isi kuantitas & harga"}
          </p>
        </div>

        <div className="rounded-2xl bg-surface-container-low p-2.5">
          <p className="text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
            {overBudget ? "Defisit Pagu" : "Sisa Pagu Setelahnya"}
          </p>
          <div className="mt-1">
            <MoneyValue
              amount={overBudget ? amount - remaining : Math.max(0, remainingAfter)}
              variant="fullDynamic"
              size="sm"
              className={overBudget ? "font-bold text-error" : "font-bold text-primary"}
            />
          </div>
          <p
            className={`mt-0.5 truncate text-[10px] ${
              overBudget ? "font-semibold text-error" : "text-on-surface-variant"
            }`}
          >
            {overBudget
              ? "Perlu persetujuan Owner"
              : `Dari sisa Rp ${remaining.toLocaleString("id-ID")}`}
          </p>
        </div>
      </div>

      {overBudget && (
        <div className="mt-3 flex items-start gap-2.5 rounded-2xl bg-error-container/20 p-2.5 text-xs text-error ring-1 ring-error/20">
          <AppIcon name="warning" className="icon-sm mt-0.5 shrink-0 text-error" />
          <p className="leading-snug">
            Item ini melebihi sisa pagu kategori. Pengajuan tetap dapat ditinjau namun akan melalui persetujuan khusus Owner.
          </p>
        </div>
      )}
    </div>
  );
}

export function ExpenseLineStockContextCard({
  materialName,
  unit,
  availableStock,
  requiredQuantity,
  stockHandling,
}: {
  readonly materialName: string;
  readonly unit: string;
  readonly availableStock: number;
  readonly requiredQuantity: number;
  readonly stockHandling: string;
}): React.JSX.Element {
  const isSufficient = availableStock >= requiredQuantity;
  const statusTone: StatusBadgeTone = isSufficient ? "healthy" : "warning";
  const statusLabel = isSufficient ? "Stok Cukup" : "Perlu Pengadaan";

  const handlingLabel =
    stockHandling === "STOCK_IN"
      ? "Stok Masuk Gudang"
      : stockHandling === "PROJECT_EXPENSE"
        ? "Langsung Pakai di Proyek"
        : "Hanya Catat Biaya";

  return (
    <div className="overflow-hidden rounded-owner bg-white p-4 shadow-surface ring-1 ring-ring-subtle">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-eyebrow font-bold tracking-[0.14em] text-on-surface-variant uppercase">
            Pengecekan Stok Gudang
          </p>
          <h3 className="mt-0.5 truncate text-row font-bold tracking-[-0.01em] text-on-surface">
            {materialName}
          </h3>
          <p className="mt-0.5 truncate text-meta font-medium text-on-surface-variant/75">
            Perlakuan: {handlingLabel}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <StatusBadge tone={statusTone} label={statusLabel} />
        </div>
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-2 border-t border-outline-variant/15 pt-3">
        <div className="rounded-2xl bg-surface-container-low p-2.5">
          <p className="text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
            Stok Tersedia
          </p>
          <p className="mt-1 text-sm font-bold tabular-nums text-on-surface">
            {availableStock.toLocaleString("id-ID")}{" "}
            <span className="text-xs font-normal text-on-surface-variant">{unit}</span>
          </p>
          <p className="mt-0.5 truncate text-[10px] text-on-surface-variant">
            Di gudang saat ini
          </p>
        </div>

        <div className="rounded-2xl bg-surface-container-low p-2.5">
          <p className="text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
            Kebutuhan Item
          </p>
          <p className="mt-1 text-sm font-bold tabular-nums text-on-surface">
            {requiredQuantity.toLocaleString("id-ID")}{" "}
            <span className="text-xs font-normal text-on-surface-variant">{unit}</span>
          </p>
          <p
            className={`mt-0.5 truncate text-[10px] ${
              isSufficient ? "text-on-surface-variant" : "font-semibold text-warning"
            }`}
          >
            {isSufficient
              ? `Sisa bebas ${Math.max(0, availableStock - requiredQuantity).toLocaleString("id-ID")} ${unit}`
              : `Kurang ${(requiredQuantity - availableStock).toLocaleString("id-ID")} ${unit}`}
          </p>
        </div>
      </div>
    </div>
  );
}
