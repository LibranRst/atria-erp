"use client";

import React from "react";

import { EmptyState, MoneyValue } from "@/components/ui/feedback/page-primitives";
import { AppIcon } from "@/components/ui/icon/app-icon";
import { SegmentedTabs } from "@/components/ui/navigation/segmented-tabs";
import { usePreservedScrollHeight } from "@/features/shared-hooks/use-preserved-scroll-height";
import {
  GroupedSurface,
  SectionHeader,
  SummaryFact,
  SummarySurface,
} from "@/components/ui/feedback/main-surface";
import type {
  VendorBillSubTab,
  VendorListBill,
  VendorListPayment,
} from "@/features/expenses/types/vendor-bill-list-types";
import { VendorBillCard, VendorPaymentCard } from "./vendor-bill-cards";

type BillFilter = "ACTIVE" | "PAID" | "ALL";
type PaymentFilter = "ACTIVE" | "COMPLETED" | "ALL";

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

export function VendorBillListContent({
  leadingContent,
  projectId,
  vendorBills,
  vendorPayments,
  canCreateVendorBill,
  isOwnerOrFinance,
  onAddBill,
  onSchedule,
  onDisburse,
}: {
  readonly leadingContent?: React.ReactNode;
  readonly projectId?: string;
  readonly vendorBills: readonly VendorListBill[];
  readonly vendorPayments: readonly VendorListPayment[];
  readonly canCreateVendorBill: boolean;
  readonly isOwnerOrFinance: boolean;
  readonly onAddBill: () => void;
  readonly onSchedule: (bill: VendorListBill) => void;
  readonly onDisburse: (payment: VendorListPayment) => void;
}): React.JSX.Element {
  const [subTab, setSubTab] = React.useState<VendorBillSubTab>("BILLS");
  const [billFilter, setBillFilter] = React.useState<BillFilter>("ACTIVE");
  const [paymentFilter, setPaymentFilter] = React.useState<PaymentFilter>("ACTIVE");
  const [visibleLimit, setVisibleLimit] = React.useState(20);
  const {
    containerRef: resultsRef,
    containerStyle: resultsStyle,
    preserveScrollPosition,
  } = usePreservedScrollHeight(`${subTab}:${billFilter}:${paymentFilter}`);

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
  const filteredBills = vendorBills.filter((bill) => {
    if (billFilter === "ACTIVE") return bill.status !== "PAID" && bill.status !== "VOID";
    if (billFilter === "PAID") return bill.status === "PAID";
    return true;
  });
  const filteredPayments = vendorPayments.filter((payment) => {
    if (paymentFilter === "ACTIVE") return payment.status !== "COMPLETED";
    if (paymentFilter === "COMPLETED") return payment.status === "COMPLETED";
    return true;
  });

  return (
    <>
      <div className="space-y-3" data-expense-overview-cluster>
        {leadingContent}
        <SummarySurface
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
                onClick={onAddBill}
                className="relative inline-flex h-8 items-center justify-center gap-1 rounded-full bg-accent/8 px-3 text-meta font-semibold text-accent outline-none after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-accent/[0.14]"
              >
                <AppIcon name="add" className="text-[14px] leading-none" />
                Tambah
              </button>
            ) : undefined
          }
        >
          <div className="flex items-end justify-between gap-4 px-3.5 pt-3.5 pb-2">
            <div className="min-w-0">
              <p className="text-eyebrow font-semibold text-on-surface-variant/60">
                Total tagihan tercatat
              </p>
              <MoneyValue
                amount={totalBillAmount}
                variant="compactWithFull"
                size="lg"
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 p-2">
            <SummaryFact label="Dalam antrean" amount={scheduledAmount} />
            <SummaryFact label="Sudah dibayar" amount={paidAmount} />
          </div>
        </SummarySurface>
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
              count: openBillCount,
              icon: <AppIcon name="request_quote" className="text-[16px] leading-none" />,
            },
            {
              value: "PAYMENTS",
              label: "Rencana Bayar",
              count: vendorPayments.filter((payment) => payment.status !== "COMPLETED").length,
              icon: <AppIcon name="payments" className="text-[16px] leading-none" />,
            },
          ]}
        />
        {subTab === "BILLS" ? (
          <SegmentedTabs
            value={billFilter}
            onChange={(value) => {
              preserveScrollPosition();
              setBillFilter(value);
              setVisibleLimit(20);
            }}
            ariaLabel="Filter status tagihan"
            density="compact"
            options={[
              { value: "ACTIVE", label: "Belum Lunas", count: openBillCount },
              {
                value: "PAID",
                label: "Lunas",
                count: vendorBills.filter((bill) => bill.status === "PAID").length,
              },
              { value: "ALL", label: "Semua", count: vendorBills.length },
            ]}
          />
        ) : (
          <SegmentedTabs
            value={paymentFilter}
            onChange={(value) => {
              preserveScrollPosition();
              setPaymentFilter(value);
              setVisibleLimit(20);
            }}
            ariaLabel="Filter status rencana bayar"
            density="compact"
            options={[
              {
                value: "ACTIVE",
                label: "Belum Cair",
                count: vendorPayments.filter((payment) => payment.status !== "COMPLETED").length,
              },
              {
                value: "COMPLETED",
                label: "Selesai Cair",
                count: vendorPayments.filter((payment) => payment.status === "COMPLETED").length,
              },
              { value: "ALL", label: "Semua", count: vendorPayments.length },
            ]}
          />
        )}
      </div>

      <div ref={resultsRef} style={resultsStyle}>
        {subTab === "BILLS" ? (
          <div className="space-y-3">
            <SectionHeader
              title="Daftar tagihan"
              count={filteredBills.length}
              countLabel="Tagihan"
            />
            <GroupedSurface>
              {filteredBills.length === 0 ? (
                <EmptyState
                  icon="payments"
                  title="Tidak Ada Tagihan"
                  description="Belum ada tagihan pembelian material/vendor yang tercatat."
                />
              ) : (
                <div className="divide-y divide-black/5.5">
                  {filteredBills.slice(0, visibleLimit).map((bill) => (
                    <VendorBillCard
                      key={bill.id}
                      bill={bill}
                      isOwnerOrFinance={isOwnerOrFinance}
                      onScheduleClick={onSchedule}
                    />
                  ))}
                </div>
              )}
            </GroupedSurface>
            {filteredBills.length > visibleLimit ? (
              <BatchButton onClick={() => setVisibleLimit((current) => current + 20)} />
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <SectionHeader
              title="Rencana pembayaran"
              count={filteredPayments.length}
              countLabel="Pembayaran"
            />
            <GroupedSurface>
              {filteredPayments.length === 0 ? (
                <EmptyState
                  icon="schedule"
                  title="Tidak Ada Rencana Pembayaran"
                  description="Belum ada rencana atau mutasi pembayaran vendor yang terdaftar."
                />
              ) : (
                <div className="divide-y divide-black/5.5">
                  {filteredPayments.slice(0, visibleLimit).map((payment) => (
                    <VendorPaymentCard
                      key={payment.id}
                      payment={payment}
                      isOwnerOrFinance={isOwnerOrFinance}
                      onDisburseClick={onDisburse}
                    />
                  ))}
                </div>
              )}
            </GroupedSurface>
            {filteredPayments.length > visibleLimit ? (
              <BatchButton onClick={() => setVisibleLimit((current) => current + 20)} />
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
