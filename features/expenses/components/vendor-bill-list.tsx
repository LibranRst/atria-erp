"use client";

import React, { useState, useTransition } from "react";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/utils/error-message";
import { scheduleVendorBillPayment } from "@/app/actions/finance/schedule-vendor-bill";
import { payVendorBill } from "@/app/actions/finance/pay-vendor-bill";
import { EmptyState, MoneyValue } from "@/components/ui/page-primitives";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import {
  ExpensesGroupSurface,
  ExpensesSectionHeader,
  ExpensesSummarySurface,
} from "@/features/expenses/components/expenses-primitives";
import { updateUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { toast } from "sonner";
import {
  VendorBillCard,
  VendorPaymentCard,
} from "@/features/expenses/components/vendor-bill-cards";
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
import {
  FinanceSuccessSheet,
  type FinanceOperationSuccess,
} from "@/features/finance/components/finance-form-patterns";
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
  readonly leadingContent?: React.ReactNode;
  readonly projectId?: string;
  readonly vendorBills: VendorListBill[];
  readonly vendorPayments: VendorListPayment[];
  readonly vendors: VendorListVendor[];
  readonly projects: VendorListProject[];
  readonly bankAccounts: VendorListBankAccount[];
  readonly userRole: string;
}

export function VendorBillList({
  leadingContent,
  projectId,
  vendorBills,
  vendorPayments,
  bankAccounts,
  userRole,
}: VendorBillListProps): React.JSX.Element {
  const router = useRouter();
  const [subTab, setSubTab] = useState<VendorBillSubTab>("BILLS");
  const [billFilter, setBillFilter] = useState<"ACTIVE" | "PAID" | "ALL">("ACTIVE");
  const [paymentFilter, setPaymentFilter] = useState<"ACTIVE" | "COMPLETED" | "ALL">("ACTIVE");
  const [visibleLimit, setVisibleLimit] = useState(20);
  const [isPending, startTransition] = useTransition();
  const pendingScrollYRef = React.useRef<number | null>(null);
  const resultsRef = React.useRef<HTMLDivElement | null>(null);
  const [resultsMinHeight, setResultsMinHeight] = useState<number | null>(null);

  React.useLayoutEffect(() => {
    const pendingScrollY = pendingScrollYRef.current;
    if (pendingScrollY === null) return;
    window.scrollTo({ top: pendingScrollY, behavior: "auto" });
    pendingScrollYRef.current = null;
  }, [billFilter, paymentFilter, subTab]);

  const preserveScrollPosition = (): void => {
    const currentResultsHeight = resultsRef.current?.getBoundingClientRect().height ?? 0;
    setResultsMinHeight((current) => Math.max(current ?? 0, currentResultsHeight));
    pendingScrollYRef.current = window.scrollY;
  };

  // Modal / Drawer visibility states
  const [selectedBillForSchedule, setSelectedBillForSchedule] = useState<VendorListBill | null>(
    null,
  );
  const [selectedPaymentForDisburse, setSelectedPaymentForDisburse] =
    useState<VendorListPayment | null>(null);

  // Error / Success feedback
  const [error, setError] = useState<string | null>(null);
  const [operationSuccess, setOperationSuccess] = useState<FinanceOperationSuccess | null>(null);

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
    () => ({
      paymentId: "",
      disburseBankId: "",
      refNumber: "",
    }),
    [],
  );
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
  const openBillCount = vendorBills.filter(
    (bill) => bill.status !== "PAID" && bill.status !== "VOID",
  ).length;

  const filteredBills = React.useMemo(() => {
    return vendorBills.filter((bill) => {
      if (billFilter === "ACTIVE") return bill.status !== "PAID" && bill.status !== "VOID";
      if (billFilter === "PAID") return bill.status === "PAID";
      return true;
    });
  }, [vendorBills, billFilter]);

  const filteredPayments = React.useMemo(() => {
    return vendorPayments.filter((payment) => {
      if (paymentFilter === "ACTIVE") return payment.status !== "COMPLETED";
      if (paymentFilter === "COMPLETED") return payment.status === "COMPLETED";
      return true;
    });
  }, [vendorPayments, paymentFilter]);

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
          description:
            Number(scheduleAmount) >= 5_000_000
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
          description:
            "Saldo rekening, ledger, status pembayaran, dan budget proyek telah diperbarui bersama.",
          facts: [
            {
              label: "Tagihan",
              value: paymentForDisburse.vendorBill?.billNumber ?? "Tagihan vendor",
            },
            {
              label: "Nominal",
              value: `Rp ${Number(paymentForDisburse.amountPaid).toLocaleString("id-ID")}`,
            },
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
    <div className="space-y-lg max-[430px]:space-y-5">
      <div className="space-y-3" data-expense-overview-cluster>
        {leadingContent}
        <ExpensesSummarySurface
          ariaLabel="Posisi tagihan vendor"
          eyebrow="Tagihan vendor"
          icon="request_quote"
          status={
            openBillCount > 0 ? `${openBillCount} tagihan terbuka` : "Tidak ada tagihan terbuka"
          }
          statusTone={openBillCount > 0 ? "warning" : "positive"}
          action={
            projectId && canCreateVendorBill ? (
              <button
                type="button"
                onClick={openAddBillForm}
                className="relative inline-flex h-8 items-center justify-center gap-1 rounded-full bg-[#007AFF]/8 px-3 text-[10px] leading-4 font-semibold text-[#007AFF] outline-none after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] focus-visible:ring-2 focus-visible:ring-[#007AFF]/30 active:bg-[#007AFF]/[0.14]"
              >
                <span
                  className="material-symbols-outlined text-[14px] leading-none"
                  aria-hidden="true"
                >
                  add
                </span>
                Tambah
              </button>
            ) : undefined
          }
        >
          <div className="min-w-0">
            <p className="text-[9px] leading-3 font-semibold text-on-surface-variant/60">
              Total tagihan tercatat
            </p>
            <MoneyValue
              amount={totalBillAmount}
              variant="compactWithFull"
              size="lg"
              className="mt-1"
            />
          </div>
          <div className="mt-3.5 grid grid-cols-2 divide-x divide-black/5.5 rounded-[18px] bg-surface-container-low/65 px-3 py-2.5">
            <div className="min-w-0 pr-3">
              <p className="text-[9px] leading-3 font-semibold text-on-surface-variant/60">
                Dalam antrean
              </p>
              <MoneyValue
                amount={scheduledAmount}
                variant="compactWithFull"
                size="sm"
                className="mt-1"
              />
            </div>
            <div className="min-w-0 pl-3 text-right">
              <p className="text-[9px] leading-3 font-semibold text-on-surface-variant/60">
                Sudah dibayar
              </p>
              <MoneyValue
                amount={paidAmount}
                variant="compactWithFull"
                size="sm"
                align="right"
                className="mt-1"
              />
            </div>
          </div>
        </ExpensesSummarySurface>
      </div>

      <div className="space-y-2.5">
        <SegmentedTabs
          value={subTab}
          onChange={(value) => {
            preserveScrollPosition();
            setSubTab(value);
            setVisibleLimit(20);
          }}
          ariaLabel="Tampilan tagihan vendor"
          density="compact"
          options={[
            {
              value: "BILLS",
              label: "Tagihan",
              count: vendorBills.filter((b) => b.status !== "PAID" && b.status !== "VOID").length,
              icon: (
                <span className="material-symbols-outlined text-[16px] leading-none">
                  request_quote
                </span>
              ),
            },
            {
              value: "PAYMENTS",
              label: "Rencana Bayar",
              count: vendorPayments.filter((p) => p.status !== "COMPLETED").length,
              icon: (
                <span className="material-symbols-outlined text-[16px] leading-none">payments</span>
              ),
            },
          ]}
        />

        {subTab === "BILLS" && (
          <SegmentedTabs
            value={billFilter}
            onChange={(val) => {
              preserveScrollPosition();
              setBillFilter(val as "ACTIVE" | "PAID" | "ALL");
              setVisibleLimit(20);
            }}
            ariaLabel="Filter status tagihan"
            density="compact"
            options={[
              {
                value: "ACTIVE",
                label: "Belum Lunas",
                count: vendorBills.filter((b) => b.status !== "PAID" && b.status !== "VOID").length,
              },
              {
                value: "PAID",
                label: "Lunas",
                count: vendorBills.filter((b) => b.status === "PAID").length,
              },
              { value: "ALL", label: "Semua", count: vendorBills.length },
            ]}
          />
        )}

        {subTab === "PAYMENTS" && (
          <SegmentedTabs
            value={paymentFilter}
            onChange={(val) => {
              preserveScrollPosition();
              setPaymentFilter(val as "ACTIVE" | "COMPLETED" | "ALL");
              setVisibleLimit(20);
            }}
            ariaLabel="Filter status rencana bayar"
            density="compact"
            options={[
              {
                value: "ACTIVE",
                label: "Belum Cair",
                count: vendorPayments.filter((p) => p.status !== "COMPLETED").length,
              },
              {
                value: "COMPLETED",
                label: "Selesai Cair",
                count: vendorPayments.filter((p) => p.status === "COMPLETED").length,
              },
              { value: "ALL", label: "Semua", count: vendorPayments.length },
            ]}
          />
        )}
      </div>

      <div
        ref={resultsRef}
        style={resultsMinHeight === null ? undefined : { minHeight: `${resultsMinHeight}px` }}
      >
        {subTab === "BILLS" && (
          <div className="space-y-3">
            <ExpensesSectionHeader title="Daftar tagihan" meta={`${filteredBills.length} item`} />
            {filteredBills.length === 0 ? (
              <ExpensesGroupSurface>
                <EmptyState
                  icon="payments"
                  title="Tidak Ada Tagihan"
                  description="Belum ada tagihan pembelian material/vendor yang tercatat."
                />
              </ExpensesGroupSurface>
            ) : (
              <ExpensesGroupSurface>
                <div className="divide-y divide-black/5.5">
                  {filteredBills.slice(0, visibleLimit).map((bill) => (
                    <VendorBillCard
                      key={bill.id}
                      bill={bill}
                      isOwnerOrFinance={isOwnerOrFinance}
                      onScheduleClick={handleScheduleClick}
                    />
                  ))}
                </div>
              </ExpensesGroupSurface>
            )}
            {filteredBills.length > visibleLimit ? (
              <BatchButton onClick={() => setVisibleLimit((current) => current + 20)} />
            ) : null}
          </div>
        )}

        {subTab === "PAYMENTS" && (
          <div className="space-y-3">
            <ExpensesSectionHeader
              title="Rencana pembayaran"
              meta={`${filteredPayments.length} item`}
            />
            {filteredPayments.length === 0 ? (
              <ExpensesGroupSurface>
                <EmptyState
                  icon="schedule"
                  title="Tidak Ada Rencana Pembayaran"
                  description="Belum ada rencana atau mutasi pembayaran vendor yang terdaftar."
                />
              </ExpensesGroupSurface>
            ) : (
              <ExpensesGroupSurface>
                <div className="divide-y divide-black/5.5">
                  {filteredPayments.slice(0, visibleLimit).map((payment) => (
                    <VendorPaymentCard
                      key={payment.id}
                      payment={payment}
                      isOwnerOrFinance={isOwnerOrFinance}
                      onDisburseClick={handleDisburseClick}
                    />
                  ))}
                </div>
              </ExpensesGroupSurface>
            )}
            {filteredPayments.length > visibleLimit ? (
              <BatchButton onClick={() => setVisibleLimit((current) => current + 20)} />
            ) : null}
          </div>
        )}
      </div>

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
        onDiscard={() => {
          scheduleRecovery.reset();
          closeScheduleForm();
        }}
        onSubmit={handleScheduleSubmit}
        onSelectedBankIdChange={(value) =>
          scheduleRecovery.setPayload((current) => ({ ...current, selectedBankId: value }))
        }
        onScheduleAmountChange={(value) =>
          scheduleRecovery.setPayload((current) => ({ ...current, scheduleAmount: value }))
        }
        onScheduleDateChange={(value) =>
          scheduleRecovery.setPayload((current) => ({ ...current, scheduleDate: value }))
        }
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
        onDiscard={() => {
          disburseRecovery.reset();
          closeDisburseForm();
        }}
        onSubmit={handleDisburseSubmit}
        onDisburseBankIdChange={(value) =>
          disburseRecovery.setPayload((current) => ({ ...current, disburseBankId: value }))
        }
        onRefNumberChange={(value) =>
          disburseRecovery.setPayload((current) => ({ ...current, refNumber: value }))
        }
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
      className="min-h-12 w-full rounded-full bg-surface-container text-xs leading-4 font-bold text-on-surface"
    >
      Tampilkan 20 berikutnya
    </button>
  );
}
