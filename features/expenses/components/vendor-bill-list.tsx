"use client";

import React, { useState, useTransition } from "react";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/utils/error-message";
import { scheduleVendorBillPayment } from "@/app/actions/finance/schedule-vendor-bill";
import { payVendorBill } from "@/app/actions/finance/pay-vendor-bill";
import { EmptyState, MetricGrid, MoneyMetricPill, NativeSection } from "@/components/ui/page-primitives";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { updateUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { toast } from "sonner";
import { VendorBillCard, VendorPaymentCard } from "@/features/expenses/components/vendor-bill-cards";
import {
  VendorDisbursePaymentSheet,
  VendorSchedulePaymentSheet,
} from "@/features/expenses/components/vendor-payment-sheets";
import type {
  VendorBillSubTab,
  VendorListBankAccount,
  VendorListBill,
  VendorListPayment,
  VendorListProject,
  VendorListVendor,
} from "@/features/expenses/components/vendor-bill-list-types";
import { getBillPaymentSummary } from "@/features/expenses/components/vendor-bill-list-utils";
import { FinanceSuccessSheet, type FinanceOperationSuccess } from "@/features/finance/components/finance-form-patterns";
import { useLocalFormRecovery } from "@/features/forms/use-local-form-recovery";

const vendorScheduleRecoverySchema = z.object({
  billId: z.string(),
  selectedBankId: z.string(),
  scheduleAmount: z.string(),
  scheduleDate: z.string(),
});

const vendorDisburseRecoverySchema = z.object({
  paymentId: z.string(),
  disburseBankId: z.string(),
  refNumber: z.string(),
});

export type {
  VendorListBankAccount,
  VendorListBill,
  VendorListBudgetItem,
  VendorListPayment,
  VendorListProject,
  VendorListVendor,
} from "@/features/expenses/components/vendor-bill-list-types";

interface VendorBillListProps {
  readonly projectId?: string;
  readonly vendorBills: VendorListBill[];
  readonly vendorPayments: VendorListPayment[];
  readonly vendors: VendorListVendor[];
  readonly projects: VendorListProject[];
  readonly bankAccounts: VendorListBankAccount[];
  readonly userRole: string;
}

export function VendorBillList({
  projectId,
  vendorBills,
  vendorPayments,
  bankAccounts,
  userRole,
}: VendorBillListProps): React.JSX.Element {
  const router = useRouter();
  const [subTab, setSubTab] = useState<VendorBillSubTab>("BILLS");
  const [visibleLimit, setVisibleLimit] = useState(20);
  const [isPending, startTransition] = useTransition();

  // Modal / Drawer visibility states
  const [selectedBillForSchedule, setSelectedBillForSchedule] = useState<VendorListBill | null>(null);
  const [selectedPaymentForDisburse, setSelectedPaymentForDisburse] = useState<VendorListPayment | null>(null);

  // Error / Success feedback
  const [error, setError] = useState<string | null>(null);
  const [operationSuccess, setOperationSuccess] = useState<FinanceOperationSuccess | null>(null);

  const initialScheduleRecovery = React.useCallback(() => ({
    billId: "",
    selectedBankId: bankAccounts[0]?.id ?? "",
    scheduleAmount: "",
    scheduleDate: new Date().toISOString().split("T")[0],
  }), [bankAccounts]);
  const scheduleRecovery = useLocalFormRecovery({
    storageKey: `atria:finance:vendor-schedule:${projectId ?? "inbox"}`,
    schema: vendorScheduleRecoverySchema,
    initialPayload: initialScheduleRecovery,
  });
  const initialDisburseRecovery = React.useCallback(() => ({
    paymentId: "",
    disburseBankId: "",
    refNumber: "",
  }), []);
  const disburseRecovery = useLocalFormRecovery({
    storageKey: `atria:finance:vendor-disburse:${projectId ?? "inbox"}`,
    schema: vendorDisburseRecoverySchema,
    initialPayload: initialDisburseRecovery,
  });
  const { selectedBankId, scheduleAmount, scheduleDate } = scheduleRecovery.payload;
  const { refNumber, disburseBankId } = disburseRecovery.payload;

  // Derived states
  const isOwnerOrFinance = userRole === "OWNER" || userRole === "FINANCE_ADMIN";
  const isPM = userRole === "PROJECT_MANAGER";
  const canCreateVendorBill = isOwnerOrFinance || isPM || userRole === "PURCHASING";
  const totalBillAmount = vendorBills.reduce((sum, bill) => sum + Number(bill.amount), 0);
  const scheduledAmount = vendorPayments
    .filter((payment) => payment.status === "PENDING" || payment.status === "PROCESSING")
    .reduce((sum, payment) => sum + Number(payment.amountPaid), 0);
  const paidAmount = vendorPayments
    .filter((payment) => payment.status === "COMPLETED")
    .reduce((sum, payment) => sum + Number(payment.amountPaid), 0);

  const openAddBillForm = React.useCallback((): void => {
    updateUrlSearchParam("new-vendor-bill", "true", "push");
  }, []);

  const closeScheduleForm = React.useCallback((): void => {
    setSelectedBillForSchedule(null);
  }, []);

  const closeDisburseForm = React.useCallback((): void => {
    setSelectedPaymentForDisburse(null);
  }, []);

  // Action: Schedule Payment Trigger
  const handleScheduleClick = (bill: VendorListBill) => {
    setSelectedBillForSchedule(bill);
    setError(null);
    if (scheduleRecovery.isDirty && scheduleRecovery.payload.billId === bill.id) return;

    const { totalScheduledOrPaid } = getBillPaymentSummary(bill);
    const remaining = Number(bill.amount) - totalScheduledOrPaid;
    scheduleRecovery.reset({
      billId: bill.id,
      selectedBankId: bankAccounts[0]?.id ?? "",
      scheduleAmount: remaining > 0 ? remaining.toFixed(2) : Number(bill.amount).toFixed(2),
      scheduleDate: new Date().toISOString().split("T")[0],
    });
  };

  const handleScheduleSubmit = (): void => {
    setError(null);
    const billForSchedule = selectedBillForSchedule;

    if (!selectedBankId || !scheduleAmount || !scheduleDate) {
      const message = "Silakan lengkapi formulir penjadwalan.";
      setError(message);
      toast.error(message);
      return;
    }

    if (!billForSchedule) {
      const message = "Tagihan vendor tidak ditemukan.";
      setError(message);
      toast.error(message);
      return;
    }

    startTransition(async () => {
      try {
        const res = await scheduleVendorBillPayment({
          vendorBillId: billForSchedule.id,
          bankAccountId: selectedBankId,
          paymentDate: new Date(scheduleDate),
          amountPaid: Number(scheduleAmount),
        });

        if (!res.success) {
          const errMsg = res.error.message || "Gagal menjadwalkan pembayaran.";
          setError(errMsg);
          toast.error(errMsg);
          return;
        }

        const successMsg = "Pembayaran vendor berhasil dijadwalkan.";
        toast.success(successMsg);
        router.refresh();
        setOperationSuccess({
          title: "Pembayaran vendor dijadwalkan",
          description: Number(scheduleAmount) >= 5_000_000
            ? "Rencana dibuat dan menunggu persetujuan Owner sebelum dapat dicairkan."
            : "Rencana dibuat. Saldo rekening belum berubah sampai pembayaran dicairkan.",
          facts: [
            { label: "Tagihan", value: billForSchedule.billNumber },
            { label: "Nominal", value: `Rp ${Number(scheduleAmount).toLocaleString("id-ID")}` },
            { label: "Tanggal", value: new Date(scheduleDate).toLocaleDateString("id-ID") },
          ],
        });
        scheduleRecovery.clear();
        closeScheduleForm();
      } catch (err) {
        const errMsg = getErrorMessage(err, "Terjadi kesalahan internal.");
        setError(errMsg);
        toast.error(errMsg);
      }
    });
  };

  // Action: Disburse Payment Trigger
  const handleDisburseClick = (payment: VendorListPayment) => {
    setSelectedPaymentForDisburse(payment);
    setError(null);
    if (disburseRecovery.isDirty && disburseRecovery.payload.paymentId === payment.id) return;
    disburseRecovery.reset({
      paymentId: payment.id,
      disburseBankId: payment.bankAccountId,
      refNumber: "",
    });
  };

  const handleDisburseSubmit = (): void => {
    setError(null);
    const paymentForDisburse = selectedPaymentForDisburse;

    if (!refNumber.trim()) {
      const message = "Nomor referensi bukti transfer wajib diisi.";
      setError(message);
      toast.error(message);
      return;
    }

    if (!paymentForDisburse) {
      const message = "Rencana pembayaran vendor tidak ditemukan.";
      setError(message);
      toast.error(message);
      return;
    }

    startTransition(async () => {
      try {
        const res = await payVendorBill({
          vendorPaymentId: paymentForDisburse.id,
          referenceNumber: refNumber.trim(),
          bankAccountId: disburseBankId || undefined, // Pass the chosen bank account override
        });

        if (!res.success) {
          const errMsg = res.error.message || "Gagal memproses pelunasan.";
          setError(errMsg);
          toast.error(errMsg);
          return;
        }

        const successMsg = "Kewajiban tagihan vendor berhasil dilunasi.";
        toast.success(successMsg);
        router.refresh();
        const account = bankAccounts.find((item) => item.id === disburseBankId);
        setOperationSuccess({
          title: "Pembayaran vendor selesai",
          description: "Saldo rekening, ledger, status pembayaran, dan budget proyek telah diperbarui bersama.",
          facts: [
            { label: "Tagihan", value: paymentForDisburse.vendorBill?.billNumber ?? "Tagihan vendor" },
            { label: "Nominal", value: `Rp ${Number(paymentForDisburse.amountPaid).toLocaleString("id-ID")}` },
            { label: "Rekening", value: account?.name ?? "Rekening sumber" },
          ],
        });
        disburseRecovery.clear();
        closeDisburseForm();
      } catch (err) {
        const errMsg = getErrorMessage(err, "Terjadi kesalahan internal.");
        setError(errMsg);
        toast.error(errMsg);
      }
    });
  };

  return (
    <div className="space-y-md">
      <NativeSection
        eyebrow="Vendor Payables"
        title="Tagihan Vendor"
        action={projectId && canCreateVendorBill ? (
            <button
              type="button"
              onClick={openAddBillForm}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-xs font-bold text-on-primary shadow-sm active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              Tambah
            </button>
        ) : undefined}
      >
        <MetricGrid balanceLastRow className="mt-md">
          <MoneyMetricPill label="Total" amount={totalBillAmount} />
          <MoneyMetricPill label="Antrean" amount={scheduledAmount} />
          <MoneyMetricPill label="Lunas" amount={paidAmount} />
        </MetricGrid>
      </NativeSection>

      <SegmentedTabs
        value={subTab}
        onChange={(value) => {
          setSubTab(value);
          setVisibleLimit(20);
        }}
        ariaLabel="Tampilan tagihan vendor"
        options={[
          { value: "BILLS", label: "Tagihan", count: vendorBills.length, icon: <span className="material-symbols-outlined text-[16px]">request_quote</span> },
          { value: "PAYMENTS", label: "Rencana Bayar", count: vendorPayments.length, icon: <span className="material-symbols-outlined text-[16px]">payments</span> },
        ]}
      />

      {subTab === "BILLS" && (
        <div className="space-y-md">
          {vendorBills.length === 0 ? (
            <EmptyState icon="payments" title="Tidak Ada Tagihan" description="Belum ada tagihan pembelian material/vendor yang tercatat." />
          ) : (
            vendorBills.slice(0, visibleLimit).map((bill) => (
              <VendorBillCard
                key={bill.id}
                bill={bill}
                isOwnerOrFinance={isOwnerOrFinance}
                onScheduleClick={handleScheduleClick}
              />
            ))
          )}
          {vendorBills.length > visibleLimit ? (
            <BatchButton onClick={() => setVisibleLimit((current) => current + 20)} />
          ) : null}
        </div>
      )}

      {subTab === "PAYMENTS" && (
        <div className="space-y-md">
          {vendorPayments.length === 0 ? (
            <EmptyState icon="schedule" title="Tidak Ada Rencana Pembayaran" description="Belum ada rencana atau mutasi pembayaran vendor yang terdaftar." />
          ) : (
            vendorPayments.slice(0, visibleLimit).map((payment) => (
              <VendorPaymentCard
                key={payment.id}
                payment={payment}
                isOwnerOrFinance={isOwnerOrFinance}
                onDisburseClick={handleDisburseClick}
              />
            ))
          )}
          {vendorPayments.length > visibleLimit ? (
            <BatchButton onClick={() => setVisibleLimit((current) => current + 20)} />
          ) : null}
        </div>
      )}

      <VendorSchedulePaymentSheet
        key={selectedBillForSchedule?.id ?? "vendor-schedule-closed"}
        bill={selectedBillForSchedule}
        bankAccounts={bankAccounts}
        isPending={isPending}
        error={error}
        selectedBankId={selectedBankId}
        scheduleAmount={scheduleAmount}
        scheduleDate={scheduleDate}
        isDirty={scheduleRecovery.isDirty}
        onClose={closeScheduleForm}
        onDiscard={() => { scheduleRecovery.reset(); closeScheduleForm(); }}
        onSubmit={handleScheduleSubmit}
        onSelectedBankIdChange={(value) => scheduleRecovery.setPayload((current) => ({ ...current, selectedBankId: value }))}
        onScheduleAmountChange={(value) => scheduleRecovery.setPayload((current) => ({ ...current, scheduleAmount: value }))}
        onScheduleDateChange={(value) => scheduleRecovery.setPayload((current) => ({ ...current, scheduleDate: value }))}
      />

      <VendorDisbursePaymentSheet
        key={selectedPaymentForDisburse?.id ?? "vendor-disburse-closed"}
        payment={selectedPaymentForDisburse}
        bankAccounts={bankAccounts}
        isPending={isPending}
        error={error}
        disburseBankId={disburseBankId}
        refNumber={refNumber}
        isDirty={disburseRecovery.isDirty}
        onClose={closeDisburseForm}
        onDiscard={() => { disburseRecovery.reset(); closeDisburseForm(); }}
        onSubmit={handleDisburseSubmit}
        onDisburseBankIdChange={(value) => disburseRecovery.setPayload((current) => ({ ...current, disburseBankId: value }))}
        onRefNumberChange={(value) => disburseRecovery.setPayload((current) => ({ ...current, refNumber: value }))}
      />
      <FinanceSuccessSheet success={operationSuccess} onClose={() => setOperationSuccess(null)} />
    </div>
  );
}

function BatchButton({ onClick }: { readonly onClick: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-12 w-full rounded-full bg-surface-container text-xs font-bold text-on-surface"
    >
      Tampilkan 20 berikutnya
    </button>
  );
}
