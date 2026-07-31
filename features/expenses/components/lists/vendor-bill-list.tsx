"use client";

import React from "react";

import { FinanceSuccessSheet } from "@/features/finance-dashboard/components/shared/finance-form-patterns";
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
} from "@/features/expenses/types/vendor-bill-list-types";
import { updateUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { VendorBillListContent } from "./vendor-bill-list-content";

export type {
  VendorListBankAccount,
  VendorListBill,
  VendorListBudgetItem,
  VendorListPayment,
  VendorListProject,
  VendorListVendor,
} from "@/features/expenses/types/vendor-bill-list-types";

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
  const operations = useVendorPaymentOperations({ projectId, bankAccounts });
  const isOwnerOrFinance = userRole === "OWNER" || userRole === "FINANCE_ADMIN";
  const canCreateVendorBill =
    isOwnerOrFinance || userRole === "PROJECT_MANAGER" || userRole === "PURCHASING";

  return (
    <div className="space-y-sm">
      <VendorBillListContent
        leadingContent={leadingContent}
        projectId={projectId}
        vendorBills={vendorBills}
        vendorPayments={vendorPayments}
        canCreateVendorBill={canCreateVendorBill}
        isOwnerOrFinance={isOwnerOrFinance}
        onAddBill={() => updateUrlSearchParam("new-vendor-bill", "true", "push")}
        onSchedule={operations.openSchedule}
        onDisburse={operations.openDisburse}
      />

      <VendorSchedulePaymentSheet
        key={operations.selectedBill?.id ?? "vendor-schedule-closed"}
        bill={operations.selectedBill}
        bankAccounts={bankAccounts}
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
        key={operations.selectedPayment?.id ?? "vendor-disburse-closed"}
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

      <FinanceSuccessSheet success={operations.success} onClose={operations.clearSuccess} />
    </div>
  );
}
