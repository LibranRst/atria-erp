"use client";

import React from "react";
import { AppIcon, Button, FactRow, GroupedSurface, MoneyValue, StatusBadge } from "@/components/ui";
import { useActivityDetail } from "@/features/activity-detail/components/activity-detail-provider";
import type {
  VendorListBill,
  VendorListPayment,
} from "@/features/expenses/types/vendor-bill-list-types";
import {
  getBillPaymentSummary,
  getVendorPaymentPresentation,
} from "@/features/expenses/utils/vendor-bill-list-utils";
import {
  canDisburseVendorPayment,
  canScheduleVendorBill,
  formatVendorDate,
  vendorBillPresentation,
  vendorPaymentTone,
} from "@/features/expenses/utils/vendor-desktop-presentation";

export function VendorDesktopBillDetail({
  bill,
  canPay,
  onSchedule,
  onBack,
}: {
  readonly bill: VendorListBill;
  readonly canPay: boolean;
  readonly onSchedule: (bill: VendorListBill) => void;
  readonly onBack: () => void;
}): React.JSX.Element {
  const { openActivityDetail } = useActivityDetail();
  const summary = getBillPaymentSummary(bill);
  const status = vendorBillPresentation(bill);
  const canSchedule = canScheduleVendorBill(bill, canPay);
  const amount = Number(bill.amount);
  return (
    <section
      aria-label={`Rincian tagihan ${bill.billNumber}`}
      className="min-w-0 space-y-3 xl:sticky xl:top-24"
    >
      <div className="xl:hidden">
        <Button variant="secondary" size="mini" onClick={onBack}>
          <AppIcon name="arrow_back" className="icon-sm" /> Kembali ke daftar
        </Button>
      </div>
      <GroupedSurface variant="desktopPanel" className="@container min-w-0 overflow-hidden">
        <div className="space-y-2 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="min-w-0 text-row font-bold wrap-anywhere text-on-surface">
              {bill.vendor?.name ?? "Vendor"}
            </h3>
            <StatusBadge label={status.label} tone={status.tone} />
          </div>
          <p className="text-support text-on-surface-variant">{bill.billNumber}</p>
          <MoneyValue
            amount={amount}
            fractionDigits={Number.isInteger(amount) ? 0 : 2}
            variant="fullDynamic"
            size="lg"
          />
          <p className="text-support text-on-surface-variant">{bill.project?.name ?? "Proyek"}</p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-outline-variant/40 bg-surface-container-low px-4">
          <div className="min-w-0 py-3 pr-3">
            <p className="text-support text-on-surface-variant">Sudah dibayar</p>
            <MoneyValue
              amount={summary.completedPaymentAmount}
              fractionDigits={Number.isInteger(summary.completedPaymentAmount) ? 0 : 2}
              variant="compact"
              size="sm"
            />
          </div>
          <div className="min-w-0 py-3 pl-3">
            <p className="text-support text-on-surface-variant">Dalam antrean</p>
            <MoneyValue
              amount={summary.pendingPaymentAmount}
              fractionDigits={Number.isInteger(summary.pendingPaymentAmount) ? 0 : 2}
              variant="compact"
              size="sm"
            />
          </div>
        </div>
        <div className="divide-y divide-outline-variant/40">
          <FactRow label="Jatuh tempo" value={formatVendorDate(bill.dueDate)} />
          <FactRow
            label="Belum dijadwalkan"
            value={
              <MoneyValue
                amount={Math.max(0, amount - summary.totalScheduledOrPaid)}
                fractionDigits={
                  Number.isInteger(Math.max(0, amount - summary.totalScheduledOrPaid)) ? 0 : 2
                }
                variant="fullDynamic"
                size="sm"
              />
            }
          />
          {bill.budgetItem?.name ? (
            <FactRow label="Item budget" value={bill.budgetItem.name} wrapLabel />
          ) : null}
        </div>
        {bill.notes ? (
          <div className="border-t border-outline-variant/40 px-4 py-3">
            <p className="text-support text-on-surface-variant">Catatan</p>
            <p className="mt-1 text-sm wrap-anywhere whitespace-pre-wrap text-on-surface">
              {bill.notes}
            </p>
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-2 border-t border-outline-variant/40 p-4 @lg:grid-cols-2">
          {canSchedule ? (
            <Button variant="primary" size="compact" fullWidth onClick={() => onSchedule(bill)}>
              {summary.totalScheduledOrPaid > 0 ? "Jadwalkan sisa" : "Jadwalkan bayar"}
            </Button>
          ) : summary.isFullyScheduledOrPaid && bill.status !== "PAID" && bill.status !== "VOID" ? (
            <p className="flex items-center gap-2 text-support text-on-surface-variant @lg:col-span-2">
              <AppIcon name="schedule" className="icon-sm" />
              {summary.hasPending ? "Menunggu pencairan" : "Terjadwal penuh"}
            </p>
          ) : null}
          <Button
            variant="secondary"
            size="compact"
            fullWidth
            className={canSchedule ? undefined : "@lg:col-span-2"}
            onClick={() =>
              openActivityDetail(
                { kind: "VENDOR_BILL", id: bill.id },
                canSchedule
                  ? {
                      actions: {
                        primary: { label: "Jadwalkan bayar", onClick: () => onSchedule(bill) },
                      },
                    }
                  : undefined,
              )
            }
          >
            Buka detail tagihan
          </Button>
        </div>
      </GroupedSurface>
      {bill.payments?.length ? (
        <GroupedSurface variant="desktopPanel">
          <div className="border-b border-outline-variant/40 px-4 py-3">
            <h4 className="text-sm font-bold">Riwayat pembayaran</h4>
          </div>
          <div className="max-h-64 divide-y divide-outline-variant/40 overflow-y-auto">
            {bill.payments.map((payment) => (
              <div key={payment.id} className="space-y-1 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-support text-on-surface-variant">
                    {formatVendorDate(payment.paymentDate)}
                  </p>
                  <StatusBadge
                    label={getVendorPaymentPresentation(payment).label}
                    tone={vendorPaymentTone(payment)}
                  />
                </div>
                <MoneyValue
                  amount={Number(payment.amountPaid)}
                  fractionDigits={Number.isInteger(Number(payment.amountPaid)) ? 0 : 2}
                  variant="fullDynamic"
                  size="sm"
                />
                {payment.bankAccount?.name ? (
                  <p className="text-support text-on-surface-variant">{payment.bankAccount.name}</p>
                ) : null}
              </div>
            ))}
          </div>
        </GroupedSurface>
      ) : null}
    </section>
  );
}

export function VendorDesktopPaymentDetail({
  payment,
  canPay,
  onDisburse,
  onBack,
}: {
  readonly payment: VendorListPayment;
  readonly canPay: boolean;
  readonly onDisburse: (payment: VendorListPayment) => void;
  readonly onBack: () => void;
}): React.JSX.Element {
  const { openActivityDetail } = useActivityDetail();
  const presentation = getVendorPaymentPresentation(payment);
  const canDisburse = canDisburseVendorPayment(payment, canPay);
  return (
    <section
      aria-label="Rincian pembayaran vendor"
      className="min-w-0 space-y-3 xl:sticky xl:top-24"
    >
      <div className="xl:hidden">
        <Button variant="secondary" size="mini" onClick={onBack}>
          <AppIcon name="arrow_back" className="icon-sm" /> Kembali ke daftar
        </Button>
      </div>
      <GroupedSurface variant="desktopPanel" className="@container min-w-0 overflow-hidden">
        <div className="space-y-2 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-row font-bold wrap-anywhere">
              {payment.vendorBill?.vendor?.name ?? "Vendor"}
            </h3>
            <StatusBadge label={presentation.label} tone={vendorPaymentTone(payment)} />
          </div>
          <p className="text-support text-on-surface-variant">
            {payment.vendorBill?.billNumber ?? "Pembayaran vendor"}
          </p>
          <MoneyValue
            amount={Number(payment.amountPaid)}
            fractionDigits={Number.isInteger(Number(payment.amountPaid)) ? 0 : 2}
            variant="fullDynamic"
            size="lg"
          />
          <p className="text-support text-on-surface-variant">
            {payment.vendorBill?.project?.name ?? "Proyek"}
          </p>
        </div>
        <div className="divide-y divide-outline-variant/40">
          <FactRow
            label={payment.status === "COMPLETED" ? "Dicairkan" : "Tanggal rencana"}
            value={formatVendorDate(payment.paymentDate)}
          />
          {payment.bankAccount?.name ? (
            <FactRow label="Rekening" value={payment.bankAccount.name} wrapLabel />
          ) : null}
          {payment.referenceNumber ? (
            <FactRow label="Referensi" value={payment.referenceNumber} wrapLabel />
          ) : null}
        </div>
        {presentation.label === "Menunggu Owner" ? (
          <p className="border-t border-outline-variant/40 px-4 py-3 text-support text-on-surface-variant">
            Persetujuan Owner diperlukan sebelum pencairan.
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-2 border-t border-outline-variant/40 p-4 @lg:grid-cols-2">
          {canDisburse ? (
            <Button variant="primary" size="compact" fullWidth onClick={() => onDisburse(payment)}>
              Cairkan pembayaran
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="compact"
            fullWidth
            className={canDisburse ? undefined : "@lg:col-span-2"}
            onClick={() =>
              openActivityDetail(
                { kind: "VENDOR_PAYMENT", id: payment.id },
                canDisburse
                  ? {
                      actions: {
                        primary: { label: "Cairkan", onClick: () => onDisburse(payment) },
                      },
                    }
                  : undefined,
              )
            }
          >
            Buka detail pembayaran
          </Button>
        </div>
      </GroupedSurface>
    </section>
  );
}
