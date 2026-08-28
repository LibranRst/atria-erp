"use client";

import { useCan } from "@/components/auth/permissions-provider";
import { useRouter } from "next/navigation";
import React, { useState, useTransition } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  AppIcon,
  type OperationSuccess,
  OperationSuccessDialog,
  SegmentedTabs,
} from "@/components/ui";
import { useLocalFormRecovery } from "@/lib/hooks/use-local-form-recovery";

const fieldDisbursementRecoverySchema = z.object({
  costId: z.string(),
  selectedBankId: z.string(),
  refNumber: z.string(),
});

import { payFieldRequest, verifyFieldRequest } from "@/app/actions/finance/field-requests";
import { getErrorMessage } from "@atria/core/utils/error-message";
import { updateUrlSearchParam, useUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { FieldDisbursementSheet } from "@/features/expenses/components/sheets/expense-list-dialogs";
import { ReceiptImageLightbox } from "@/features/expenses/components/sheets/expense-list-dialogs";
import {
  type BankAccountItem,
  type ExpenseCostItem,
  type ExpenseListTab,
  type FilterStatus,
  type VendorListBill,
  type VendorListPayment,
  type VendorListProject,
  type VendorListVendor,
} from "@atria/core/types/expenses";
import { PendingApprovalsBanner } from "@/features/expenses/components/shared/expense-list-header";
import { FinanceInboxHeader } from "@/features/expenses/components/shared/expense-list-header";
import { FieldClaimsPanel } from "@/features/expenses/components/lists/field-claims-panel";
import { ExpenseDraftsPanel } from "@/features/expenses/components/lists/expense-drafts-panel";
import { VendorBillList } from "./vendor-bill-list";

export type { BankAccountItem, ExpenseCostItem } from "@atria/core/types/expenses";

interface ExpenseListProps {
  projectId?: string;
  initialCosts: ExpenseCostItem[];
  bankAccounts: BankAccountItem[];
  vendorBills?: VendorListBill[];
  vendorPayments?: VendorListPayment[];
  vendorPaymentApprovalThreshold: number;
  vendors?: VendorListVendor[];
  projects?: VendorListProject[];
  pendingApprovalsCount?: number;
}

export function ExpenseList({
  projectId,
  initialCosts,
  bankAccounts,
  vendorBills = [],
  vendorPayments = [],
  vendorPaymentApprovalThreshold,
  vendors = [],
  projects = [],
  pendingApprovalsCount = 0,
}: ExpenseListProps): React.JSX.Element {
  const can = useCan();
  const router = useRouter();
  const shouldOpenVendorBill = useUrlSearchParam("new-vendor-bill") === "true";
  const shouldShowVendorBills = useUrlSearchParam("view") === "vendor-bills";
  const shouldForceVendorBills = shouldOpenVendorBill || shouldShowVendorBills;
  const [activeTab, setActiveTab] = useState<ExpenseListTab>(
    shouldForceVendorBills ? "VENDOR_BILLS" : "FIELD_CLAIMS",
  );
  const displayedTab = shouldForceVendorBills ? "VENDOR_BILLS" : activeTab;
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [selectedCost, setSelectedCost] = useState<ExpenseCostItem | null>(null);
  const initialDisbursementRecovery = React.useCallback(
    () => ({
      costId: "",
      selectedBankId: bankAccounts[0]?.id ?? "",
      refNumber: "",
    }),
    [bankAccounts],
  );
  const disbursementRecovery = useLocalFormRecovery({
    storageKey: `atria:finance:field-disbursement:${projectId ?? "inbox"}`,
    schema: fieldDisbursementRecoverySchema,
    initialPayload: initialDisbursementRecovery,
  });
  const { selectedBankId, refNumber } = disbursementRecovery.payload;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [operationSuccess, setOperationSuccess] = useState<OperationSuccess | null>(null);

  const isOwnerOrFinance = can("view:bank_account");

  const selectTab = React.useCallback(
    (nextTab: ExpenseListTab): void => {
      setActiveTab(nextTab);
      if (projectId) return;
      updateUrlSearchParam("view", nextTab === "VENDOR_BILLS" ? "vendor-bills" : null, "replace");
    },
    [projectId],
  );

  const openExpenseDrawer = React.useCallback((): void => {
    updateUrlSearchParam("new-expense", "true", "push");
  }, []);

  const closeDisburseForm = React.useCallback((): void => {
    setSelectedCost(null);
  }, []);

  const filteredCosts = initialCosts.filter((cost) => {
    if (filter === "ALL") return cost.status !== "PAID" && cost.status !== "REJECTED";
    if (filter === "NEEDS_VERIFICATION") return cost.status === "SUBMITTED";
    if (filter === "NEEDS_APPROVAL") return cost.status === "VERIFIED";
    if (filter === "READY_TO_PAY") return cost.status === "APPROVED";
    return cost.status === filter;
  });
  const activeCosts = initialCosts.filter(
    (cost) => cost.status !== "PAID" && cost.status !== "REJECTED",
  );
  const readyToPayCount = initialCosts.filter((cost) => cost.status === "APPROVED").length;
  const fieldClaimTotal = initialCosts.reduce((sum, cost) => sum + Number(cost.amount), 0);
  const activeClaimTotal = activeCosts.reduce((sum, cost) => sum + Number(cost.amount), 0);
  const needsActionCount = initialCosts.filter(
    (cost) => cost.status === "SUBMITTED" || cost.status === "VERIFIED",
  ).length;
  const filterTabs: ReadonlyArray<{
    readonly label: string;
    readonly value: FilterStatus;
    readonly count: number;
  }> = [
    { label: "Aktif", value: "ALL", count: activeCosts.length },
    {
      label: "Verifikasi",
      value: "NEEDS_VERIFICATION",
      count: initialCosts.filter((cost) => cost.status === "SUBMITTED").length,
    },
    {
      label: "Approval",
      value: "NEEDS_APPROVAL",
      count: initialCosts.filter((cost) => cost.status === "VERIFIED").length,
    },
    { label: "Siap Cair", value: "READY_TO_PAY", count: readyToPayCount },
    {
      label: "Riwayat",
      value: "PAID",
      count: initialCosts.filter((cost) => cost.status === "PAID").length,
    },
    {
      label: "Ditolak",
      value: "REJECTED",
      count: initialCosts.filter((cost) => cost.status === "REJECTED").length,
    },
  ];

  function handleVerifyClick(cost: ExpenseCostItem): void {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const res = await verifyFieldRequest(cost.id);
        if (!res.success) {
          const errMsg = res.error.message || "Gagal memverifikasi pengajuan.";
          setError(errMsg);
          toast.error(errMsg);
          return;
        }

        const successMsg = `Pengajuan Rp ${Number(cost.amount).toLocaleString("id-ID")} berhasil diverifikasi.`;
        setSuccess(successMsg);
        toast.success(successMsg);
        router.refresh();
      } catch (err: unknown) {
        const errMsg = getErrorMessage(err, "Terjadi kesalahan internal.");
        setError(errMsg);
        toast.error(errMsg);
      }
    });
  }

  function handleDisburseClick(cost: ExpenseCostItem): void {
    setSelectedCost(cost);
    setError(null);
    setSuccess(null);
    if (disbursementRecovery.isDirty && disbursementRecovery.payload.costId === cost.id) return;
    disbursementRecovery.reset({
      costId: cost.id,
      selectedBankId: bankAccounts[0]?.id ?? "",
      refNumber: "",
    });
  }

  function handleConfirmDisburse(): void {
    if (!selectedCost) return;
    if (!selectedBankId) {
      const message = "Silakan pilih rekening bank pengirim.";
      setError(message);
      toast.error(message);
      return;
    }
    if (!refNumber.trim()) {
      const message = "Nomor referensi bukti transfer wajib diisi.";
      setError(message);
      toast.error(message);
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const res = await payFieldRequest(selectedCost.id, selectedBankId, refNumber);
        if (!res.success) {
          const errMsg = res.error.message || "Gagal mencairkan pengeluaran.";
          setError(errMsg);
          toast.error(errMsg);
          return;
        }

        const successMsg = `Berhasil mencairkan dana sebesar Rp ${Number(selectedCost.amount).toLocaleString("id-ID")}`;
        toast.success(successMsg);
        router.refresh();
        const account = bankAccounts.find((item) => item.id === selectedBankId);
        setOperationSuccess({
          title: "Dana pengeluaran dicairkan",
          description:
            "Status pengeluaran, saldo rekening, ledger, dan budget proyek telah diperbarui bersama.",
          facts: [
            { label: "Proyek", value: selectedCost.project?.name ?? "Proyek" },
            {
              label: "Nominal",
              value: `Rp ${Number(selectedCost.amount).toLocaleString("id-ID")}`,
            },
            { label: "Rekening", value: account?.name ?? "Rekening sumber" },
          ],
        });
        disbursementRecovery.clear();
        closeDisburseForm();
      } catch (err: unknown) {
        const errMsg = getErrorMessage(err, "Terjadi kesalahan internal.");
        setError(errMsg);
        toast.error(errMsg);
      }
    });
  }

  return (
    <div className="space-y-sm px-1 pb-8 max-[430px]:-mx-1 max-[430px]:pb-6">
      {!projectId && (
        <FinanceInboxHeader activeClaimTotal={activeClaimTotal} fieldClaimTotal={fieldClaimTotal} />
      )}

      <SegmentedTabs
        value={displayedTab}
        onChange={selectTab}
        ariaLabel="Tampilan kas dan tagihan"
        density="compact"
        options={[
          {
            value: "FIELD_CLAIMS",
            label: "Pengeluaran Lapangan",
            icon: <AppIcon name="receipt_long" className="icon-sm" />,
          },
          {
            value: "VENDOR_BILLS",
            label: "Tagihan Vendor",
            icon: <AppIcon name="request_quote" className="icon-sm" />,
          },
        ]}
      />

      {displayedTab === "FIELD_CLAIMS" ? (
        <FieldClaimsPanel
          leadingContent={
            <>
              {can("decide:all_approvals") && pendingApprovalsCount > 0 ? (
                <PendingApprovalsBanner count={pendingApprovalsCount} />
              ) : null}
              <ExpenseDraftsPanel projectId={projectId} />
            </>
          }
          projectId={projectId}
          initialCosts={initialCosts}
          filteredCosts={filteredCosts}
          filter={filter}
          filterTabs={filterTabs}
          needsActionCount={needsActionCount}
          readyToPayCount={readyToPayCount}
          activeClaimTotal={activeClaimTotal}
          isOwnerOrFinance={isOwnerOrFinance}
          pending={isPending}
          historyExpanded={isHistoryExpanded}
          onFilterChange={setFilter}
          onHistoryExpandedChange={setIsHistoryExpanded}
          onOpenExpenseDrawer={openExpenseDrawer}
          onVerify={handleVerifyClick}
          onDisburse={handleDisburseClick}
          onOpenReceipt={setActiveImage}
        />
      ) : (
        <VendorBillList
          leadingContent={
            can("decide:all_approvals") && pendingApprovalsCount > 0 ? (
              <PendingApprovalsBanner count={pendingApprovalsCount} />
            ) : null
          }
          projectId={projectId}
          vendorBills={vendorBills}
          vendorPayments={vendorPayments}
          vendorPaymentApprovalThreshold={vendorPaymentApprovalThreshold}
          vendors={vendors}
          projects={projects}
          bankAccounts={bankAccounts}
        />
      )}

      <ReceiptImageLightbox imageUrl={activeImage} onClose={() => setActiveImage(null)} />
      <FieldDisbursementSheet
        key={selectedCost?.id ?? "field-disbursement-closed"}
        selectedCost={selectedCost}
        bankAccounts={bankAccounts}
        selectedBankId={selectedBankId}
        refNumber={refNumber}
        isDirty={disbursementRecovery.isDirty}
        pending={isPending}
        error={error}
        success={success}
        onClose={closeDisburseForm}
        onDiscard={() => {
          disbursementRecovery.reset();
          closeDisburseForm();
        }}
        onSubmit={handleConfirmDisburse}
        onBankChange={(value: string) =>
          disbursementRecovery.setPayload((current) => ({ ...current, selectedBankId: value }))
        }
        onRefNumberChange={(value: string) =>
          disbursementRecovery.setPayload((current) => ({ ...current, refNumber: value }))
        }
      />
      <OperationSuccessDialog
        success={operationSuccess}
        onClose={() => setOperationSuccess(null)}
      />
    </div>
  );
}
