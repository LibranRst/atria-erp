"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";

import { createClientInvoice } from "@/app/actions/finance/create-client-invoice";
import {
  DatePickerField,
  FieldContextLine,
  FormField,
  FormRiskNotice,
  FormSection,
  MoneyInput,
  SheetSelect,
  Textarea,
  TextInput,
  WorkflowFormSheet,
} from "@/components/ui";
import {
  FinanceSuccessSheet,
  FinanceUnsavedChangesModal,
  type FinanceOperationSuccess,
} from "@/features/finance/components/finance-form-patterns";
import { useLocalFormRecovery } from "@/features/forms/use-local-form-recovery";
import { getErrorMessage } from "@/lib/utils/error-message";
import { updateUrlSearchParam } from "@/lib/utils/use-url-search-param";

const invoiceStageSchema = z.enum([
  "DP",
  "PROGRESS_1",
  "PROGRESS_2",
  "PELUNASAN",
  "RETENTION",
  "AD_HOC",
]);
type InvoiceStage = z.infer<typeof invoiceStageSchema>;
const clientInvoiceRecoverySchema = z.object({
  invoiceNumber: z.string().max(100),
  amount: z.string().max(30),
  stage: invoiceStageSchema,
  dueDate: z.string().max(20),
  notes: z.string().max(1_000),
});
type ClientInvoiceRecovery = z.infer<typeof clientInvoiceRecoverySchema>;

type ClientInvoiceFormProps = { readonly open: boolean };

const INVOICE_STAGE_OPTIONS: ReadonlyArray<{
  readonly value: InvoiceStage;
  readonly label: string;
  readonly description: string;
}> = [
  { value: "DP", label: "Uang Muka", description: "Pembayaran awal proyek" },
  { value: "PROGRESS_1", label: "Termin Progress 1", description: "Tagihan progress pertama" },
  { value: "PROGRESS_2", label: "Termin Progress 2", description: "Tagihan progress kedua" },
  { value: "PELUNASAN", label: "Pelunasan", description: "Tagihan final proyek" },
  { value: "RETENTION", label: "Retensi", description: "Dana yang ditahan sesuai kontrak" },
  { value: "AD_HOC", label: "Tagihan Khusus", description: "Di luar termin standar" },
];

function initialInvoiceDraft(): ClientInvoiceRecovery {
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return {
    invoiceNumber: `INV/${year}/${randomSuffix}-AD_HOC`,
    amount: "",
    stage: "AD_HOC",
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    notes: "",
  };
}

export function ClientInvoiceForm({ open }: ClientInvoiceFormProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = React.useTransition();
  const [reviewing, setReviewing] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<FinanceOperationSuccess | null>(null);
  const projectId = React.useMemo(() => {
    const parts = pathname.split("/");
    const projectIndex = parts.indexOf("projects");
    return projectIndex >= 0 ? parts[projectIndex + 1] : "";
  }, [pathname]);
  const initialPayload = React.useCallback(() => initialInvoiceDraft(), []);
  const draft = useLocalFormRecovery({
    storageKey: `atria:client-invoice:${projectId || "unknown"}`,
    schema: clientInvoiceRecoverySchema,
    initialPayload,
  });
  const amount = Number(draft.payload.amount || 0);
  const stageLabel =
    INVOICE_STAGE_OPTIONS.find((option) => option.value === draft.payload.stage)?.label ??
    draft.payload.stage;
  const canContinue =
    Boolean(projectId && draft.payload.invoiceNumber.trim() && draft.payload.dueDate) && amount > 0;
  const disabledReason = !projectId
    ? "Proyek tidak valid."
    : !draft.payload.invoiceNumber.trim()
      ? "Isi nomor invoice."
      : amount <= 0
        ? "Nominal invoice harus lebih besar dari Rp 0."
        : !draft.payload.dueDate
          ? "Pilih tanggal jatuh tempo."
          : undefined;

  function patch(next: Partial<ClientInvoiceRecovery>): void {
    draft.setPayload((current) => ({ ...current, ...next }));
    setError(null);
  }

  function closeForm(): void {
    updateUrlSearchParam("new-invoice", null, "replace");
  }

  function requestClose(): void {
    if (reviewing) {
      setReviewing(false);
      return;
    }
    if (draft.isDirty) {
      setConfirmClose(true);
      return;
    }
    closeForm();
  }

  function submit(): void {
    if (!canContinue) return;
    setError(null);
    startTransition(async () => {
      try {
        const response = await createClientInvoice({
          projectId,
          invoiceNumber: draft.payload.invoiceNumber.trim(),
          amount,
          stage: draft.payload.stage,
          dueDate: new Date(draft.payload.dueDate),
          notes: draft.payload.notes.trim() || null,
        });
        if (!response.success) {
          setError(response.error.message || "Gagal membuat invoice klien.");
          toast.error(response.error.message || "Gagal membuat invoice klien.");
          return;
        }
        const completed = draft.payload;
        draft.reset();
        setReviewing(false);
        closeForm();
        router.refresh();
        setSuccess({
          title: "Invoice klien dibuat",
          description: "Invoice siap dipantau dan menerima pembayaran. Saldo kas belum berubah.",
          facts: [
            { label: "Nomor", value: completed.invoiceNumber },
            { label: "Termin", value: stageLabel },
            { label: "Nominal", value: `Rp ${amount.toLocaleString("id-ID")}` },
          ],
        });
      } catch (caught: unknown) {
        const message = getErrorMessage(caught, "Terjadi kesalahan internal.");
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <>
      <WorkflowFormSheet
        open={open}
        title={reviewing ? "Tinjau invoice klien" : "Buat invoice klien"}
        onClose={requestClose}
        pending={isPending}
        pendingLabel="Membuat…"
        disabled={!canContinue}
        disabledReason={disabledReason}
        primaryLabel={reviewing ? "Buat" : "Tinjau"}
        secondaryLabel={reviewing ? "Ubah" : undefined}
        statusText={
          draft.recoveredAt
            ? "Data sebelumnya dipulihkan dari perangkat ini."
            : draft.isDirty
              ? "Perubahan aman di perangkat ini."
              : undefined
        }
        statusTone="success"
        onPrimary={() => (reviewing ? submit() : setReviewing(true))}
        onSecondary={() => setReviewing(false)}
      >
        <div className="space-y-md">
          {error ? (
            <div
              className="bg-error-container/20 text-error rounded-2xl p-3 text-xs font-medium"
              role="alert"
            >
              {error}
            </div>
          ) : null}
          {reviewing ? (
            <div className="space-y-3">
              <FormSection
                title="Invoice yang akan dibuat"
                helper="Dokumen ini dapat menerima pembayaran setelah dibuat."
              >
                <ReviewFact label="Nomor" value={draft.payload.invoiceNumber} />
                <ReviewFact label="Termin" value={stageLabel} />
                <ReviewFact label="Nominal" value={`Rp ${amount.toLocaleString("id-ID")}`} />
                <ReviewFact
                  label="Jatuh tempo"
                  value={new Date(draft.payload.dueDate).toLocaleDateString("id-ID", {
                    dateStyle: "long",
                  })}
                />
              </FormSection>
              <FormRiskNotice title="Belum mengubah saldo kas" tone="default">
                Invoice mencatat piutang proyek. Saldo baru bertambah saat pembayaran klien dicatat
                secara terpisah.
              </FormRiskNotice>
              {draft.payload.notes ? (
                <p className="bg-surface-container-low rounded-2xl px-4 py-3 text-xs leading-5">
                  {draft.payload.notes}
                </p>
              ) : null}
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setReviewing(true);
              }}
              className="space-y-md"
            >
              <FormSection
                title="Identitas invoice"
                helper="Nomor disiapkan otomatis dan tetap dapat diubah."
              >
                <div className="divide-outline-variant/20 grid grid-cols-1 divide-y">
                  <FormField label="Nomor Invoice" required>
                    <TextInput
                      value={draft.payload.invoiceNumber}
                      disabled={isPending}
                      onChange={(value) => patch({ invoiceNumber: value })}
                    />
                  </FormField>
                  <SheetSelect
                    label="Tahap Tagihan"
                    value={draft.payload.stage}
                    disabled={isPending}
                    onChange={(value) => {
                      const parsed = invoiceStageSchema.safeParse(value);
                      if (parsed.success) patch({ stage: parsed.data });
                    }}
                    options={INVOICE_STAGE_OPTIONS}
                  />
                </div>
              </FormSection>
              <FormSection title="Nilai dan tenggat" helper="Nominal tidak ditebak oleh sistem.">
                <div className="divide-outline-variant/20 grid grid-cols-1 divide-y">
                  <FormField label="Nominal Tagihan" required>
                    <MoneyInput
                      value={draft.payload.amount}
                      disabled={isPending}
                      onChange={(value) => patch({ amount: value })}
                    />
                  </FormField>
                  <DatePickerField
                    label="Tanggal Jatuh Tempo"
                    value={draft.payload.dueDate}
                    disabled={isPending}
                    onChange={(value) => patch({ dueDate: value })}
                    required
                  />
                  <FormField label="Catatan" optional>
                    <Textarea
                      value={draft.payload.notes}
                      disabled={isPending}
                      onChange={(value) => patch({ notes: value })}
                      placeholder="Detail yang membantu tim finance"
                      rows={2}
                    />
                  </FormField>
                </div>
              </FormSection>
              <FieldContextLine tone="success">
                Draft lokal diperbarui setiap kali data berubah.
              </FieldContextLine>
            </form>
          )}
        </div>
      </WorkflowFormSheet>
      <FinanceUnsavedChangesModal
        open={confirmClose}
        onKeep={() => {
          setConfirmClose(false);
          closeForm();
        }}
        onDiscard={() => {
          draft.reset();
          setConfirmClose(false);
          closeForm();
        }}
        onContinue={() => setConfirmClose(false)}
      />
      <FinanceSuccessSheet
        success={success}
        secondaryLabel="Tambah"
        onClose={() => setSuccess(null)}
        onSecondary={() => {
          setSuccess(null);
          draft.reset();
          updateUrlSearchParam("new-invoice", "true", "push");
        }}
      />
    </>
  );
}

function ReviewFact({
  label,
  value,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 text-xs">
      <span className="text-on-surface-variant shrink-0">{label}</span>
      <span className="text-on-surface text-right font-bold">{value}</span>
    </div>
  );
}
