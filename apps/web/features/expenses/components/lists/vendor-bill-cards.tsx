"use client";
import { AppIcon, MoneyValue } from "@/components/ui";
import React from "react";
import { motion, useReducedMotion } from "framer-motion";

import type {
  VendorListBill,
  VendorListPayment,
} from "@/features/expenses/types/vendor-bill-list-types";
import {
  getBillPaymentSummary,
  getVendorBillStatus,
  getVendorPaymentPresentation,
} from "@/features/expenses/utils/vendor-bill-list-utils";
import { transitionSpringSmooth, transitionSpringSnappy } from "@/lib/utils/motion";
import {
  ActivityDetailChevron,
  type ActivityDetailOpenOptions,
  useActivityDetail,
} from "@/features/activity-detail/components/activity-detail-provider";

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
  const { openActivityDetail } = useActivityDetail();
  const amountNum = Number(bill.amount);
  const statusMapping = getVendorBillStatus(bill.status);
  const { totalScheduledOrPaid, isFullyScheduledOrPaid, hasPending } = getBillPaymentSummary(bill);
  const scheduledPercentage =
    amountNum > 0 ? Math.min(100, (totalScheduledOrPaid / amountNum) * 100) : 0;
  const statusTone =
    bill.status === "PAID"
      ? "text-success"
      : bill.status === "VOID"
        ? "text-on-surface-variant/55"
        : bill.status === "PARTIALLY_PAID"
          ? "text-primary"
          : "text-warning";
  const activityDetailOptions: ActivityDetailOpenOptions | undefined =
    bill.status === "PAID" || bill.status === "VOID"
      ? undefined
      : isFullyScheduledOrPaid
        ? {
            footerStatus: hasPending
              ? { label: "Menunggu pencairan", tone: "pending" }
              : { label: "Terjadwal penuh", tone: "neutral" },
          }
        : isOwnerOrFinance
          ? {
              actions: {
                primary: {
                  label: totalScheduledOrPaid > 0 ? "Jadwalkan Sisa" : "Jadwalkan Bayar",
                  onClick: () => onScheduleClick(bill),
                },
              },
            }
          : undefined;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() =>
        openActivityDetail({ kind: "VENDOR_BILL", id: bill.id }, activityDetailOptions)
      }
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && event.currentTarget === event.target) {
          event.preventDefault();
          openActivityDetail({ kind: "VENDOR_BILL", id: bill.id }, activityDetailOptions);
        }
      }}
      aria-label={`Lihat detail tagihan ${bill.billNumber}`}
      className="min-h-23 px-3 py-3.5 text-left transition-colors outline-none hover:bg-black/1.5 focus-visible:bg-surface-container-low active:bg-surface-container-low/70 max-[430px]:px-2.5"
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ${
            bill.status === "PAID"
              ? "bg-success/8 text-success ring-success/6"
              : bill.status === "PARTIALLY_PAID"
                ? "bg-primary/8 text-primary ring-primary/6"
                : "bg-warning/9 text-warning ring-warning/6"
          }`}
        >
          <AppIcon
            name={bill.status === "PAID" ? "check_circle" : "request_quote"}
            className="icon-md leading-none"
          />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className={`truncate text-eyebrow font-bold ${statusTone}`}>
              {vendorBillStatusLabel(statusMapping)}
            </span>
            <span className="shrink-0 text-eyebrow font-semibold text-on-surface-variant/60">
              Jatuh tempo{" "}
              {new Date(bill.dueDate).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
              })}
            </span>
          </div>
          <div className="mt-1 flex min-w-0 items-start justify-between gap-3">
            <h3 className="min-w-0 flex-1 truncate text-row font-bold tracking-[-0.01em] text-on-surface">
              {bill.vendor?.name || "Vendor"}
            </h3>
            <MoneyValue
              amount={amountNum}
              variant="fullDynamic"
              align="right"
              size="sm"
              className={`shrink-0 ${bill.status === "PAID" ? "text-on-surface-variant/65" : "text-on-surface"}`}
            />
          </div>
          <p className="mt-1 truncate text-meta font-medium text-on-surface-variant/75">
            {bill.project?.name || "Proyek"} · {bill.billNumber}
          </p>
          {bill.budgetItem?.name ? (
            <p className="mt-0.5 truncate text-eyebrow font-medium text-on-surface-variant/55">
              Budget {bill.budgetItem.name}
            </p>
          ) : null}
        </div>
        <ActivityDetailChevron />
      </div>

      {totalScheduledOrPaid > 0 && bill.status !== "PAID" && !isFullyScheduledOrPaid && (
        <div className="mt-2.5 pr-8 pl-12">
          <div className="flex items-center justify-between gap-3 text-eyebrow font-bold text-primary">
            <span>Sudah dijadwalkan</span>
            <span className="shrink-0 tabular-nums">{scheduledPercentage.toFixed(0)}%</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
            <motion.div
              initial={false}
              animate={reduceMotion ? undefined : { width: `${scheduledPercentage}%` }}
              style={reduceMotion ? { width: `${scheduledPercentage}%` } : undefined}
              transition={transitionSpringSmooth}
              className="h-full rounded-full bg-primary"
            />
          </div>
          <p className="mt-1 truncate text-eyebrow font-medium text-on-surface-variant/55">
            Rp {totalScheduledOrPaid.toLocaleString("id-ID")} dari Rp{" "}
            {amountNum.toLocaleString("id-ID")}
          </p>
        </div>
      )}
      {bill.status !== "PAID" &&
      bill.status !== "VOID" &&
      (isOwnerOrFinance || isFullyScheduledOrPaid) ? (
        <div className="mt-2 flex min-h-8 items-center justify-end gap-2 pr-8 pl-12">
          {isOwnerOrFinance ? (
            isFullyScheduledOrPaid ? (
              hasPending ? (
                <span className="flex items-center gap-1 text-eyebrow font-bold text-warning">
                  <AppIcon name="schedule" className="text-[13px] leading-none" />
                  Menunggu pencairan
                </span>
              ) : (
                <span className="flex items-center gap-1 text-eyebrow font-bold text-primary">
                  <AppIcon name="event_available" className="text-[13px] leading-none" />
                  Terjadwal penuh
                </span>
              )
            ) : (
              <motion.button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onScheduleClick(bill);
                }}
                whileTap={reduceMotion ? undefined : payablePressScale}
                transition={transitionSpringSnappy}
                className="relative h-8 shrink-0 rounded-full bg-primary px-3 text-meta font-bold text-on-primary outline-none after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                {totalScheduledOrPaid > 0 ? "Jadwalkan Sisa" : "Jadwalkan Bayar"}
              </motion.button>
            )
          ) : (
            <span className="text-eyebrow font-bold text-primary">Terjadwal penuh</span>
          )}
        </div>
      ) : null}
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
  const { openActivityDetail } = useActivityDetail();
  const amountPaidNum = Number(payment.amountPaid);
  const isCompleted = payment.status === "COMPLETED";

  const presentation = getVendorPaymentPresentation(payment);
  const statusTone =
    presentation.status === "REJECTED"
      ? "text-error"
      : isCompleted
        ? "text-success"
        : presentation.status === "PENDING"
          ? "text-warning"
          : "text-primary";
  const activityDetailOptions: ActivityDetailOpenOptions | undefined = isCompleted
    ? undefined
    : presentation.canDisburse && isOwnerOrFinance
      ? {
          actions: {
            primary: {
              label: "Cairkan",
              onClick: () => onDisburseClick(payment),
            },
          },
        }
      : {
          footerStatus: {
            label: presentation.canDisburse ? "Dalam antrean" : presentation.label,
            tone: presentation.status === "REJECTED" ? "danger" : "pending",
          },
        };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() =>
        openActivityDetail({ kind: "VENDOR_PAYMENT", id: payment.id }, activityDetailOptions)
      }
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && event.currentTarget === event.target) {
          event.preventDefault();
          openActivityDetail({ kind: "VENDOR_PAYMENT", id: payment.id }, activityDetailOptions);
        }
      }}
      aria-label={`Lihat detail pembayaran ${payment.vendorBill?.billNumber ?? "vendor"}`}
      className="min-h-22 px-3 py-3.5 text-left transition-colors outline-none hover:bg-black/1.5 focus-visible:bg-surface-container-low active:bg-surface-container-low/70 max-[430px]:px-2.5"
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ${
            isCompleted
              ? "bg-success/8 text-success ring-success/6"
              : presentation.status === "PENDING"
                ? "bg-warning/9 text-warning ring-warning/6"
                : presentation.status === "REJECTED"
                  ? "bg-error/8 text-error ring-error/6"
                  : "bg-primary/9 text-primary ring-primary/6"
          }`}
        >
          <AppIcon
            name={
              isCompleted
                ? "check_circle"
                : presentation.status === "PENDING"
                  ? "schedule"
                  : "payments"
            }
            className="icon-md leading-none"
          />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className={`truncate text-eyebrow font-bold ${statusTone}`}>
              {presentation.label}
            </span>
            <span className="shrink-0 text-eyebrow font-semibold text-on-surface-variant/60">
              {isCompleted ? "Dicairkan" : "Rencana"}{" "}
              {new Date(payment.paymentDate).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
              })}
            </span>
          </div>
          <div className="mt-1 flex min-w-0 items-start justify-between gap-3">
            <h4 className="min-w-0 flex-1 truncate text-row font-bold tracking-[-0.01em] text-on-surface">
              {payment.vendorBill?.vendor?.name || "Vendor"}
            </h4>
            <MoneyValue
              amount={amountPaidNum}
              variant="fullDynamic"
              align="right"
              size="sm"
              className={`shrink-0 ${isCompleted ? "text-on-surface-variant/65" : "text-on-surface"}`}
            />
          </div>
          <p className="mt-1 truncate text-meta font-medium text-on-surface-variant/75">
            {payment.vendorBill?.project?.name || "Proyek"} · {payment.vendorBill?.billNumber}
          </p>
          {payment.bankAccount?.name || payment.referenceNumber ? (
            <p className="mt-0.5 truncate text-eyebrow font-medium text-on-surface-variant/55">
              {payment.bankAccount?.name ?? "Rekening"}
              {payment.referenceNumber ? ` · Ref ${payment.referenceNumber}` : ""}
            </p>
          ) : null}
        </div>
        <ActivityDetailChevron />
      </div>

      {!isCompleted ? (
        <div className="mt-2 flex min-h-8 items-center justify-end gap-2 pr-8 pl-12">
          {!presentation.canDisburse ? (
            <span
              className={`text-eyebrow font-bold ${presentation.status === "REJECTED" ? "text-error" : "text-warning"}`}
            >
              {presentation.label}
            </span>
          ) : isOwnerOrFinance ? (
            <motion.button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDisburseClick(payment);
              }}
              whileTap={reduceMotion ? undefined : payablePressScale}
              transition={transitionSpringSnappy}
              className="relative h-8 shrink-0 rounded-full bg-primary px-3 text-meta font-bold text-on-primary outline-none after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              Cairkan
            </motion.button>
          ) : (
            <span className="flex items-center gap-1 text-eyebrow font-bold text-primary">
              <AppIcon name="schedule" className="text-[13px] leading-none" />
              Dalam antrean
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
