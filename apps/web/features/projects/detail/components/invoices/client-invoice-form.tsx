"use client";

import React from "react";
import { usePathname, useRouter } from "@/lib/navigation/workspace-navigation";

import { z } from "zod";
import { toast } from "sonner";

import { createClientInvoice } from "@/app/actions/finance/create-client-invoice";
import { getInvoicePrefillContext } from "@/app/actions/finance/get-invoice-prefill-context";
import type { InvoicePrefillResult } from "@atria/core/finance/invoice-prefill";
import { cn } from "@/lib/utils/cn";
import {
  GroupedSurface,
  FactRow,
  AppIcon,
  DatePickerField,
  FinanceUnsavedChangesModal,
  FormField,
  FormRiskNotice,
  FormSection,
  MoneyInput,
  MoneyValue,
  type OperationSuccess,
  OperationSuccessDialog,
  AdaptiveSelect,
  Textarea,
  TextInput,
  WorkflowFormSheet,
  Button,
} from "@/components/ui";
import { useLocalFormRecovery } from "@/lib/hooks/use-local-form-recovery";
import { getErrorMessage } from "@atria/core/utils/error-message";
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
  return {
    invoiceNumber: "",
    amount: "",
    stage: "DP",
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
  const [success, setSuccess] = React.useState<OperationSuccess | null>(null);
  const [prefill, setPrefill] = React.useState<InvoicePrefillResult | null>(null);
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
  const { setPayload } = draft;

  // Prefill otomatis saat form dibuka
  React.useEffect(() => {
    if (!open || !projectId) return;

    let active = true;

    getInvoicePrefillContext({ projectId })
      .then((res) => {
        if (!active) return;
        if (res.success && res.data) {
          const data = res.data;
          setPrefill(data);

          setPayload((prev) => {
            const currentNum = prev.invoiceNumber.trim();
            const isPlaceholderOrEmpty =
              !currentNum || currentNum.includes("-AD_HOC") || currentNum === "";

            // Auto-fill jika nomor invoice masih kosong/placeholder atau nominal belum terisi
            return {
              ...prev,
              invoiceNumber: isPlaceholderOrEmpty
                ? data.suggestedInvoiceNumber
                : prev.invoiceNumber,
              amount: prev.amount !== "" ? prev.amount : String(data.suggestedAmount || ""),
              stage: prev.stage === "AD_HOC" || !prev.stage ? data.suggestedStage : prev.stage,
              dueDate: prev.dueDate || data.suggestedDueDate,
              notes: prev.notes ? prev.notes : data.suggestedNotes,
            };
          });
        }
      })
      .catch(() => {
        // Abaikan error jaringan non-fatal saat prefill
      });

    return () => {
      active = false;
    };
  }, [open, projectId, setPayload]);

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
        desktopSize="wide"
        desktopFooterPlacement="aside"
        desktopAsideSummary={
          <div className="space-y-3">
            <div className="px-1">
              <h3 className="text-support font-semibold text-on-surface">Ringkasan invoice</h3>
              <p className="mt-1 text-support wrap-anywhere text-on-surface-variant">
                {draft.payload.invoiceNumber.trim() || "Nomor invoice belum diisi"}
              </p>
            </div>
            <GroupedSurface variant="desktopPanel" className="wrap-anywhere">
              <div className="divide-y divide-outline-variant/20">
                <FactRow layout="stacked" wrapLabel label="Termin" value={stageLabel} />
                <FactRow
                  layout="stacked"
                  wrapLabel
                  label="Nominal draft"
                  value={
                    <MoneyValue
                      fractionDigits={Number.isInteger(amount) ? 0 : 2}
                      amount={amount}
                      variant="fullDynamic"
                      size="sm"
                      align="right"
                    />
                  }
                />
                <FactRow
                  layout="stacked"
                  wrapLabel
                  label="Jatuh tempo"
                  value={
                    draft.payload.dueDate
                      ? new Date(draft.payload.dueDate).toLocaleDateString("id-ID", {
                          dateStyle: "medium",
                        })
                      : "Belum dipilih"
                  }
                />
              </div>
            </GroupedSurface>
            <p className="px-1 text-support text-on-surface-variant">
              Invoice mencatat piutang. Saldo kas bertambah melalui pencatatan penerimaan klien
              terpisah.
            </p>
          </div>
        }
        dismissal={{ mode: "managed" }}
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
              className="rounded-2xl bg-error-container/20 p-3 text-xs font-medium text-error"
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
                {draft.payload.notes.trim() ? (
                  <ReviewFact label="Catatan" value={draft.payload.notes} stacked />
                ) : null}
              </FormSection>
              <FormRiskNotice title="Belum mengubah saldo kas" tone="default">
                Invoice mencatat piutang proyek. Saldo baru bertambah saat pembayaran klien dicatat
                secara terpisah.
              </FormRiskNotice>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setReviewing(true);
              }}
              className="space-y-md"
            >
              {prefill && (
                <div className="overflow-hidden rounded-owner bg-white p-4 shadow-surface ring-1 ring-ring-subtle">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-eyebrow font-bold tracking-[0.16em] text-on-surface-variant uppercase">
                        Sisa Belum Ditagih
                      </p>
                      <MoneyValue
                        amount={prefill.remainingUnbilled}
                        variant="fullDynamic"
                        size="lg"
                        className="mt-1 font-bold text-primary"
                      />
                      <p className="mt-1 text-meta text-on-surface-variant">
                        {prefill.activeInvoicesCount} termin aktif ·{" "}
                        {prefill.totalContractValue > 0
                          ? ((prefill.totalInvoiced / prefill.totalContractValue) * 100).toFixed(0)
                          : 0}
                        % nilai kontrak sudah terbit
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-surface-container-low px-3 py-1 font-mono text-xs font-bold text-on-surface ring-1 ring-ring-subtle">
                      {prefill.projectCode}
                    </span>
                  </div>

                  <div className="mt-3.5 grid grid-cols-2 gap-2 border-t border-outline-variant/15 pt-3">
                    <div className="rounded-2xl bg-surface-container-low p-2.5 text-left">
                      <p className="truncate text-eyebrow font-bold tracking-wider text-on-surface-variant uppercase">
                        Nilai Kontrak
                      </p>
                      <div className="mt-0.5">
                        <MoneyValue
                          amount={prefill.totalContractValue}
                          variant="fullDynamic"
                          size="sm"
                        />
                      </div>
                    </div>
                    <div className="rounded-2xl bg-surface-container-low p-2.5 text-left">
                      <p className="truncate text-eyebrow font-bold tracking-wider text-on-surface-variant uppercase">
                        Sudah Ditagih
                      </p>
                      <div className="mt-0.5">
                        <MoneyValue
                          amount={prefill.totalInvoiced}
                          variant="fullDynamic"
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <FormSection
                title="Identitas invoice"
                helper="Nomor disiapkan otomatis sesuai kode proyek dan dapat disesuaikan."
              >
                <FormField label="Nomor Invoice" required>
                  <TextInput
                    value={draft.payload.invoiceNumber}
                    disabled={isPending}
                    onChange={(value) => patch({ invoiceNumber: value })}
                  />
                </FormField>
                {prefill?.suggestedInvoiceNumber &&
                  draft.payload.invoiceNumber !== prefill.suggestedInvoiceNumber && (
                    <div className="flex items-center justify-between bg-surface-container-low/50 px-4 py-2 text-meta">
                      <span className="text-on-surface-variant">
                        Nomor kanonis:{" "}
                        <strong className="font-mono text-on-surface">
                          {prefill.suggestedInvoiceNumber}
                        </strong>
                      </span>
                      <Button
                        type="button"
                        onClick={() => patch({ invoiceNumber: prefill.suggestedInvoiceNumber })}
                        className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary hover:bg-primary/15 active:z-10 active:shadow-raised"
                        variant="secondary"
                        size="mini"
                      >
                        Terapkan
                      </Button>
                    </div>
                  )}
                <AdaptiveSelect
                  label="Tahap Tagihan"
                  value={draft.payload.stage}
                  disabled={isPending}
                  onChange={(value) => {
                    const parsed = invoiceStageSchema.safeParse(value);
                    if (parsed.success) patch({ stage: parsed.data });
                  }}
                  options={INVOICE_STAGE_OPTIONS}
                />
              </FormSection>
              <FormSection
                title="Nilai dan tenggat"
                helper="Pilih persentase cepat atau masukkan nominal khusus."
              >
                {prefill?.presets && prefill.presets.length > 0 && (
                  <div className="px-4 pt-3 pb-2.5">
                    <span className="block text-[11px] font-semibold text-on-surface-variant">
                      Pilihan termin cepat:
                    </span>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {prefill.presets.map((preset) => {
                        const isSelected =
                          Number(draft.payload.amount) === preset.amount &&
                          draft.payload.stage === preset.stage;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            disabled={isPending}
                            onClick={() => {
                              patch({
                                amount: String(preset.amount),
                                stage: preset.stage,
                                notes: preset.notes,
                              });
                            }}
                            className={cn(
                              "inline-flex min-h-8 items-center rounded-full px-3 py-1 text-xs font-semibold transition-all select-none",
                              isSelected
                                ? "bg-primary text-white shadow-xs ring-1 ring-primary"
                                : "bg-surface-container-low text-on-surface ring-1 ring-ring-subtle hover:bg-surface-container",
                            )}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
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
              </FormSection>
              <div className="flex items-center gap-2 px-1 text-meta text-on-surface-variant/75">
                <AppIcon name="check-circle" className="icon-xs text-primary" />
                <span>Draft lokal diperbarui otomatis setiap kali data berubah.</span>
              </div>
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
      <OperationSuccessDialog
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
  stacked = false,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
  readonly stacked?: boolean;
}): React.JSX.Element {
  if (stacked) {
    return (
      <div className="px-4 py-3 text-xs">
        <span className="font-medium text-on-surface-variant">{label}</span>
        <p className="mt-1 leading-relaxed font-medium whitespace-pre-wrap text-on-surface">
          {value}
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 text-xs">
      <span className="shrink-0 text-on-surface-variant">{label}</span>
      <span className="text-right font-bold text-on-surface">{value}</span>
    </div>
  );
}
