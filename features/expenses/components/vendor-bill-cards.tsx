"use client";

import React from "react";

import { MoneyValue } from "@/components/ui/page-primitives";
import { Badge } from "@/components/ui/badge";
import type {
  VendorListBill,
  VendorListPayment,
} from "@/features/expenses/components/vendor-bill-list-types";
import {
  getBillPaymentSummary,
  getVendorBillStatus,
  getVendorPaymentBadge,
} from "@/features/expenses/components/vendor-bill-list-utils";

type VendorBillCardProps = {
  readonly bill: VendorListBill;
  readonly isOwnerOrFinance: boolean;
  readonly onScheduleClick: (bill: VendorListBill) => void;
};

export function VendorBillCard({
  bill,
  isOwnerOrFinance,
  onScheduleClick,
}: VendorBillCardProps): React.JSX.Element {
  const amountNum = Number(bill.amount);
  const statusMapping = getVendorBillStatus(bill.status);
  const { totalScheduledOrPaid, isFullyScheduledOrPaid, hasPending } =
    getBillPaymentSummary(bill);

  return (
    <div className="space-y-sm rounded-[28px] border border-outline-variant/20 bg-white p-md shadow-[0_14px_34px_rgba(17,17,17,0.045)] transition-colors">
      <div className="flex items-start justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="max-w-[200px] truncate font-sans text-[16px] font-bold leading-[24px] text-on-surface">
              {bill.vendor?.name || "Vendor"}
            </h3>
            <Badge status={statusMapping} />
          </div>
          <p className="text-[11px] font-medium text-on-surface-variant">
            {bill.project?.name || "Proyek"} • {bill.billNumber}
          </p>
          {bill.budgetItem?.name && (
            <p className="truncate text-[10px] text-on-surface-variant">
              {bill.budgetItem.name}
            </p>
          )}
        </div>
        <MoneyValue
          amount={amountNum}
          variant="fullDynamic"
          align="right"
          size="md"
          className="w-[42%] shrink-0"
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-outline-variant/10 pt-sm">
        <div className="flex items-center gap-1 text-[11px] font-medium text-on-surface-variant">
          <span className="material-symbols-outlined text-[14px]">calendar_today</span>
          <span>
            {new Date(bill.dueDate).toLocaleDateString("id-ID", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>

        {isOwnerOrFinance && bill.status !== "PAID" && bill.status !== "VOID" && (
          isFullyScheduledOrPaid ? (
            <Badge status="PENDING">
              {hasPending ? "Dalam Antrean" : "Sudah Dijadwalkan"}
            </Badge>
          ) : (
            <button
              type="button"
              onClick={() => onScheduleClick(bill)}
              className="h-8 cursor-pointer rounded-full bg-primary px-sm text-[11px] font-bold text-on-primary transition-all hover:bg-primary/95 active:scale-95"
            >
              {totalScheduledOrPaid > 0 ? "Jadwalkan Sisa" : "Jadwalkan Bayar"}
            </button>
          )
        )}
      </div>
    </div>
  );
}

type VendorPaymentCardProps = {
  readonly payment: VendorListPayment;
  readonly isOwnerOrFinance: boolean;
  readonly onDisburseClick: (payment: VendorListPayment) => void;
};

export function VendorPaymentCard({
  payment,
  isOwnerOrFinance,
  onDisburseClick,
}: VendorPaymentCardProps): React.JSX.Element {
  const amountPaidNum = Number(payment.amountPaid);
  const isCompleted = payment.status === "COMPLETED";
  const badge = getVendorPaymentBadge(payment);

  return (
    <div
      className={`space-y-sm rounded-[28px] border p-md shadow-[0_14px_34px_rgba(17,17,17,0.045)] transition-colors ${
        isCompleted
          ? "border-outline-variant/15 bg-surface-container-low/70"
          : "border-outline-variant/20 bg-white"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="max-w-[200px] truncate font-sans text-[16px] font-bold leading-[24px] text-on-surface">
              {payment.vendorBill?.vendor?.name || "Vendor"}
            </h4>
            <Badge status={badge.status}>{badge.label}</Badge>
          </div>
          <p className="text-[11px] font-medium text-on-surface-variant">
            {payment.vendorBill?.project?.name || "Proyek"} • {payment.vendorBill?.billNumber}
          </p>
        </div>
        <div className="text-right">
          <MoneyValue
            amount={amountPaidNum}
            variant="fullDynamic"
            align="right"
            size="md"
          />
          <span className="text-[9px] text-on-surface-variant">
            {payment.bankAccount?.name}
          </span>
        </div>
      </div>

      {!isCompleted && (
        <div className="flex items-center justify-between gap-3 border-t border-outline-variant/10 pt-sm">
          <div className="flex items-center gap-1 text-[11px] font-medium text-on-surface-variant">
            <span className="material-symbols-outlined text-[14px]">event</span>
            {new Date(payment.paymentDate).toLocaleDateString("id-ID", {
              month: "short",
              day: "numeric",
            })}
          </div>
          {payment.approvalStatus === "PENDING" ? (
            <span className="rounded-full border border-warning/30 bg-warning-light px-2.5 py-1 text-[10px] font-bold uppercase text-warning">
              Menunggu Approval Owner
            </span>
          ) : payment.approvalStatus === "REJECTED" ? (
            <span className="rounded-full border border-critical/30 bg-critical-light px-2.5 py-1 text-[10px] font-bold uppercase text-critical">
              Ditolak Owner
            </span>
          ) : isOwnerOrFinance ? (
            <button
              type="button"
              onClick={() => onDisburseClick(payment)}
              className="h-8 cursor-pointer rounded-full bg-primary px-sm text-[11px] font-bold text-on-primary transition-all hover:bg-primary/95 active:scale-95"
            >
              Cairkan / Bayar
            </button>
          ) : (
            <span className="rounded-full border border-success/30 bg-success-light px-2.5 py-1 text-[10px] font-bold uppercase text-success">
              Proses Antrean
            </span>
          )}
        </div>
      )}

      {isCompleted && payment.referenceNumber && (
        <div className="flex justify-between gap-3 border-t border-outline-variant/10 pt-sm text-[10px] font-semibold text-on-surface-variant">
          <span>Referensi</span>
          <span className="font-bold text-on-surface">{payment.referenceNumber}</span>
        </div>
      )}
    </div>
  );
}
