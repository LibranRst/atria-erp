"use client";

import { useCan } from "@/components/auth/permissions-provider";
import React from "react";

import { OperationSuccessDialog } from "@/components/ui";
import {
  VendorDisbursePaymentSheet,
  VendorSchedulePaymentSheet,
} from "@/features/expenses/components/sheets/vendor-payment-sheets";
import { useVendorPaymentOperations } from "@/features/expenses/hooks/use-vendor-payment-operations";
import type {
  VendorListBankAccount,
  VendorListBill,
  VendorListPayment,
  VendorListProject,
  VendorListVendor,
} from "@atria/core/types/expenses";
import { updateUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { VendorBillListContent } from "./vendor-bill-list-content";

export type {
  VendorListBankAccount,
  VendorListBill,
  VendorListBudgetItem,
  VendorListPayment,
  VendorListProject,
  VendorListVendor,
} from "@atria/core/types/expenses";

interface VendorBillListProps {
  readonly leadingContent?: React.ReactNode;
  readonly onWorkflowActiveChange?: (active: boolean) => void;
  readonly projectId?: string;
  readonly vendorBills: VendorListBill[];
  readonly vendorPayments: VendorListPayment[];
  readonly vendors: VendorListVendor[];
  readonly projects: VendorListProject[];
  readonly bankAccounts: VendorListBankAccount[];
  readonly vendorPaymentApprovalThreshold: number;
}

export function VendorBillList({
  leadingContent,
  onWorkflowActiveChange,
  projectId,
  vendorBills,
  vendorPayments,
  bankAccounts,
  vendorPaymentApprovalThreshold,
}: VendorBillListProps): React.JSX.Element {
  const can = useCan();
  const operations = useVendorPaymentOperations({
    projectId,
    bankAccounts,
    ownerApprovalThreshold: vendorPaymentApprovalThreshold,
  });
  const workflowActive =
    operations.pending ||
    Boolean(operations.selectedBill || operations.selectedPayment || operations.success);
  React.useEffect((): void => {
    onWorkflowActiveChange?.(workflowActive);
  }, [onWorkflowActiveChange, workflowActive]);
  React.useEffect(
    () => (): void => {
      onWorkflowActiveChange?.(false);
    },
    [onWorkflowActiveChange],
  );
  const isOwnerOrFinance = can("view:bank_account");
  const canCreateVendorBill = can("create:vendor_bill");

  return (
    <div className="space-y-sm">
      <VendorBillListContent
        leadingContent={leadingContent}
        projectId={projectId}
        vendorBills={vendorBills}
        vendorPayments={vendorPayments}
        canCreateVendorBill={canCreateVendorBill}
        isOwnerOrFinance={isOwnerOrFinance}
        canPayVendorBill={can("pay:vendor_bill")}
        onAddBill={() => updateUrlSearchParam("new-vendor-bill", "true", "push")}
        onSchedule={operations.openSchedule}
        onDisburse={operations.openDisburse}
        pending={operations.pending}
      />

      <VendorSchedulePaymentSheet
        bill={operations.selectedBill}
        bankAccounts={bankAccounts}
        ownerApprovalThreshold={vendorPaymentApprovalThreshold}
        isPending={operations.pending}
        error={operations.error}
        selectedBankId={operations.selectedBankId}
        scheduleAmount={operations.scheduleAmount}
        scheduleDate={operations.scheduleDate}
        isDirty={operations.scheduleIsDirty}
        onClose={operations.closeSchedule}
        onDiscard={operations.discardSchedule}
        onSubmit={operations.submitSchedule}
        onSelectedBankIdChange={operations.setSelectedBankId}
        onScheduleAmountChange={operations.setScheduleAmount}
        onScheduleDateChange={operations.setScheduleDate}
      />

      <VendorDisbursePaymentSheet
        payment={operations.selectedPayment}
        bankAccounts={bankAccounts}
        isPending={operations.pending}
        error={operations.error}
        disburseBankId={operations.disburseBankId}
        refNumber={operations.refNumber}
        isDirty={operations.disburseIsDirty}
        onClose={operations.closeDisburse}
        onDiscard={operations.discardDisburse}
        onSubmit={operations.submitDisburse}
        onDisburseBankIdChange={operations.setDisburseBankId}
        onRefNumberChange={operations.setRefNumber}
      />

      <OperationSuccessDialog success={operations.success} onClose={operations.clearSuccess} />
    </div>
  );
}
