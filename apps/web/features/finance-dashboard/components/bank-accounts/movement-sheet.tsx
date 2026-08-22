import React from "react";

import {
  DatePickerField,
  FieldContextLine,
  FinanceUnsavedChangesModal,
  FormField,
  FormRiskNotice,
  FormSection,
  MoneyImpactRow,
  MoneyInput,
  AdaptiveSelect,
  Textarea,
  TextInput,
  WorkflowFormSheet,
} from "@/components/ui";
import { shortMoney } from "@/features/finance-dashboard/utils/dashboard-formatters";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { movementCategoryOptions } from "@/features/finance-dashboard/utils/bank-account-constants";
import { InfoPill } from "./info-pill";
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
  const [reviewing, setReviewing] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);
  function patch(next: Partial<MovementDraft>): void {
    setDraft((current) => ({ ...current, ...next }));
  }

  const canSave = Number(draft.amount || 0) > 0 && draft.description.trim().length >= 5;
  const amount = Number(draft.amount || 0);
  const projectedBalance = account
    ? draft.type === "INFLOW"
      ? account.balance + amount
      : account.balance - amount
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
        open={open}
        title={
          reviewing ? "Tinjau mutasi kas" : draft.type === "INFLOW" ? "Kas masuk" : "Kas keluar"
        }
        onClose={requestClose}
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
          {account ? (
            <InfoPill label="Rekening" value={`${account.name} • ${shortMoney(account.balance)}`} />
          ) : null}
          {reviewing ? (
            <>
              <MoneyImpactRow
                label={account?.name ?? "Rekening"}
                before={account?.balance ?? 0}
                delta={draft.type === "INFLOW" ? amount : -amount}
                after={projectedBalance}
              />
              <FormSection
                title="Yang akan dicatat"
                helper="Mutasi ini menambah baris ledger dan tidak mengubah transaksi lama."
              >
                <FieldContextLine>
                  {draft.type === "INFLOW" ? "Kas masuk" : "Kas keluar"} ·{" "}
                  {movementCategoryOptions.find((option) => option.value === draft.category)
                    ?.label ?? formatBusinessLabel(draft.category, "FINANCE")}
                </FieldContextLine>
                <FieldContextLine>
                  {draft.transactionDate} · {draft.referenceNumber || "Tanpa nomor referensi"}
                </FieldContextLine>
                <p className="rounded-2xl bg-surface-container-low px-4 py-3 text-xs leading-5 text-on-surface">
                  {draft.description}
                </p>
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
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => patch({ type: "INFLOW", category: "owner_capital" })}
                  className={`min-h-12 rounded-full px-4 text-xs font-bold active:scale-[0.97] ${
                    draft.type === "INFLOW"
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-low text-on-surface"
                  }`}
                >
                  Kas masuk
                </button>
                <button
                  type="button"
                  onClick={() => patch({ type: "OUTFLOW", category: "bank_fee" })}
                  className={`min-h-12 rounded-full px-4 text-xs font-bold active:scale-[0.97] ${
                    draft.type === "OUTFLOW"
                      ? "bg-error text-white"
                      : "bg-surface-container-low text-on-surface"
                  }`}
                >
                  Kas keluar
                </button>
              </div>
              <FormField label="Nominal">
                <MoneyInput value={draft.amount} onChange={(value) => patch({ amount: value })} />
              </FormField>
              <FieldContextLine tone={projectedBalance < 0 ? "danger" : "default"}>
                Saldo: {shortMoney(account?.balance ?? 0)} -&gt; {shortMoney(projectedBalance)}
              </FieldContextLine>
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
