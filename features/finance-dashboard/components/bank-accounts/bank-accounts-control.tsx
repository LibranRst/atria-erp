"use client";

import React from "react";

import type { FinanceDashboardOverview } from "@/app/actions/finance/dashboard-overview";
import { FinanceSuccessSheet } from "@/features/finance-dashboard/components/shared/finance-form-patterns";
import { useBankAccountsControl } from "@/features/finance-dashboard/hooks/use-bank-accounts-control";
import type { BankAccount } from "@/features/finance-dashboard/types/bank-account-types";
import { AccountDetailSheet } from "./account-detail-sheet";
import { AccountFormSheet } from "./account-form-sheet";
import { BankAccountsOverview } from "./bank-accounts-overview";
import { MovementSheet } from "./movement-sheet";
import { TransferSheet } from "./transfer-sheet";

export function BankAccountsControl({
  accounts,
  role,
  variant,
  payablesDueSoon = 0,
}: {
  readonly accounts: readonly BankAccount[];
  readonly role: FinanceDashboardOverview["role"];
  readonly variant: "preview" | "tab";
  readonly payablesDueSoon?: number;
}): React.JSX.Element {
  const control = useBankAccountsControl({ accounts, role, payablesDueSoon });

  return (
    <>
      <BankAccountsOverview
        accounts={control.items}
        variant={variant}
        canCreate={control.canCreate}
        totalCash={control.totalCash}
        activeAccounts={control.activeAccounts}
        unreconciledCount={control.unreconciledCount}
        coverage={control.coverage}
        onCreate={control.openCreate}
        onSelect={control.openDetail}
      />

      <AccountDetailSheet
        open={control.sheet === "detail"}
        account={control.selected}
        canArchive={control.canArchive}
        canTransfer={control.transferOptions.length > 0}
        pending={control.pending}
        onClose={control.closeSheet}
        onDebit={(account) => control.openMovement(account, "INFLOW")}
        onCredit={(account) => control.openMovement(account, "OUTFLOW")}
        onTransfer={control.openTransfer}
        onEdit={control.openEdit}
        onToggleActive={control.toggleActive}
      />

      <AccountFormSheet
        open={control.sheet === "create" || control.sheet === "edit"}
        title={control.sheet === "create" ? "Tambah rekening" : "Edit rekening"}
        draft={control.accountDraft}
        setDraft={control.setAccountDraft}
        isDirty={control.accountIsDirty}
        pending={control.pending}
        canEditStatus={control.canArchive && control.sheet === "edit"}
        onClose={control.closeSheet}
        onDiscard={control.discardAccount}
        onSave={control.saveAccount}
      />

      <MovementSheet
        key={`movement-${control.sheet ?? "closed"}-${control.selected?.id ?? "none"}`}
        open={control.sheet === "movement" && control.selected !== null}
        account={control.selected}
        draft={control.movementDraft}
        setDraft={control.setMovementDraft}
        isDirty={control.movementIsDirty}
        pending={control.pending}
        onClose={control.closeSheet}
        onDiscard={control.discardMovement}
        onSave={control.saveMovement}
      />

      <TransferSheet
        key={`transfer-${control.sheet ?? "closed"}-${control.selected?.id ?? "none"}`}
        open={control.sheet === "transfer" && control.selected !== null}
        account={control.selected}
        accounts={control.items}
        options={control.transferOptions}
        draft={control.transferDraft}
        setDraft={control.setTransferDraft}
        isDirty={control.transferIsDirty}
        pending={control.pending}
        onClose={control.closeSheet}
        onDiscard={control.discardTransfer}
        onSave={control.saveTransfer}
      />

      <FinanceSuccessSheet success={control.success} onClose={control.clearSuccess} />
    </>
  );
}
