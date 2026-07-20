"use client";

import React from "react";
import { toast } from "sonner";

import {
  createBankAccount,
  updateBankAccount,
} from "@/app/actions/finance/bank-accounts";
import type { OwnerOnboardingBankAccount } from "@/app/actions/onboarding";
import { MoneyValue } from "@/components/ui/page-primitives";
import { AccountFormSheet } from "@/features/finance-dashboard/components/bank-accounts/account-form-sheet";
import type { AccountDraft } from "@/features/finance-dashboard/components/bank-accounts/types";
import {
  accountToDraft,
  newAccountDraft,
} from "@/features/finance-dashboard/components/bank-accounts/utils";
import { SettingsStatusLabel } from "@/features/settings/components/settings-primitives";
import {
  OnboardingEmpty,
  OnboardingNotice,
  OnboardingStage,
  OnboardingSurface,
  OnboardingToolbar,
} from "./onboarding-primitives";

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
  const [baseline, setBaseline] =
    React.useState<AccountDraft>(newAccountDraft());
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
            detail="Satu rekening aktif sudah cukup untuk memulai workflow kas."
          />
        ) : (
          <div className="divide-y divide-black/[0.055]">
            {accounts.map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => edit(account)}
                className="flex min-h-[70px] w-full items-center gap-3 px-4 py-3 text-left outline-none active:bg-surface-container-low focus-visible:bg-surface-container-low"
              >
                <span
                  className="material-symbols-outlined !flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-surface-container-low text-[18px] text-on-surface-variant"
                  aria-hidden="true"
                >
                  account_balance
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] leading-5 font-bold text-on-surface">
                    {account.name}
                  </span>
                  <span className="block truncate text-[9px] leading-4 text-on-surface-variant">
                    {account.bankName} · {account.accountNumber}
                  </span>
                  {!account.isActive ? (
                    <SettingsStatusLabel
                      label="Diarsipkan"
                      tone="inactive"
                      className="mt-1"
                    />
                  ) : null}
                </span>
                <MoneyValue
                  amount={account.balance}
                  variant="compactWithFull"
                  size="sm"
                  align="right"
                />
                <span
                  className="material-symbols-outlined shrink-0 text-[17px] text-on-surface-variant/55"
                  aria-hidden="true"
                >
                  chevron_right
                </span>
              </button>
            ))}
          </div>
        )}
      </OnboardingSurface>
      <OnboardingNotice icon="shield" tone="positive">
        Transfer, rekonsiliasi, dan mutasi manual sengaja tidak ditampilkan
        selama setup.
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
