"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { MoneyValue } from "@/components/ui/page-primitives";
import type {
  VendorListBill,
  VendorListPayment,
} from "@/features/expenses/components/vendor-bill-list-types";
import {
  getBillPaymentSummary,
  getVendorBillStatus,
  getVendorPaymentBadge,
} from "@/features/expenses/components/vendor-bill-list-utils";
import { transitionSpringSnappy } from "@/lib/utils/motion";

const payablePressScale = { scale: 0.975 } as const;

function vendorBillStatusLabel(status: ReturnType<typeof getVendorBillStatus>): string {
  if (status === "PAID") return "Lunas";
  if (status === "PARTIALLY_PAID") return "Dibayar sebagian";
  if (status === "VOID") return "Dibatalkan";
  return "Belum dibayar";
}

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
  const reduceMotion = useReducedMotion();
  const amountNum = Number(bill.amount);
  const statusMapping = getVendorBillStatus(bill.status);
  const { totalScheduledOrPaid, isFullyScheduledOrPaid, hasPending } = getBillPaymentSummary(bill);

  return (
    <div className="px-3 py-3 max-[430px]:px-2.5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-warning/[0.09] text-warning ring-1 ring-warning/[0.06]">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">request_quote</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-[-0.01em] text-on-surface">
              {bill.vendor?.name || "Vendor"}
            </h3>
            <Badge status={statusMapping}>{vendorBillStatusLabel(statusMapping)}</Badge>
          </div>
          <p className="mt-1 truncate text-[10px] text-on-surface-variant/75">
            {bill.project?.name || "Proyek"} · {bill.billNumber}
          </p>
          {bill.budgetItem?.name ? <p className="mt-0.5 truncate text-[9px] text-on-surface-variant/60">{bill.budgetItem.name}</p> : null}
        </div>
        <MoneyValue amount={amountNum} variant="compactWithFull" align="right" size="sm" className="shrink-0" />
      </div>

      <div className="mt-2 flex min-h-9 items-center justify-between gap-3 pl-12">
        <div className="flex min-w-0 items-center gap-1 text-[9px] font-semibold text-on-surface-variant/70">
          <span className="material-symbols-outlined text-[13px]" aria-hidden="true">calendar_today</span>
          <span>{new Date(bill.dueDate).toLocaleDateString("id-ID", { month: "short", day: "numeric", year: "numeric" })}</span>
        </div>

        {isOwnerOrFinance && bill.status !== "PAID" && bill.status !== "VOID" ? (
          isFullyScheduledOrPaid ? (
            <Badge status="PENDING">{hasPending ? "Dalam Antrean" : "Sudah Dijadwalkan"}</Badge>
          ) : (
            <motion.button
              type="button"
              onClick={() => onScheduleClick(bill)}
              whileTap={reduceMotion ? undefined : payablePressScale}
              transition={transitionSpringSnappy}
              className="relative h-8 shrink-0 rounded-full bg-primary px-3 text-[10px] font-bold text-on-primary outline-none after:absolute after:-inset-y-2 after:inset-x-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {totalScheduledOrPaid > 0 ? "Jadwalkan Sisa" : "Jadwalkan Bayar"}
            </motion.button>
          )
        ) : null}
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
  const reduceMotion = useReducedMotion();
  const amountPaidNum = Number(payment.amountPaid);
  const isCompleted = payment.status === "COMPLETED";
  const badge = getVendorPaymentBadge(payment);

  return (
    <div className={`px-3 py-3 max-[430px]:px-2.5 ${isCompleted ? "bg-surface-container-low/35" : ""}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ${isCompleted ? "bg-success/[0.08] text-success ring-success/[0.06]" : "bg-warning/[0.09] text-warning ring-warning/[0.06]"}`}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{isCompleted ? "check_circle" : "payments"}</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-[-0.01em] text-on-surface">
              {payment.vendorBill?.vendor?.name || "Vendor"}
            </h4>
            <Badge status={badge.status}>{badge.label}</Badge>
          </div>
          <p className="mt-1 truncate text-[10px] text-on-surface-variant/75">
            {payment.vendorBill?.project?.name || "Proyek"} · {payment.vendorBill?.billNumber}
          </p>
        </div>
        <MoneyValue amount={amountPaidNum} variant="compactWithFull" align="right" size="sm" className="shrink-0" />
      </div>

      {!isCompleted ? (
        <div className="mt-2 flex min-h-9 items-center justify-between gap-3 pl-12">
          <div className="flex min-w-0 items-center gap-1 text-[9px] font-semibold text-on-surface-variant/70">
            <span className="material-symbols-outlined text-[13px]" aria-hidden="true">event</span>
            {new Date(payment.paymentDate).toLocaleDateString("id-ID", { month: "short", day: "numeric" })}
            {payment.bankAccount?.name ? <span className="truncate">· {payment.bankAccount.name}</span> : null}
          </div>
          {payment.approvalStatus === "PENDING" ? (
            <span className="shrink-0 rounded-full bg-warning/[0.09] px-2.5 py-1 text-[9px] font-semibold text-warning">Menunggu Owner</span>
          ) : payment.approvalStatus === "REJECTED" ? (
            <span className="shrink-0 rounded-full bg-error/[0.075] px-2.5 py-1 text-[9px] font-semibold text-error">Ditolak Owner</span>
          ) : isOwnerOrFinance ? (
            <motion.button
              type="button"
              onClick={() => onDisburseClick(payment)}
              whileTap={reduceMotion ? undefined : payablePressScale}
              transition={transitionSpringSnappy}
              className="relative h-8 shrink-0 rounded-full bg-primary px-3 text-[10px] font-bold text-on-primary outline-none after:absolute after:-inset-y-2 after:inset-x-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              Cairkan
            </motion.button>
          ) : (
            <span className="shrink-0 rounded-full bg-success/[0.08] px-2.5 py-1 text-[9px] font-semibold text-success">Dalam antrean</span>
          )}
        </div>
      ) : payment.referenceNumber ? (
        <div className="mt-2 flex justify-between gap-3 pl-12 text-[9px] font-semibold text-on-surface-variant/70">
          <span>{payment.bankAccount?.name ?? "Rekening"} · Referensi</span>
          <span className="truncate font-bold text-on-surface">{payment.referenceNumber}</span>
        </div>
      ) : null}
    </div>
  );
}
