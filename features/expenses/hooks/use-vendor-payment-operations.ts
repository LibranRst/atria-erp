"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";

import { payVendorBill } from "@/app/actions/finance/pay-vendor-bill";
import { scheduleVendorBillPayment } from "@/app/actions/finance/schedule-vendor-bill";
import type { OperationSuccess } from "@/components/ui";
import { useLocalFormRecovery } from "@/features/shared-hooks/use-local-form-recovery";
import type {
  VendorListBankAccount,
  VendorListBill,
  VendorListPayment,
} from "@/features/expenses/types/vendor-bill-list-types";
import { getBillPaymentSummary } from "@/features/expenses/utils/vendor-bill-list-utils";
import { getErrorMessage } from "@/lib/utils/error-message";

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

type VendorPaymentOperations = {
  readonly selectedBill: VendorListBill | null;
  readonly selectedPayment: VendorListPayment | null;
  readonly pending: boolean;
  readonly error: string | null;
  readonly success: OperationSuccess | null;
  readonly selectedBankId: string;
  readonly scheduleAmount: string;
  readonly scheduleDate: string;
  readonly disburseBankId: string;
  readonly refNumber: string;
  readonly scheduleIsDirty: boolean;
  readonly disburseIsDirty: boolean;
  readonly openSchedule: (bill: VendorListBill) => void;
  readonly openDisburse: (payment: VendorListPayment) => void;
  readonly closeSchedule: () => void;
  readonly closeDisburse: () => void;
  readonly discardSchedule: () => void;
  readonly discardDisburse: () => void;
  readonly submitSchedule: () => void;
  readonly submitDisburse: () => void;
  readonly setSelectedBankId: (value: string) => void;
  readonly setScheduleAmount: (value: string) => void;
  readonly setScheduleDate: (value: string) => void;
  readonly setDisburseBankId: (value: string) => void;
  readonly setRefNumber: (value: string) => void;
  readonly clearSuccess: () => void;
};

export function useVendorPaymentOperations({
  projectId,
  bankAccounts,
}: {
  readonly projectId?: string;
  readonly bankAccounts: readonly VendorListBankAccount[];
}): VendorPaymentOperations {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [selectedBill, setSelectedBill] = React.useState<VendorListBill | null>(null);
  const [selectedPayment, setSelectedPayment] = React.useState<VendorListPayment | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<OperationSuccess | null>(null);
  const initialScheduleRecovery = React.useCallback(
    () => ({
      billId: "",
      selectedBankId: bankAccounts[0]?.id ?? "",
      scheduleAmount: "",
      scheduleDate: new Date().toISOString().split("T")[0],
    }),
    [bankAccounts],
  );
  const scheduleRecovery = useLocalFormRecovery({
    storageKey: `atria:finance:vendor-schedule:${projectId ?? "inbox"}`,
    schema: vendorScheduleRecoverySchema,
    initialPayload: initialScheduleRecovery,
  });
  const initialDisburseRecovery = React.useCallback(
    () => ({ paymentId: "", disburseBankId: "", refNumber: "" }),
    [],
  );
  const disburseRecovery = useLocalFormRecovery({
    storageKey: `atria:finance:vendor-disburse:${projectId ?? "inbox"}`,
    schema: vendorDisburseRecoverySchema,
    initialPayload: initialDisburseRecovery,
  });

  function openSchedule(bill: VendorListBill): void {
    setSelectedBill(bill);
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
  }

  function openDisburse(payment: VendorListPayment): void {
    setSelectedPayment(payment);
    setError(null);
    if (disburseRecovery.isDirty && disburseRecovery.payload.paymentId === payment.id) return;
    disburseRecovery.reset({
      paymentId: payment.id,
      disburseBankId: payment.bankAccountId,
      refNumber: "",
    });
  }

  function closeSchedule(): void {
    setSelectedBill(null);
  }

  function closeDisburse(): void {
    setSelectedPayment(null);
  }

  function submitSchedule(): void {
    setError(null);
    const { selectedBankId, scheduleAmount, scheduleDate } = scheduleRecovery.payload;
    if (!selectedBankId || !scheduleAmount || !scheduleDate) {
      const message = "Silakan lengkapi formulir penjadwalan.";
      setError(message);
      toast.error(message);
      return;
    }
    if (!selectedBill) {
      const message = "Tagihan vendor tidak ditemukan.";
      setError(message);
      toast.error(message);
      return;
    }

    startTransition(async () => {
      try {
        const result = await scheduleVendorBillPayment({
          vendorBillId: selectedBill.id,
          bankAccountId: selectedBankId,
          paymentDate: new Date(scheduleDate),
          amountPaid: Number(scheduleAmount),
        });
        if (!result.success) {
          const message = result.error.message || "Gagal menjadwalkan pembayaran.";
          setError(message);
          toast.error(message);
          return;
        }
        toast.success("Pembayaran vendor berhasil dijadwalkan.");
        router.refresh();
        setSuccess({
          title: "Pembayaran vendor dijadwalkan",
          description:
            Number(scheduleAmount) >= 5_000_000
              ? "Rencana dibuat dan menunggu persetujuan Owner sebelum dapat dicairkan."
              : "Rencana dibuat. Saldo rekening belum berubah sampai pembayaran dicairkan.",
          facts: [
            { label: "Tagihan", value: selectedBill.billNumber },
            { label: "Nominal", value: `Rp ${Number(scheduleAmount).toLocaleString("id-ID")}` },
            { label: "Tanggal", value: new Date(scheduleDate).toLocaleDateString("id-ID") },
          ],
        });
        scheduleRecovery.clear();
        closeSchedule();
      } catch (cause) {
        const message = getErrorMessage(cause, "Terjadi kesalahan internal.");
        setError(message);
        toast.error(message);
      }
    });
  }

  function submitDisburse(): void {
    setError(null);
    const { refNumber, disburseBankId } = disburseRecovery.payload;
    if (!refNumber.trim()) {
      const message = "Nomor referensi bukti transfer wajib diisi.";
      setError(message);
      toast.error(message);
      return;
    }
    if (!selectedPayment) {
      const message = "Rencana pembayaran vendor tidak ditemukan.";
      setError(message);
      toast.error(message);
      return;
    }

    startTransition(async () => {
      try {
        const result = await payVendorBill({
          vendorPaymentId: selectedPayment.id,
          referenceNumber: refNumber.trim(),
          bankAccountId: disburseBankId || undefined,
        });
        if (!result.success) {
          const message = result.error.message || "Gagal memproses pelunasan.";
          setError(message);
          toast.error(message);
          return;
        }
        toast.success("Kewajiban tagihan vendor berhasil dilunasi.");
        router.refresh();
        const account = bankAccounts.find((item) => item.id === disburseBankId);
        setSuccess({
          title: "Pembayaran vendor selesai",
          description:
            "Saldo rekening, ledger, status pembayaran, dan budget proyek telah diperbarui bersama.",
          facts: [
            {
              label: "Tagihan",
              value: selectedPayment.vendorBill?.billNumber ?? "Tagihan vendor",
            },
            {
              label: "Nominal",
              value: `Rp ${Number(selectedPayment.amountPaid).toLocaleString("id-ID")}`,
            },
            { label: "Rekening", value: account?.name ?? "Rekening sumber" },
          ],
        });
        disburseRecovery.clear();
        closeDisburse();
      } catch (cause) {
        const message = getErrorMessage(cause, "Terjadi kesalahan internal.");
        setError(message);
        toast.error(message);
      }
    });
  }

  function patchSchedule(patch: Partial<typeof scheduleRecovery.payload>): void {
    scheduleRecovery.setPayload((current) => ({ ...current, ...patch }));
  }

  function patchDisburse(patch: Partial<typeof disburseRecovery.payload>): void {
    disburseRecovery.setPayload((current) => ({ ...current, ...patch }));
  }

  return {
    selectedBill,
    selectedPayment,
    pending,
    error,
    success,
    selectedBankId: scheduleRecovery.payload.selectedBankId,
    scheduleAmount: scheduleRecovery.payload.scheduleAmount,
    scheduleDate: scheduleRecovery.payload.scheduleDate,
    disburseBankId: disburseRecovery.payload.disburseBankId,
    refNumber: disburseRecovery.payload.refNumber,
    scheduleIsDirty: scheduleRecovery.isDirty,
    disburseIsDirty: disburseRecovery.isDirty,
    openSchedule,
    openDisburse,
    closeSchedule,
    closeDisburse,
    discardSchedule: () => {
      scheduleRecovery.reset();
      closeSchedule();
    },
    discardDisburse: () => {
      disburseRecovery.reset();
      closeDisburse();
    },
    submitSchedule,
    submitDisburse,
    setSelectedBankId: (selectedBankId) => patchSchedule({ selectedBankId }),
    setScheduleAmount: (scheduleAmount) => patchSchedule({ scheduleAmount }),
    setScheduleDate: (scheduleDate) => patchSchedule({ scheduleDate }),
    setDisburseBankId: (disburseBankId) => patchDisburse({ disburseBankId }),
    setRefNumber: (refNumber) => patchDisburse({ refNumber }),
    clearSuccess: () => setSuccess(null),
  };
}
