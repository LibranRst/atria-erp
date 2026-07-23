import React from "react";

import {
  DatePickerField,
  FieldContextLine,
  FormField,
  FormRiskNotice,
  FormSection,
  MoneyInput,
  WorkflowFormSheet,
  SheetSelect,
  Textarea,
  TextInput,
  type SelectOption,
} from "@/components/ui";
import {
  FinanceUnsavedChangesModal,
  MoneyImpactRow,
} from "@/features/finance-dashboard/components/shared/finance-form-patterns";
import { shortMoney } from "@/features/finance-dashboard/utils/dashboard-formatters";
import { InfoPill } from "./info-pill";
import type { BankAccount, TransferDraft } from "@/features/finance-dashboard/types/bank-account-types";

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
  const [reviewing, setReviewing] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);
  function patch(next: Partial<TransferDraft>): void {
    setDraft((current) => ({ ...current, ...next }));
  }

  const canSave =
    Boolean(draft.toBankAccountId) &&
    Number(draft.amount || 0) > 0 &&
    draft.description.trim().length >= 5;
  const amount = Number(draft.amount || 0);
  const projectedSourceBalance = account ? account.balance - amount : 0;
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
        open={open}
        title={reviewing ? "Tinjau transfer rekening" : "Transfer rekening"}
        onClose={requestClose}
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
          {account ? (
            <InfoPill
              label="Dari rekening"
              value={`${account.name} • ${shortMoney(account.balance)}`}
            />
          ) : null}
          {reviewing ? (
            <>
              <MoneyImpactRow
                label={`Sumber · ${account?.name ?? "Rekening"}`}
                before={account?.balance ?? 0}
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
              {amount > 0 ? (
                <FormRiskNotice
                  title="Cegah transfer salah rekening"
                  tone={projectedSourceBalance < 0 ? "danger" : "warning"}
                >
                  Pastikan rekening tujuan dan nominal sudah sesuai agar saldo sumber tidak
                  terkoreksi manual setelah dicatat.
                </FormRiskNotice>
              ) : null}
              <SheetSelect
                label="Ke rekening"
                value={draft.toBankAccountId}
                onChange={(value) => patch({ toBankAccountId: value })}
                options={options}
              />
              <FormField label="Nominal">
                <MoneyInput value={draft.amount} onChange={(value) => patch({ amount: value })} />
              </FormField>
              <FieldContextLine tone={projectedSourceBalance < 0 ? "danger" : "default"}>
                Tujuan: {selectedTarget?.label ?? "belum dipilih"} · Sumber{" "}
                {shortMoney(account?.balance ?? 0)} -&gt; {shortMoney(projectedSourceBalance)}
              </FieldContextLine>
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
