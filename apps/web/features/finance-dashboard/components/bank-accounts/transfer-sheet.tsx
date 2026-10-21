import React from "react";

import {
  DatePickerField,
  FinanceUnsavedChangesModal,
  FormField,
  FormRiskNotice,
  FormSection,
  FactRow,
  GroupedSurface,
  MoneyValue,
  MoneyImpactRow,
  MoneyInput,
  type SelectOption,
  AdaptiveSelect,
  Textarea,
  TextInput,
  useSheetPresenceValue,
  WorkflowFormSheet,
} from "@/components/ui";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { shortMoney } from "@/features/finance-dashboard/utils/dashboard-formatters";
import { BankAccountContextCard } from "./bank-account-context-card";
import type {
  BankAccount,
  TransferDraft,
} from "@/features/finance-dashboard/types/bank-account-types";

export function TransferSheet({
  open,
  account,
  accounts,
  options,
  draft,
  setDraft,
  isDirty,
  pending,
  onClose,
  onDiscard,
  onSave,
}: {
  readonly open: boolean;
  readonly account: BankAccount | null;
  readonly accounts: readonly BankAccount[];
  readonly options: readonly SelectOption[];
  readonly draft: TransferDraft;
  readonly setDraft: React.Dispatch<React.SetStateAction<TransferDraft>>;
  readonly isDirty: boolean;
  readonly pending: boolean;
  readonly onClose: () => void;
  readonly onDiscard: () => void;
  readonly onSave: () => void;
}): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  const { presentedValue: presentedAccount, handleExitComplete } = useSheetPresenceValue(
    open ? account : null,
    open ? account?.id : null,
  );
  const [reviewing, setReviewing] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);
  const [prevOpen, setPrevOpen] = React.useState(open);
  const [prevAccountId, setPrevAccountId] = React.useState(account?.id);

  if (open !== prevOpen || account?.id !== prevAccountId) {
    setPrevOpen(open);
    setPrevAccountId(account?.id);
    if (open && (!prevOpen || account?.id !== prevAccountId)) {
      setReviewing(false);
      setConfirmClose(false);
    }
  }

  const handleExitAnimationComplete = React.useCallback((): void => {
    handleExitComplete();
    setReviewing(false);
    setConfirmClose(false);
  }, [handleExitComplete]);

  function patch(next: Partial<TransferDraft>): void {
    setDraft((current) => ({ ...current, ...next }));
  }

  const canSave =
    Boolean(draft.toBankAccountId) &&
    Number(draft.amount || 0) > 0 &&
    draft.description.trim().length >= 5;
  const amount = Number(draft.amount || 0);
  const projectedSourceBalance = presentedAccount ? presentedAccount.balance - amount : 0;
  const selectedTarget = options.find((option) => option.value === draft.toBankAccountId);
  const targetBefore = accounts.find((item) => item.id === draft.toBankAccountId)?.balance ?? 0;
  const disabledReason = !draft.toBankAccountId
    ? "Pilih rekening tujuan."
    : amount <= 0
      ? "Isi nominal transfer lebih dari 0."
      : draft.description.trim().length < 5
        ? "Tambahkan deskripsi minimal 5 karakter agar transfer mudah diaudit."
        : undefined;
  function requestClose(): void {
    if (reviewing) {
      setReviewing(false);
      return;
    }
    if (isDirty) {
      setConfirmClose(true);
      return;
    }
    onClose();
  }

  return (
    <>
      <WorkflowFormSheet
        dismissal={{ mode: "managed" }}
        desktopSize="wide"
        desktopFooterPlacement="aside"
        desktopAsideSummary={
          <GroupedSurface>
            <div className="divide-y divide-ring-subtle">
              <FactRow
                layout="stacked"
                label="Dari"
                wrapLabel
                value={presentedAccount?.name ?? "Data tidak tersedia"}
              />
              <FactRow
                layout="stacked"
                label="Ke"
                wrapLabel
                value={
                  selectedTarget?.label ??
                  (draft.toBankAccountId ? "Data tidak tersedia" : "Belum dipilih")
                }
              />
              <FactRow
                layout="stacked"
                label="Nominal transfer"
                wrapLabel
                value={
                  <MoneyValue
                    fractionDigits={Number.isInteger(amount) ? 0 : 2}
                    variant="fullDynamic"
                    amount={amount}
                  />
                }
              />
              {presentedAccount ? (
                <>
                  <FactRow
                    layout="stacked"
                    label="Saldo sumber saat ini"
                    wrapLabel
                    value={
                      <MoneyValue
                        fractionDigits={Number.isInteger(presentedAccount.balance) ? 0 : 2}
                        variant="fullDynamic"
                        amount={presentedAccount.balance}
                      />
                    }
                  />
                  <FactRow
                    layout="stacked"
                    label="Saldo sumber pratinjau"
                    wrapLabel
                    value={
                      <MoneyValue
                        fractionDigits={Number.isInteger(projectedSourceBalance) ? 0 : 2}
                        variant="fullDynamic"
                        amount={projectedSourceBalance}
                        tone={projectedSourceBalance < 0 ? "danger" : "default"}
                      />
                    }
                  />
                </>
              ) : null}
              <p className="px-4 py-3 text-support text-on-surface-variant">
                Transfer antar-rekening mencatat dua sisi ledger. Jumlah kas keseluruhan tetap.
              </p>
            </div>
          </GroupedSurface>
        }
        open={open}
        title={reviewing ? "Tinjau transfer rekening" : "Transfer rekening"}
        onClose={requestClose}
        onExitComplete={handleExitAnimationComplete}
        pending={pending}
        disabledReason={disabledReason}
        primaryLabel={reviewing ? "Transfer" : "Tinjau"}
        secondaryLabel={reviewing ? "Ubah" : undefined}
        pendingLabel="Mencatat…"
        disabled={pending || !canSave || projectedSourceBalance < 0}
        statusText={
          projectedSourceBalance < 0 ? "Saldo rekening sumber tidak mencukupi." : undefined
        }
        statusTone={projectedSourceBalance < 0 ? "danger" : "default"}
        onPrimary={() => (reviewing ? onSave() : setReviewing(true))}
        onSecondary={() => setReviewing(false)}
      >
        <div className="space-y-md">
          {!desktop && presentedAccount ? (
            <BankAccountContextCard account={presentedAccount} eyebrow="Rekening Sumber" />
          ) : null}
          {reviewing ? (
            <>
              <MoneyImpactRow
                label={`Sumber · ${presentedAccount?.name ?? "Rekening"}`}
                before={presentedAccount?.balance ?? 0}
                delta={-amount}
                after={projectedSourceBalance}
              />
              <MoneyImpactRow
                label={`Tujuan · ${selectedTarget?.label ?? "Rekening"}`}
                before={targetBefore}
                delta={amount}
                after={targetBefore + amount}
              />
              <FormSection
                title="Referensi transfer"
                helper="Sistem mencatat dua baris ledger berpasangan."
              >
                <div className="flex items-start justify-between gap-4 px-4 py-3 text-xs">
                  <span className="shrink-0 text-on-surface-variant">Tanggal</span>
                  <span className="text-right font-bold text-on-surface">
                    {draft.transactionDate
                      ? new Date(draft.transactionDate).toLocaleDateString("id-ID", {
                          dateStyle: "long",
                        })
                      : "–"}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4 px-4 py-3 text-xs">
                  <span className="shrink-0 text-on-surface-variant">Nomor referensi</span>
                  <span className="text-right font-bold text-on-surface">
                    {draft.referenceNumber || "Tanpa nomor referensi"}
                  </span>
                </div>
                {draft.description ? (
                  <div className="flex items-start justify-between gap-4 px-4 py-3 text-xs">
                    <span className="shrink-0 text-on-surface-variant">Keterangan</span>
                    <span className="text-right font-medium text-on-surface">
                      {draft.description}
                    </span>
                  </div>
                ) : null}
              </FormSection>
            </>
          ) : (
            <>
              {amount > 0 ? (
                <FormRiskNotice
                  title="Cegah transfer salah rekening"
                  tone={projectedSourceBalance < 0 ? "danger" : "warning"}
                >
                  Pastikan rekening tujuan dan nominal sudah sesuai agar saldo sumber tidak
                  terkoreksi manual setelah dicatat.
                </FormRiskNotice>
              ) : null}
              <FormSection
                title="Tujuan & nominal"
                helper={
                  projectedSourceBalance < 0
                    ? `Peringatan: Saldo sumber minus (${shortMoney(projectedSourceBalance)})`
                    : selectedTarget
                      ? `Tujuan: ${selectedTarget.label} · Saldo sumber: ${shortMoney(presentedAccount?.balance ?? 0)} → ${shortMoney(projectedSourceBalance)}`
                      : "Pilih rekening tujuan dan nominal transfer."
                }
              >
                <AdaptiveSelect
                  label="Ke rekening"
                  value={draft.toBankAccountId}
                  onChange={(value) => patch({ toBankAccountId: value })}
                  options={options}
                />
                <FormField label="Nominal" required>
                  <MoneyInput value={draft.amount} onChange={(value) => patch({ amount: value })} />
                </FormField>
              </FormSection>
              <FormSection
                title="Referensi audit"
                helper="Tanggal, referensi, dan deskripsi untuk rekonsiliasi."
              >
                <DatePickerField
                  label="Tanggal"
                  value={draft.transactionDate}
                  onChange={(value) => patch({ transactionDate: value })}
                />
                <FormField label="Nomor referensi" optional>
                  <TextInput
                    value={draft.referenceNumber}
                    onChange={(value) => patch({ referenceNumber: value })}
                    placeholder="Opsional"
                  />
                </FormField>
                <FormField label="Deskripsi">
                  <Textarea
                    value={draft.description}
                    onChange={(value) => patch({ description: value })}
                    placeholder="Contoh: transfer kas kecil PM Budi"
                  />
                </FormField>
              </FormSection>
            </>
          )}
        </div>
      </WorkflowFormSheet>
      <FinanceUnsavedChangesModal
        open={confirmClose}
        onKeep={() => {
          setConfirmClose(false);
          onClose();
        }}
        onDiscard={() => {
          setConfirmClose(false);
          onDiscard();
        }}
        onContinue={() => setConfirmClose(false)}
      />
    </>
  );
}
