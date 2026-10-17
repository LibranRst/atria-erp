"use client";

import React from "react";
import {
  AppIcon,
  Button,
  FactRow,
  GroupedSurface,
  MoneyValue,
  StatusBadge,
  type StatusBadgeTone,
  type MoneyValueProps,
} from "@/components/ui";
import { useActivityDetail } from "@/features/activity-detail/components/activity-detail-provider";
import type { ExpenseCostItem } from "@/features/expenses/types/expense-list-types";
import {
  fieldClaimCategoryLabel,
  fieldClaimDesktopAction,
  fieldClaimDisplayDate,
  fieldClaimDesktopStatusLabel,
} from "@/features/expenses/utils/field-claims-desktop";

/** Compact columns and exact detail facts share the same cents-aware formatter. */
export function FieldClaimDesktopAmount(
  props: Omit<MoneyValueProps, "fractionDigits">,
): React.JSX.Element {
  return <MoneyValue {...props} fractionDigits={Number.isInteger(props.amount) ? 0 : 2} />;
}

export function FieldClaimDesktopStatus({
  cost,
}: {
  readonly cost: ExpenseCostItem;
}): React.JSX.Element {
  const tone: StatusBadgeTone =
    cost.status === "REJECTED"
      ? "critical"
      : cost.status === "PAID"
        ? "completed"
        : cost.status === "APPROVED"
          ? "healthy"
          : "pending";
  return <StatusBadge tone={tone} label={fieldClaimDesktopStatusLabel(cost.status)} />;
}

export function FieldClaimsDesktopDetail({
  cost,
  pending,
  canVerify,
  canPay,
  onVerify,
  onDisburse,
  onOpenReceipt,
  onBack,
}: {
  readonly cost: ExpenseCostItem;
  readonly pending: boolean;
  readonly canVerify: boolean;
  readonly canPay: boolean;
  readonly onVerify: (cost: ExpenseCostItem) => void;
  readonly onDisburse: (cost: ExpenseCostItem) => void;
  readonly onOpenReceipt: (imageUrl: string) => void;
  readonly onBack: () => void;
}): React.JSX.Element {
  const { openActivityDetail } = useActivityDetail();
  const action = fieldClaimDesktopAction(cost.status, { verify: canVerify, pay: canPay });
  return (
    <section
      aria-label="Detail pengeluaran lapangan"
      className="min-w-0 space-y-3 xl:sticky xl:top-24"
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <h2 className="text-section font-semibold">Detail pengeluaran</h2>
        <Button
          type="button"
          variant="secondary"
          size="mini"
          className="xl:hidden"
          onClick={onBack}
        >
          <AppIcon name="arrow_back" className="icon-xs" /> Daftar
        </Button>
      </div>
      <GroupedSurface variant="desktopPanel">
        <div className="space-y-3 p-4">
          <FieldClaimDesktopStatus cost={cost} />
          <h3 className="text-body font-semibold wrap-anywhere">{cost.description}</h3>
          <FieldClaimDesktopAmount amount={Number(cost.amount)} variant="fullDynamic" size="lg" />
          {cost.budgetOverrun ? (
            <p className="flex items-start gap-2 text-support text-critical">
              <AppIcon name="warning" className="icon-sm shrink-0" />
              Pengajuan ini melebihi alokasi budget.
            </p>
          ) : null}
        </div>
        <div className="divide-y divide-ring-subtle border-t border-ring-subtle">
          <FactRow
            label="Proyek"
            value={cost.project?.name || "Proyek tidak tersedia"}
            layout="stacked"
          />
          <FactRow label="Kategori" value={fieldClaimCategoryLabel(cost)} layout="stacked" />
          <FactRow
            label="Diajukan oleh"
            value={cost.requestedBy?.name || "Tidak tersedia"}
            layout="stacked"
          />
          <FactRow
            label="Tanggal pengajuan"
            value={fieldClaimDisplayDate(cost.createdAt, true)}
            layout="stacked"
          />
          {cost.budgetItem ? (
            <FactRow label="Rincian budget" value={cost.budgetItem.name} layout="stacked" />
          ) : null}
        </div>
        <div className="space-y-2 border-t border-ring-subtle p-4">
          {cost.receiptImageUrl ? (
            <Button
              type="button"
              variant="secondary"
              size="compact"
              className="w-full"
              onClick={(): void => {
                if (cost.receiptImageUrl) onOpenReceipt(cost.receiptImageUrl);
              }}
            >
              <AppIcon name="image" className="icon-sm" /> Lihat bukti
            </Button>
          ) : (
            <p className="text-support text-on-surface-variant">Bukti tidak dilampirkan.</p>
          )}
          <Button
            type="button"
            variant="secondary"
            size="compact"
            className="w-full"
            onClick={(): void => openActivityDetail({ kind: "PROJECT_COST", id: cost.id })}
          >
            Buka rincian lengkap <AppIcon name="arrow_outward" className="icon-sm" />
          </Button>
          {action ? (
            <Button
              type="button"
              variant="primary"
              size="compact"
              className="w-full"
              disabled={pending}
              onClick={(): void => {
                if (action === "verify") onVerify(cost);
                else onDisburse(cost);
              }}
            >
              <AppIcon name={action === "verify" ? "fact_check" : "payments"} className="icon-sm" />
              {pending
                ? "Memproses…"
                : action === "verify"
                  ? "Verifikasi pengajuan"
                  : "Cairkan pengeluaran"}
            </Button>
          ) : null}
          {cost.status === "SUBMITTED" && !canVerify ? (
            <p className="text-support text-on-surface-variant">Menunggu verifikasi Finance.</p>
          ) : null}
          {cost.status === "VERIFIED" ? (
            <p className="text-support text-on-surface-variant">Menunggu keputusan persetujuan.</p>
          ) : null}
          {cost.status === "APPROVED" && !canPay ? (
            <p className="text-support text-on-surface-variant">Menunggu pencairan Finance.</p>
          ) : null}
        </div>
      </GroupedSurface>
    </section>
  );
}
