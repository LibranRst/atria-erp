import React from "react";

import {
  DatePickerField,
  FinanceUnsavedChangesModal,
  FormField,
  FormRiskNotice,
  FormSection,
  MoneyImpactRow,
  MoneyInput,
  AdaptiveSelect,
  SegmentedTabs,
  Textarea,
  TextInput,
  useSheetPresenceValue,
  WorkflowFormSheet,
} from "@/components/ui";
import { shortMoney } from "@/features/finance-dashboard/utils/dashboard-formatters";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { movementCategoryOptions } from "@/features/finance-dashboard/utils/bank-account-constants";
import { BankAccountContextCard } from "./bank-account-context-card";
import type {
  BankAccount,
  CashMovementCategory,
  MovementDraft,
} from "@/features/finance-dashboard/types/bank-account-types";

function toMovementCategory(value: string): CashMovementCategory {
  const option = movementCategoryOptions.find((item) => item.value === value);
  return option?.value ?? "other";
}

export function MovementSheet({
  open,
  account,
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
  readonly draft: MovementDraft;
  readonly setDraft: React.Dispatch<React.SetStateAction<MovementDraft>>;
  readonly isDirty: boolean;
  readonly pending: boolean;
  readonly onClose: () => void;
  readonly onDiscard: () => void;
  readonly onSave: () => void;
}): React.JSX.Element {
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

  function patch(next: Partial<MovementDraft>): void {
    setDraft((current) => ({ ...current, ...next }));
  }

  const canSave = Number(draft.amount || 0) > 0 && draft.description.trim().length >= 5;
  const amount = Number(draft.amount || 0);
  const projectedBalance = presentedAccount
    ? draft.type === "INFLOW"
      ? presentedAccount.balance + amount
      : presentedAccount.balance - amount
    : 0;
  const disabledReason =
    Number(draft.amount || 0) <= 0
      ? "Isi nominal mutasi lebih dari 0."
      : draft.description.trim().length < 5
        ? "Tambahkan deskripsi minimal 5 karakter agar mutasi mudah diaudit."
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
        open={open}
        title={
          reviewing ? "Tinjau mutasi kas" : draft.type === "INFLOW" ? "Kas masuk" : "Kas keluar"
        }
        onClose={requestClose}
        onExitComplete={handleExitAnimationComplete}
        pending={pending}
        disabled={!canSave}
        disabledReason={disabledReason}
        primaryLabel={reviewing ? "Catat" : "Tinjau"}
        secondaryLabel={reviewing ? "Ubah" : undefined}
        pendingLabel="Mencatat…"
        danger={reviewing && draft.type === "OUTFLOW"}
        statusText={projectedBalance < 0 ? "Saldo sesudah mutasi tidak mencukupi." : undefined}
        statusTone={projectedBalance < 0 ? "danger" : "default"}
        onPrimary={() => (reviewing ? onSave() : setReviewing(true))}
        onSecondary={() => setReviewing(false)}
      >
        <div className="space-y-md">
          {presentedAccount ? (
            <BankAccountContextCard account={presentedAccount} eyebrow="Rekening" />
          ) : null}
          {reviewing ? (
            <>
              <MoneyImpactRow
                label={presentedAccount?.name ?? "Rekening"}
                before={presentedAccount?.balance ?? 0}
                delta={draft.type === "INFLOW" ? amount : -amount}
                after={projectedBalance}
              />
              <FormSection
                title="Yang akan dicatat"
                helper="Mutasi ini menambah baris ledger dan tidak mengubah transaksi lama."
              >
                <div className="flex items-start justify-between gap-4 px-4 py-3 text-xs">
                  <span className="shrink-0 text-on-surface-variant">Arah & kategori</span>
                  <span className="text-right font-bold text-on-surface">
                    {draft.type === "INFLOW" ? "Kas masuk" : "Kas keluar"} ·{" "}
                    {movementCategoryOptions.find((option) => option.value === draft.category)
                      ?.label ?? formatBusinessLabel(draft.category, "FINANCE")}
                  </span>
                </div>
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
              {draft.type === "OUTFLOW" && amount > 0 ? (
                <FormRiskNotice
                  title="Cegah saldo kas minus"
                  tone={projectedBalance < 0 ? "danger" : "warning"}
                >
                  Pastikan nominal keluar dan rekening sumber sudah benar sebelum mutasi mengubah
                  ledger.
                </FormRiskNotice>
              ) : null}
              <SegmentedTabs<"INFLOW" | "OUTFLOW">
                ariaLabel="Arah mutasi kas"
                value={draft.type}
                fillAvailableSpace
                options={[
                  { value: "INFLOW", label: "Kas masuk" },
                  { value: "OUTFLOW", label: "Kas keluar" },
                ]}
                onChange={(nextType) =>
                  patch({
                    type: nextType,
                    category: nextType === "INFLOW" ? "owner_capital" : "bank_fee",
                  })
                }
              />
              <FormSection
                title="Nominal mutasi"
                helper={
                  projectedBalance < 0
                    ? `Peringatan: Saldo menjadi minus (${shortMoney(projectedBalance)})`
                    : `Estimasi saldo: ${shortMoney(presentedAccount?.balance ?? 0)} → ${shortMoney(projectedBalance)}`
                }
              >
                <FormField label="Nominal" required>
                  <MoneyInput
                    value={draft.amount}
                    onChange={(value) => patch({ amount: value })}
                  />
                </FormField>
              </FormSection>
              <FormSection title="Klasifikasi" helper="Untuk rekonsiliasi dan audit.">
                <AdaptiveSelect
                  label="Kategori"
                  value={draft.category}
                  onChange={(value) => patch({ category: toMovementCategory(value) })}
                  options={movementCategoryOptions}
                />
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
                    placeholder="Contoh: koreksi saldo hasil cek mutasi bank"
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
