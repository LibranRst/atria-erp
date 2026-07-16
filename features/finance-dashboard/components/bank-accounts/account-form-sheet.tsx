import React from "react";

import {
  FormField,
  FieldContextLine,
  FormRiskNotice,
  FormSection,
  MoneyInput,
  WorkflowFormSheet,
  TextInput,
} from "@/components/ui";
import {
  FinanceUnsavedChangesModal,
  MoneyImpactRow,
} from "@/features/finance/components/finance-form-patterns";
import { ColorEditor } from "./color-editor";
import type { AccountDraft } from "./types";

export function AccountFormSheet({
  open,
  title,
  draft,
  setDraft,
  isDirty,
  pending,
  canEditStatus,
  onClose,
  onDiscard,
  onSave,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly draft: AccountDraft;
  readonly setDraft: React.Dispatch<React.SetStateAction<AccountDraft>>;
  readonly isDirty: boolean;
  readonly pending: boolean;
  readonly canEditStatus: boolean;
  readonly onClose: () => void;
  readonly onDiscard: () => void;
  readonly onSave: () => void;
}): React.JSX.Element {
  const [reviewing, setReviewing] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);
  function patch(next: Partial<AccountDraft>): void {
    setDraft((current) => ({ ...current, ...next }));
  }

  const canSave =
    draft.name.trim().length >= 2 &&
    draft.bankName.trim().length >= 2 &&
    draft.accountNumber.trim().length >= 3 &&
    draft.holderName.trim().length >= 2;
  const disabledReason =
    draft.name.trim().length < 2
      ? "Isi nama rekening agar mudah dikenali di ledger."
      : draft.bankName.trim().length < 2
        ? "Isi nama bank."
        : draft.accountNumber.trim().length < 3
          ? "Isi nomor rekening minimal 3 karakter."
          : draft.holderName.trim().length < 2
            ? "Isi nama pemegang rekening."
            : undefined;
  const openingBalance = Number(draft.openingBalance || 0);

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
        title={reviewing ? "Tinjau rekening" : title}
        onClose={requestClose}
        pending={pending}
        disabled={!canSave}
        disabledReason={disabledReason}
        primaryLabel={
          reviewing
            ? draft.id
              ? "Perbarui Rekening"
              : "Tambah Rekening"
            : "Tinjau Rekening"
        }
        secondaryLabel={reviewing ? "Ubah Data" : undefined}
        pendingLabel="Menyimpan…"
        onPrimary={() => (reviewing ? onSave() : setReviewing(true))}
        onSecondary={() => setReviewing(false)}
      >
        {reviewing ? (
          <div className="space-y-3">
            {!draft.id && openingBalance > 0 ? (
              <MoneyImpactRow
                label="Saldo rekening baru"
                before={0}
                delta={openingBalance}
                after={openingBalance}
              />
            ) : null}
            <FormSection
              title="Identitas rekening"
              helper="Informasi ini akan tampil pada selector kas dan ledger."
            >
              <FieldContextLine>
                {draft.bankName} · {draft.name}
              </FieldContextLine>
              <FieldContextLine>
                {draft.accountNumber} · {draft.holderName}
              </FieldContextLine>
              <FieldContextLine tone={draft.isActive ? "success" : "warning"}>
                {draft.isActive ? "Rekening aktif" : "Rekening diarsipkan"}
              </FieldContextLine>
            </FormSection>
            {!draft.id && openingBalance > 0 ? (
              <FormRiskNotice title="Saldo awal membuat mutasi" tone="warning">
                Saat rekening dibuat, sistem juga mencatat ledger saldo awal dan
                audit log. Koreksi berikutnya dilakukan melalui mutasi kas.
              </FormRiskNotice>
            ) : null}
          </div>
        ) : (
          <div className="space-y-md">
            <FormSection
              title="Identitas rekening"
              helper="Dipakai di ledger, transfer, dan mutasi kas."
            >
              <FormField label="Nama rekening">
                <TextInput
                  value={draft.name}
                  onChange={(value) => patch({ name: value })}
                  placeholder="BCA Operasional"
                />
              </FormField>
              <FormField label="Nama bank">
                <TextInput
                  value={draft.bankName}
                  onChange={(value) => patch({ bankName: value })}
                  placeholder="BCA"
                />
              </FormField>
              <FormField label="Nomor rekening">
                <TextInput
                  value={draft.accountNumber}
                  onChange={(value) => patch({ accountNumber: value })}
                  placeholder="8889991122"
                  inputMode="numeric"
                />
              </FormField>
              <FormField label="Pemegang">
                <TextInput
                  value={draft.holderName}
                  onChange={(value) => patch({ holderName: value })}
                  placeholder="PT Dekoria Desain Estetika"
                />
              </FormField>
            </FormSection>
            {!draft.id || canEditStatus ? (
              <FormSection
                title="Saldo dan status"
                helper="Saldo awal hanya tersedia saat membuat rekening."
              >
                {!draft.id ? (
                  <FormField
                    label="Saldo awal"
                    helper="Opsional. Jika diisi, sistem mencatat ledger saldo awal."
                  >
                    <MoneyInput
                      value={draft.openingBalance}
                      onChange={(value) => patch({ openingBalance: value })}
                    />
                  </FormField>
                ) : null}
                {canEditStatus ? (
                  <FormField label="Status rekening" layout="inline">
                    <button
                      type="button"
                      onClick={() => patch({ isActive: !draft.isActive })}
                      className={`min-h-8 rounded-full px-3 text-[10px] font-bold active:scale-[0.97] ${
                        draft.isActive
                          ? "bg-primary/8 text-primary"
                          : "bg-error/8 text-error"
                      }`}
                    >
                      {draft.isActive ? "Aktif" : "Diarsipkan"}
                    </button>
                  </FormField>
                ) : null}
              </FormSection>
            ) : null}
            <FormSection
              title="Tampilan kartu"
              helper="Pilih warna agar rekening mudah dikenali."
              presentation="plain"
            >
              <ColorEditor draft={draft} setDraft={setDraft} />
            </FormSection>
          </div>
        )}
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
