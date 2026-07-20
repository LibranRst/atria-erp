import React from "react";

import {
  FormField,
  FormRiskNotice,
  FormSection,
  MoneyInput,
  WorkflowFormSheet,
  TextInput,
} from "@/components/ui";
import { MoneyValue } from "@/components/ui/page-primitives";
import { FinanceUnsavedChangesModal } from "@/features/finance/components/finance-form-patterns";
import { ColorEditor } from "./color-editor";
import type { AccountDraft } from "./types";

function AccountBalanceImpact({
  openingBalance,
}: {
  readonly openingBalance: number;
}): React.JSX.Element {
  return (
    <section className="min-w-0 space-y-2.5">
      <header className="min-w-0 px-1">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.11em] text-on-surface">
          Dampak saldo
        </h3>
        <p className="mt-1 text-[11px] leading-4 text-on-surface-variant">
          Periksa perubahan kas sebelum rekening dibuat.
        </p>
      </header>
      <div className="min-w-0 divide-y divide-outline-variant/20 overflow-hidden rounded-[24px] bg-white shadow-[0_10px_28px_rgba(17,17,17,0.035)] ring-1 ring-outline-variant/15">
        <div className="flex min-w-0 items-center gap-3 px-4 py-3.5">
          <span
            className="material-symbols-outlined !flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-primary/8 text-[19px] leading-none text-primary"
            aria-hidden="true"
          >
            account_balance_wallet
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold leading-5 text-on-surface">
              Saldo awal rekening
            </span>
            <span className="mt-0.5 block text-[10px] leading-4 text-on-surface-variant">
              Dicatat satu kali sebagai mutasi pembukaan.
            </span>
          </span>
        </div>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3.5 py-4">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">
              Sebelum
            </p>
            <MoneyValue
              amount={0}
              variant="fullDynamic"
              size="sm"
              className="mt-1"
            />
          </div>
          <span
            className="material-symbols-outlined text-[20px] leading-none text-on-surface-variant/65"
            aria-hidden="true"
          >
            arrow_forward
          </span>
          <div className="min-w-0 text-right">
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">
              Sesudah
            </p>
            <MoneyValue
              amount={openingBalance}
              variant="fullDynamic"
              size="sm"
              tone="primary"
              align="right"
              className="mt-1"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function AccountReviewRow({
  label,
  value,
  tabular = false,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
  readonly tabular?: boolean;
}): React.JSX.Element {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] items-start gap-4 px-4 py-3.5">
      <dt className="pt-0.5 text-[10px] font-semibold leading-4 text-on-surface-variant">
        {label}
      </dt>
      <dd
        className={`min-w-0 break-words text-right text-[13px] font-bold leading-5 text-on-surface ${
          tabular ? "font-numeral tabular-nums" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function AccountIdentityReview({
  draft,
}: {
  readonly draft: AccountDraft;
}): React.JSX.Element {
  return (
    <section className="min-w-0 space-y-2.5">
      <header className="min-w-0 px-1">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.11em] text-on-surface">
          Identitas rekening
        </h3>
        <p className="mt-1 text-[11px] leading-4 text-on-surface-variant">
          Periksa data yang akan tampil di selector kas, kartu rekening, dan
          ledger.
        </p>
      </header>
      <dl className="min-w-0 divide-y divide-outline-variant/20 overflow-hidden rounded-[24px] bg-white shadow-[0_10px_28px_rgba(17,17,17,0.035)] ring-1 ring-outline-variant/15">
        <AccountReviewRow label="Bank" value={draft.bankName} />
        <AccountReviewRow label="Nama rekening" value={draft.name} />
        <AccountReviewRow
          label="Nomor rekening"
          value={draft.accountNumber}
          tabular
        />
        <AccountReviewRow label="Pemegang" value={draft.holderName} />
        <AccountReviewRow
          label="Status"
          value={
            <span
              className={`inline-flex items-center justify-end gap-2 ${
                draft.isActive ? "text-primary" : "text-warning"
              }`}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  draft.isActive ? "bg-primary" : "bg-warning"
                }`}
                aria-hidden="true"
              />
              {draft.isActive ? "Aktif" : "Diarsipkan"}
            </span>
          }
        />
      </dl>
    </section>
  );
}

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
              ? "Simpan"
              : "Tambah"
            : "Tinjau"
        }
        secondaryLabel={reviewing ? "Ubah" : undefined}
        actionLayout={reviewing ? "stacked" : "split"}
        pendingLabel="Menyimpan…"
        onExitComplete={() => {
          setReviewing(false);
          setConfirmClose(false);
        }}
        onPrimary={() => (reviewing ? onSave() : setReviewing(true))}
        onSecondary={() => setReviewing(false)}
      >
        {reviewing ? (
          <div className="space-y-5">
            {!draft.id && openingBalance > 0 ? (
              <AccountBalanceImpact openingBalance={openingBalance} />
            ) : null}
            <AccountIdentityReview draft={draft} />
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
