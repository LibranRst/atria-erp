"use client";

import { useCan } from "@/components/auth/permissions-provider";
import { useRouter } from "@/lib/navigation/workspace-navigation";

import React, { useState, useTransition } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  AppIcon,
  type OperationSuccess,
  OperationSuccessDialog,
  PageState,
  SegmentedTabs,
} from "@/components/ui";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { parseExpenseFilter, resolveExpenseView } from "../../utils/expense-route-view";
import { useLocalFormRecovery } from "@/lib/hooks/use-local-form-recovery";

const fieldDisbursementRecoverySchema = z.object({
  costId: z.string(),
  selectedBankId: z.string(),
  refNumber: z.string(),
});

import { payFieldRequest, verifyFieldRequest } from "@/app/actions/finance/field-requests";
import { deriveExpensePaymentReference } from "@atria/core/finance/invoice-prefill";
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

import type { ProjectExpensesSource } from "@atria/core/types/project-operations";

export type { BankAccountItem, ExpenseCostItem } from "@atria/core/types/expenses";

interface ExpenseListProps {
  readonly canViewFieldClaims?: boolean;
  readonly assignedScope?: boolean;
  readonly onWorkflowActiveChange?: (active: boolean) => void;
  readonly source?: ProjectExpensesSource;
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
  canViewFieldClaims,
  assignedScope = false,
  projectId,
  source,
  onWorkflowActiveChange,
  initialCosts: incomingCosts,
  bankAccounts,
  vendorBills: incomingBills = [],
  vendorPayments: incomingPayments = [],
  vendorPaymentApprovalThreshold,
  vendors = [],
  projects = [],
  pendingApprovalsCount = 0,
}: ExpenseListProps): React.JSX.Element {
  const can = useCan();
  const initialCosts = projectId
    ? incomingCosts.filter((cost) => cost.project?.id === projectId)
    : incomingCosts;
  const vendorBills = projectId
    ? incomingBills.filter((bill) => bill.projectId === projectId)
    : incomingBills;
  const vendorBillIds = new Set(vendorBills.map((bill) => bill.id));
  const vendorPayments = projectId
    ? incomingPayments.filter((payment) => vendorBillIds.has(payment.vendorBillId))
    : incomingPayments;
  const desktop = useWorkspacePresentation() === "desktop";
  const router = useRouter();
  const shouldOpenVendorBill = useUrlSearchParam("new-vendor-bill") === "true";
  const viewParam = useUrlSearchParam(projectId ? `project-${projectId}-expenses-view` : "view");
  const shouldShowVendorBills = viewParam === "vendor-bills";
  const filterParam = useUrlSearchParam(
    projectId ? `project-${projectId}-expenses-filter` : "filter",
  );
  const validFilter = parseExpenseFilter(filterParam);
  const shouldForceVendorBills = shouldOpenVendorBill || shouldShowVendorBills;
  const [activeTab, setActiveTab] = useState<ExpenseListTab>(
    shouldForceVendorBills ? "VENDOR_BILLS" : "FIELD_CLAIMS",
  );
  const fieldClaimsAvailable = canViewFieldClaims ?? can("view:cost");
  const vendorBillsAvailable = can("view:vendor_bill");
  const displayedTab = resolveExpenseView({
    vendorIntent: shouldForceVendorBills,
    fallback: activeTab,
    canViewFieldClaims: fieldClaimsAvailable,
    canViewVendorBills: vendorBillsAvailable,
  });
  const [filter, setFilter] = useState<FilterStatus>(validFilter);
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
  const [vendorWorkflowActive, setVendorWorkflowActive] = useState(false);
  const [draftWorkflowActive, setDraftWorkflowActive] = useState(false);
  const workflowActive =
    isPending ||
    Boolean(selectedCost || activeImage || operationSuccess) ||
    vendorWorkflowActive ||
    draftWorkflowActive;
  React.useEffect((): void => {
    onWorkflowActiveChange?.(workflowActive);
  }, [onWorkflowActiveChange, workflowActive]);
  React.useEffect(
    () => (): void => {
      onWorkflowActiveChange?.(false);
    },
    [onWorkflowActiveChange],
  );

  const selectTab = React.useCallback(
    (nextTab: ExpenseListTab): void => {
      setActiveTab(nextTab);
      updateUrlSearchParam(
        projectId ? `project-${projectId}-expenses-view` : "view",
        nextTab === "VENDOR_BILLS" ? "vendor-bills" : null,
        "replace",
      );
    },
    [projectId],
  );

  const handleFilterChange = React.useCallback(
    (nextFilter: FilterStatus): void => {
      setFilter(nextFilter);
      updateUrlSearchParam(
        projectId ? `project-${projectId}-expenses-filter` : "filter",
        nextFilter === "ALL" ? null : nextFilter,
        "replace",
      );
    },
    [projectId],
  );

  const [prevFilterParam, setPrevFilterParam] = useState(filterParam);
  if (filterParam !== prevFilterParam) {
    setPrevFilterParam(filterParam);
    setFilter(parseExpenseFilter(filterParam));
  }
  const [previousViewParam, setPreviousViewParam] = useState(viewParam);
  if (viewParam !== previousViewParam) {
    setPreviousViewParam(viewParam);
    setActiveTab(viewParam === "vendor-bills" ? "VENDOR_BILLS" : "FIELD_CLAIMS");
  }

  const openExpenseDrawer = React.useCallback((): void => {
    updateUrlSearchParam("expense-entry", null, "replace");
    updateUrlSearchParam("new-expense", "true", "push");
  }, []);

  const openReceiptDrawer = React.useCallback((): void => {
    updateUrlSearchParam("expense-entry", "receipt", "replace");
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

  const viewOptions: ReadonlyArray<{
    readonly value: ExpenseListTab;
    readonly label: string;
    readonly icon: React.ReactNode;
  }> = [
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
    const initialBank = bankAccounts[0];
    const initialSuggestedRef = deriveExpensePaymentReference({
      bankName: initialBank?.bankName || initialBank?.name,
      projectName: cost.project?.name,
      categoryCode:
        cost.budgetCategory?.expenseCategory?.code ||
        cost.budgetItem?.costCategory?.name ||
        cost.budgetItem?.name,
      costTitle: cost.description,
    });
    disbursementRecovery.reset({
      costId: cost.id,
      selectedBankId: initialBank?.id ?? "",
      refNumber: initialSuggestedRef,
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
    <div
      className={
        desktop
          ? "min-w-0 space-y-4 pb-8"
          : "space-y-sm px-1 pb-8 max-[430px]:-mx-1 max-[430px]:pb-6"
      }
    >
      {!projectId && (
        <FinanceInboxHeader
          activeClaimTotal={activeClaimTotal}
          fieldClaimTotal={fieldClaimTotal}
          assignedScope={assignedScope}
        />
      )}

      {displayedTab ? (
        <SegmentedTabs
          value={displayedTab}
          onChange={selectTab}
          ariaLabel="Tampilan kas dan tagihan"
          density="compact"
          options={viewOptions.filter((option) =>
            option.value === "FIELD_CLAIMS" ? fieldClaimsAvailable : vendorBillsAvailable,
          )}
        />
      ) : null}

      {projectId && assignedScope && desktop ? (
        <p className="px-1 text-support text-on-surface-variant">
          Pengeluaran lapangan menampilkan pengajuan Anda pada proyek ini. Tagihan mengikuti izin
          peran Anda.
        </p>
      ) : null}
      {displayedTab === null ? (
        <PageState
          kind="restricted"
          compact
          title="Pengeluaran tidak tersedia"
          description="Akses biaya lapangan atau tagihan vendor belum tersedia untuk peran Anda."
        />
      ) : null}
      {fieldClaimsAvailable ? (
        <div hidden={displayedTab !== "FIELD_CLAIMS"} inert={displayedTab !== "FIELD_CLAIMS"}>
          {source?.costs.status && source.costs.status !== "ready" ? (
            <PageState
              kind={source.costs.status === "restricted" ? "restricted" : "error"}
              compact
              title={
                source.costs.status === "restricted"
                  ? "Pengeluaran lapangan dibatasi"
                  : "Pengeluaran belum dapat dimuat"
              }
              description={source.costs.message ?? "Muat ulang halaman untuk mencoba kembali."}
            />
          ) : (
            <FieldClaimsPanel
              leadingContent={
                <>
                  {can("decide:all_approvals") && pendingApprovalsCount > 0 ? (
                    <PendingApprovalsBanner count={pendingApprovalsCount} />
                  ) : null}
                  {can("create:cost") ? (
                    <ExpenseDraftsPanel
                      projectId={projectId}
                      onWorkflowActiveChange={setDraftWorkflowActive}
                    />
                  ) : null}
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
              onFilterChange={handleFilterChange}
              onHistoryExpandedChange={setIsHistoryExpanded}
              onOpenExpenseDrawer={openExpenseDrawer}
              onScanReceipt={openReceiptDrawer}
              onVerify={handleVerifyClick}
              onDisburse={handleDisburseClick}
              onOpenReceipt={setActiveImage}
            />
          )}
        </div>
      ) : null}
      {vendorBillsAvailable ? (
        <div hidden={displayedTab !== "VENDOR_BILLS"} inert={displayedTab !== "VENDOR_BILLS"}>
          {source?.vendorBills.status && source.vendorBills.status !== "ready" ? (
            <PageState
              kind={source.vendorBills.status === "restricted" ? "restricted" : "error"}
              compact
              title={
                source.vendorBills.status === "restricted"
                  ? "Tagihan vendor dibatasi"
                  : "Tagihan belum dapat dimuat"
              }
              description={
                source.vendorBills.message ?? "Muat ulang halaman untuk mencoba kembali."
              }
            />
          ) : (
            <VendorBillList
              onWorkflowActiveChange={setVendorWorkflowActive}
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
        </div>
      ) : null}

      <ReceiptImageLightbox imageUrl={activeImage} onClose={() => setActiveImage(null)} />
      <FieldDisbursementSheet
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
        onBankChange={(value: string) => {
          const currentBankId = selectedBankId;
          const currentBank = bankAccounts.find((b) => b.id === currentBankId);
          const newBank = bankAccounts.find((b) => b.id === value);
          if (selectedCost) {
            const prevSuggested = deriveExpensePaymentReference({
              bankName: currentBank?.bankName || currentBank?.name,
              projectName: selectedCost.project?.name,
              categoryCode:
                selectedCost.budgetCategory?.expenseCategory?.code ||
                selectedCost.budgetItem?.costCategory?.name ||
                selectedCost.budgetItem?.name,
              costTitle: selectedCost.description,
            });
            const nextSuggested = deriveExpensePaymentReference({
              bankName: newBank?.bankName || newBank?.name,
              projectName: selectedCost.project?.name,
              categoryCode:
                selectedCost.budgetCategory?.expenseCategory?.code ||
                selectedCost.budgetItem?.costCategory?.name ||
                selectedCost.budgetItem?.name,
              costTitle: selectedCost.description,
            });
            if (!refNumber.trim() || refNumber === prevSuggested) {
              disbursementRecovery.setPayload((current) => ({
                ...current,
                selectedBankId: value,
                refNumber: nextSuggested,
              }));
              return;
            }
          }
          disbursementRecovery.setPayload((current) => ({ ...current, selectedBankId: value }));
        }}
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
