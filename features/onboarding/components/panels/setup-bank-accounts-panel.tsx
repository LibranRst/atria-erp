"use client";

import React from "react";
import { toast } from "sonner";

import { createBankAccount, updateBankAccount } from "@/app/actions/finance/bank-accounts";
import type { OwnerOnboardingBankAccount } from "@/app/actions/onboarding";
import { AppIcon, MoneyValue, WorkspaceStatusLabel } from "@/components/ui";
import { AccountFormSheet } from "@/features/finance-dashboard/components/bank-accounts/account-form-sheet";
import type { AccountDraft } from "@/features/finance-dashboard/types/bank-account-types";
import {
  accountToDraft,
  newAccountDraft,
} from "@/features/finance-dashboard/utils/bank-account-utils";
import {
  OnboardingEmpty,
  OnboardingNotice,
  OnboardingStage,
  OnboardingSurface,
  OnboardingToolbar,
} from "../shared/onboarding-primitives";

export function SetupBankAccountsPanel({
  initialAccounts,
  onMutationComplete,
}: {
  readonly initialAccounts: readonly OwnerOnboardingBankAccount[];
  readonly onMutationComplete: () => void;
}): React.JSX.Element {
  const [accounts, setAccounts] = React.useState(initialAccounts);
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<AccountDraft>(newAccountDraft());
  const [baseline, setBaseline] = React.useState<AccountDraft>(newAccountDraft());
  const [pending, setPending] = React.useState(false);

  function create(): void {
    const next = newAccountDraft();
    setDraft(next);
    setBaseline(next);
    setOpen(true);
  }

  function edit(account: OwnerOnboardingBankAccount): void {
    const next = accountToDraft(account);
    setDraft(next);
    setBaseline(next);
    setOpen(true);
  }

  async function save(): Promise<void> {
    setPending(true);
    const result = draft.id
      ? await updateBankAccount({
          bankAccountId: draft.id,
          name: draft.name,
          bankName: draft.bankName,
          accountNumber: draft.accountNumber,
          holderName: draft.holderName,
          cardColorFrom: draft.cardColorFrom,
          cardColorTo: draft.cardColorTo,
          cardTextColor: draft.cardTextColor,
          isActive: draft.isActive,
        })
      : await createBankAccount({
          name: draft.name,
          bankName: draft.bankName,
          accountNumber: draft.accountNumber,
          holderName: draft.holderName,
          openingBalance: Number(draft.openingBalance || 0),
          openingNote: `Saldo awal ${draft.name}`,
          cardColorFrom: draft.cardColorFrom,
          cardColorTo: draft.cardColorTo,
          cardTextColor: draft.cardTextColor,
        });
    setPending(false);
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    const saved: OwnerOnboardingBankAccount = {
      id: result.data.id,
      name: result.data.name,
      bankName: result.data.bankName,
      accountNumber: result.data.accountNumber,
      holderName: result.data.holderName,
      balance: result.data.balanceNumber,
      cardColorFrom: result.data.cardColorFrom,
      cardColorTo: result.data.cardColorTo,
      cardTextColor: result.data.cardTextColor === "dark" ? "dark" : "light",
      isActive: result.data.isActive,
      recentTransactions: [],
    };
    setAccounts((current) =>
      current.some((row) => row.id === saved.id)
        ? current.map((row) => (row.id === saved.id ? saved : row))
        : [saved, ...current],
    );
    setOpen(false);
    setDraft(newAccountDraft());
    setBaseline(newAccountDraft());
    toast.success(draft.id ? "Rekening diperbarui." : "Rekening ditambahkan.");
    onMutationComplete();
  }

  return (
    <OnboardingStage>
      <OnboardingToolbar
        title="Rekening"
        detail="Saldo awal hanya dapat dicatat saat rekening dibuat."
        actionLabel="Tambah"
        onAction={create}
      />
      <OnboardingSurface>
        {accounts.length === 0 ? (
          <OnboardingEmpty
            icon="account_balance"
            title="Belum ada rekening"
            detail="Satu rekening aktif sudah cukup untuk memulai alur kas."
          />
        ) : (
          <div className="divide-y divide-black/5.5">
            {accounts.map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => edit(account)}
                className="flex min-h-17.5 w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low"
              >
                <AppIcon
                  name="account_balance"
                  className="flex! icon-md h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-surface-container-low text-on-surface-variant"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] leading-5 font-bold text-on-surface">
                    {account.name}
                  </span>
                  <span className="block truncate text-[9px] leading-4 text-on-surface-variant">
                    {account.bankName} · {account.accountNumber}
                  </span>
                  {!account.isActive ? (
                    <WorkspaceStatusLabel label="Diarsipkan" tone="inactive" className="mt-1" />
                  ) : null}
                </span>
                <MoneyValue
                  amount={account.balance}
                  variant="compact"
                  size="sm"
                  align="right"
                />
                <AppIcon
                  name="chevron_right"
                  className="shrink-0 text-[17px] text-on-surface-variant/55"
                />
              </button>
            ))}
          </div>
        )}
      </OnboardingSurface>
      <OnboardingNotice icon="shield" tone="positive">
        Transfer, rekonsiliasi, dan mutasi manual sengaja tidak ditampilkan selama setup.
      </OnboardingNotice>
      <AccountFormSheet
        open={open}
        title={draft.id ? "Edit rekening" : "Tambah rekening"}
        draft={draft}
        setDraft={setDraft}
        isDirty={JSON.stringify(draft) !== JSON.stringify(baseline)}
        pending={pending}
        canEditStatus
        onClose={() => setOpen(false)}
        onDiscard={() => {
          setOpen(false);
          setDraft(newAccountDraft());
        }}
        onSave={() => void save()}
      />
    </OnboardingStage>
  );
}
