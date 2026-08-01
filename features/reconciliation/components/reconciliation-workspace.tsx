"use client";

import React from "react";
import { toast } from "sonner";

import {
  importBankStatementCsv,
  recordBankStatementRow,
  type ReconciliationCashTransaction,
  type ReconciliationStatementRow,
  type ReconciliationWorkspace as ReconciliationWorkspaceData,
} from "@/app/actions/finance/reconciliation-workspace";
import {
  clearReconciliationException,
  markReconciliationException,
  reconcileCashTransaction,
} from "@/app/actions/finance/reconcile-cash-transaction";
import {
  DatePickerField,
  FormField,
  FormSection,
  MoneyInput,
  OperationalFormSheet,
  SheetSelect,
  TextInput,
  Textarea,
  WorkflowFormSheet,
} from "@/components/ui";
import { PageHeader } from "@/components/ui/feedback/page-primitives";
import { formatIdr } from "@/lib/utils/money";
import { updateUrlSearchParam, useBrowserUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { useRouter } from "next/navigation";
import { AppIcon } from "@/components/ui/icon/app-icon";
import {
  cashDisplayTitle,
  cashSourceCopy,
  cashStatusCopy,
} from "@/features/reconciliation/utils/reconciliation-cash-copy";
import {
  directionCopy,
  EvidenceDescription,
  EvidenceMetaRow,
  formatReconciliationDate as formatDate,
  type ImportDraft,
  newStatementDraft,
  SheetMoneySummary,
  type ReconciliationView,
  type StatementDraft,
} from "./reconciliation-primitives";
import { ReconciliationHistorySheet } from "./reconciliation-history-sheet";
import { ReconciliationQueue } from "./reconciliation-queue";

export function ReconciliationWorkspace({
  initialData,
}: {
  readonly initialData: ReconciliationWorkspaceData;
}): React.JSX.Element {
  const router = useRouter();
  const data = initialData;
  const viewParam = useBrowserUrlSearchParam("view", "statement");
  const activeView: ReconciliationView =
    viewParam === "cash" || viewParam === "history" ? viewParam : "statement";
  const [selectedCashId, setSelectedCashId] = React.useState<string | null>(null);
  const [selectedStatementId, setSelectedStatementId] = React.useState<string | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = React.useState<string | null>(null);
  const [exceptionCashId, setExceptionCashId] = React.useState<string | null>(null);
  const [exceptionReason, setExceptionReason] = React.useState("");
  const [manualOpen, setManualOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<StatementDraft>(() =>
    newStatementDraft(initialData.bankAccounts[0]?.id ?? ""),
  );
  const [importDraft, setImportDraft] = React.useState<ImportDraft>({
    bankAccountId: initialData.bankAccounts[0]?.id ?? "",
    fileName: "",
    content: "",
  });

  const selectedCash = data.cashTransactions.find((item) => item.id === selectedCashId) ?? null;
  const exceptionCash = data.cashTransactions.find((item) => item.id === exceptionCashId) ?? null;
  const selectedHistory = data.history.find((item) => item.id === selectedHistoryId) ?? null;
  const matchingStatements = selectedCash
    ? data.statementRows.filter(
        (item) =>
          item.bankAccountId === selectedCash.bankAccountId &&
          item.type === selectedCash.type &&
          item.amount === selectedCash.amount,
      )
    : [];
  const selectedStatement =
    matchingStatements.find((item) => item.id === selectedStatementId) ?? null;
  const accountOptions = data.bankAccounts.map((account) => ({
    value: account.id,
    label: account.name,
    description: account.bankName,
  }));
  const reconcileDisabledReason = !selectedStatement
    ? "Pilih mutasi rekening koran dengan rekening, arah, dan nominal yang sama."
    : undefined;

  function openManual(): void {
    setError(null);
    setDraft(newStatementDraft(data.bankAccounts[0]?.id ?? ""));
    setManualOpen(true);
  }

  function openImport(): void {
    setError(null);
    setImportDraft({
      bankAccountId: data.bankAccounts[0]?.id ?? "",
      fileName: "",
      content: "",
    });
    setImportOpen(true);
  }

  function openMatch(cashId: string): void {
    setError(null);
    setSelectedCashId(cashId);
    setSelectedStatementId(null);
  }

  function openException(cash: ReconciliationCashTransaction): void {
    setError(null);
    setExceptionReason(cash.exceptionReason ?? "");
    setSelectedCashId(null);
    setExceptionCashId(cash.id);
  }

  function openSuggestedMatch(statement: ReconciliationStatementRow): void {
    if (!statement.suggestedCashTransactionId) return;
    setError(null);
    setSelectedCashId(statement.suggestedCashTransactionId);
    setSelectedStatementId(statement.id);
  }

  function refresh(): void {
    router.refresh();
  }

  function changeView(view: ReconciliationView): void {
    updateUrlSearchParam("view", view === "statement" ? null : view, "replace");
  }

  async function selectCsvFile(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLocaleLowerCase("id-ID").endsWith(".csv")) {
      setError("Pilih file dengan format CSV.");
      return;
    }
    if (file.size > 1_000_000) {
      setError("Ukuran file rekening koran maksimal 1 MB.");
      return;
    }
    const content = await file.text();
    setError(null);
    setImportDraft((current) => ({
      ...current,
      fileName: file.name,
      content,
    }));
  }

  function downloadTemplate(): void {
    const content = [
      "tanggal,deskripsi,dana_masuk,dana_keluar",
      "2026-07-22,Pembayaran klien,1000000,",
      "2026-07-22,Biaya admin bank,,25000",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "template-rekening-koran-atria.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function submitImport(): void {
    setError(null);
    startTransition(async () => {
      const result = await importBankStatementCsv(importDraft);
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      const duplicateCopy = result.data.duplicateCount
        ? ` ${result.data.duplicateCount} baris duplikat dilewati.`
        : "";
      if (result.data.importedCount === 0) {
        toast.info(`Tidak ada mutasi baru.${duplicateCopy}`);
      } else {
        toast.success(`${result.data.importedCount} mutasi berhasil diimpor.${duplicateCopy}`);
      }
      setImportOpen(false);
      refresh();
    });
  }

  function submitManual(): void {
    setError(null);
    startTransition(async () => {
      const result = await recordBankStatementRow({
        bankAccountId: draft.bankAccountId,
        transactionDate: new Date(`${draft.transactionDate}T12:00:00`),
        description: draft.description,
        amount: Number(draft.amount),
        type: draft.type,
      });
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      toast.success("Mutasi rekening koran dicatat.");
      setManualOpen(false);
      refresh();
    });
  }

  function confirmMatch(): void {
    if (!selectedCash || !selectedStatement) return;
    setError(null);
    startTransition(async () => {
      const result = await reconcileCashTransaction({
        cashTransactionId: selectedCash.id,
        bankStatementRowId: selectedStatement.id,
      });
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      toast.success("Transaksi berhasil direkonsiliasi.");
      setSelectedCashId(null);
      setSelectedStatementId(null);
      refresh();
    });
  }

  function submitException(): void {
    if (!exceptionCash) return;
    setError(null);
    startTransition(async () => {
      const result = await markReconciliationException({
        cashTransactionId: exceptionCash.id,
        reason: exceptionReason,
      });
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      toast.success("Pengecualian rekonsiliasi dicatat.");
      setExceptionCashId(null);
      refresh();
    });
  }

  function removeException(cash: ReconciliationCashTransaction): void {
    setError(null);
    startTransition(async () => {
      const result = await clearReconciliationException({ cashTransactionId: cash.id });
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      toast.success("Pengecualian dihapus. Transaksi kembali perlu ditinjau.");
      setSelectedCashId(null);
      refresh();
    });
  }

  return (
    <div className="space-y-sm pb-8">
      <PageHeader title="Rekonsiliasi" subtitle="Cocokkan catatan Atria dengan mutasi bank." />

      <ReconciliationQueue
        data={data}
        activeView={activeView}
        onChangeView={changeView}
        onOpenImport={openImport}
        onOpenMatch={openMatch}
        onOpenSuggestedMatch={openSuggestedMatch}
        onSelectHistory={setSelectedHistoryId}
      />

      <ReconciliationHistorySheet
        selected={selectedHistory}
        onClose={() => setSelectedHistoryId(null)}
      />

      <OperationalFormSheet
        open={exceptionCash !== null}
        title="Catat pengecualian"
        submitLabel="Simpan alasan"
        submittingLabel="Menyimpan…"
        pending={pending}
        disabled={exceptionReason.trim().length < 10}
        statusText="Pengecualian tidak menandai transaksi sebagai cocok dengan bank."
        statusTone="warning"
        error={
          error ? (
            <p className="text-xs text-error" role="alert">
              {error}
            </p>
          ) : undefined
        }
        onClose={() => setExceptionCashId(null)}
        onSubmit={submitException}
      >
        {exceptionCash ? (
          <div className="space-y-4">
            <SheetMoneySummary
              amount={exceptionCash.amount}
              type={exceptionCash.type}
              label="Catatan belum cocok"
              meta={`${exceptionCash.bankAccountName} · ${formatDate(exceptionCash.createdAt)}`}
            />
            <FormSection
              title="Alasan pengecualian"
              helper="Jelaskan mengapa transaksi ini belum atau tidak akan terlihat pada rekening koran."
            >
              <EvidenceDescription
                icon="receipt_long"
                title={cashDisplayTitle(exceptionCash)}
                description={cashSourceCopy(exceptionCash, formatDate(exceptionCash.createdAt))}
              />
              <FormField label="Alasan" required>
                <Textarea
                  value={exceptionReason}
                  onChange={setExceptionReason}
                  placeholder="Contoh: transaksi internal antar kas yang tidak muncul sebagai mutasi rekening bank."
                />
              </FormField>
            </FormSection>
          </div>
        ) : null}
      </OperationalFormSheet>

      <OperationalFormSheet
        open={importOpen}
        title="Impor rekening koran"
        submitLabel="Impor"
        submittingLabel="Mengimpor…"
        pending={pending}
        disabled={!importDraft.bankAccountId || !importDraft.fileName || !importDraft.content}
        statusText="Impor hanya menambah data pembanding dan tidak mengubah saldo."
        statusTone="default"
        error={
          error ? (
            <p className="text-xs text-error" role="alert">
              {error}
            </p>
          ) : undefined
        }
        onClose={() => setImportOpen(false)}
        onSubmit={submitImport}
      >
        <FormSection
          title="File rekening koran"
          helper="Pilih rekening tujuan, lalu unggah CSV dengan format Atria."
          action={
            <button
              type="button"
              onClick={downloadTemplate}
              className="min-h-10 rounded-full bg-primary/8 px-3.5 text-[10px] font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-primary/12"
            >
              Unduh template
            </button>
          }
        >
          <SheetSelect
            label="Rekening"
            value={importDraft.bankAccountId}
            options={accountOptions}
            onChange={(bankAccountId) =>
              setImportDraft((current) => ({ ...current, bankAccountId }))
            }
            required
          />
          <div className="flex min-h-16 items-center gap-3 px-5 py-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-surface-container-low text-on-surface-variant ring-1 ring-ring-subtle"
              aria-hidden="true"
            >
              <AppIcon name="description" className="text-[18px] leading-none" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-on-surface">
                {importDraft.fileName || "Belum ada file"}
              </p>
              <p className="mt-0.5 text-meta text-on-surface-variant">
                CSV · maksimal 1 MB · maksimal 500 baris
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={selectCsvFile}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative inline-flex min-h-10 shrink-0 items-center rounded-full bg-surface-container-high px-3.5 text-[10px] font-semibold text-on-surface outline-none after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-surface-container-highest"
            >
              Pilih file
            </button>
          </div>
        </FormSection>

        <div className="flex items-start gap-2 px-1 text-meta text-on-surface-variant">
          <AppIcon name="info" className="mt-0.5 shrink-0 text-[15px] text-primary" />
          <p>
            Isi tanggal dan deskripsi, lalu tepat satu kolom dana_masuk atau dana_keluar. Ingin
            memasukkan satu transaksi saja?{" "}
            <button
              type="button"
              onClick={() => {
                setImportOpen(false);
                openManual();
              }}
              className="font-bold text-primary underline decoration-primary/25 underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              Catat manual
            </button>
            .
          </p>
        </div>
      </OperationalFormSheet>

      <OperationalFormSheet
        open={manualOpen}
        title="Catat mutasi bank"
        submitLabel="Simpan"
        submittingLabel="Menyimpan…"
        pending={pending}
        disabled={
          !draft.bankAccountId ||
          !draft.transactionDate ||
          !draft.description ||
          Number(draft.amount) <= 0
        }
        statusText="Salin data sesuai rekening koran."
        statusTone="default"
        error={
          error ? (
            <p className="text-xs text-error" role="alert">
              {error}
            </p>
          ) : undefined
        }
        onClose={() => setManualOpen(false)}
        onSubmit={submitManual}
      >
        <FormSection
          title="Rincian mutasi"
          helper="Salin satu transaksi persis seperti yang terlihat pada rekening koran."
        >
          <SheetSelect
            label="Rekening"
            value={draft.bankAccountId}
            options={accountOptions}
            onChange={(bankAccountId) => setDraft((current) => ({ ...current, bankAccountId }))}
            required
          />
          <DatePickerField
            label="Tanggal mutasi"
            value={draft.transactionDate}
            onChange={(transactionDate) => setDraft((current) => ({ ...current, transactionDate }))}
            required
          />
          <SheetSelect
            label="Arah mutasi"
            value={draft.type}
            options={[
              { value: "INFLOW", label: "Dana masuk" },
              { value: "OUTFLOW", label: "Dana keluar" },
            ]}
            onChange={(type) =>
              setDraft((current) => ({
                ...current,
                type: type === "OUTFLOW" ? "OUTFLOW" : "INFLOW",
              }))
            }
            required
          />
          <FormField label="Nominal" required>
            <MoneyInput
              value={draft.amount}
              onChange={(amount) => setDraft((current) => ({ ...current, amount }))}
            />
          </FormField>
          <FormField label="Deskripsi" required>
            <TextInput
              value={draft.description}
              onChange={(description) => setDraft((current) => ({ ...current, description }))}
              placeholder="Contoh: TRF masuk dari klien"
            />
          </FormField>
        </FormSection>
      </OperationalFormSheet>

      <WorkflowFormSheet
        open={selectedCash !== null}
        title="Cocokkan transaksi"
        primaryLabel="Cocokkan"
        secondaryLabel={selectedCash?.exceptionReason ? "Hapus pengecualian" : "Catat pengecualian"}
        pending={pending}
        disabled={!selectedStatement}
        disabledReason={reconcileDisabledReason}
        statusText={
          error ??
          (selectedCash?.exceptionReason
            ? "Transaksi ini memiliki pengecualian, tetapi tetap dapat dicocokkan jika bukti bank ditemukan."
            : "Pencocokan hanya mengubah status, bukan saldo.")
        }
        statusTone={error ? "danger" : "default"}
        actionLayout="stacked"
        onClose={() => setSelectedCashId(null)}
        onSecondary={() => {
          if (!selectedCash) return;
          if (selectedCash.exceptionReason) removeException(selectedCash);
          else openException(selectedCash);
        }}
        onPrimary={confirmMatch}
      >
        {selectedCash ? (
          <div className="space-y-4">
            <SheetMoneySummary
              amount={selectedCash.amount}
              type={selectedCash.type}
              label="Nominal yang akan dicocokkan"
              meta={`${selectedCash.bankAccountName} · ${directionCopy(selectedCash.type)}`}
            />

            <FormSection title="Catatan Atria" helper="Transaksi internal yang sedang ditinjau.">
              <EvidenceDescription
                icon="receipt_long"
                title={cashDisplayTitle(selectedCash)}
                description={cashSourceCopy(selectedCash, formatDate(selectedCash.createdAt))}
              />
              <EvidenceMetaRow label="Status" value={cashStatusCopy(selectedCash)} />
            </FormSection>

            <FormSection
              title="Mutasi bank"
              helper={
                matchingStatements.length === 1
                  ? "Satu pasangan ditemukan dan sudah dipilih."
                  : "Pilih bukti bank dengan rekening, arah, dan nominal yang sama."
              }
            >
              <SheetSelect
                label={matchingStatements.length === 1 ? "Pasangan terpilih" : "Pilih pasangan"}
                value={selectedStatementId ?? ""}
                options={matchingStatements.map((row: ReconciliationStatementRow) => ({
                  value: row.id,
                  label: row.description,
                  description: `${formatDate(row.transactionDate)} · ${row.bankAccountName}`,
                  meta: formatIdr(row.amount),
                }))}
                onChange={setSelectedStatementId}
                placeholder="Pilih pasangan"
                emptyText="Belum ada mutasi yang cocok."
                required
              />
              {selectedStatement ? (
                <EvidenceDescription
                  icon="account_balance"
                  title={selectedStatement.description}
                  description={`${formatDate(selectedStatement.transactionDate)} · ${selectedStatement.bankAccountName}`}
                />
              ) : null}
              {matchingStatements.length === 0 ? (
                <p className="px-5 py-3 text-meta font-medium text-warning">
                  Catat mutasi bank dengan rekening, arah, dan nominal yang sama.
                </p>
              ) : null}
            </FormSection>

            {selectedStatement ? (
              <p className="flex items-start gap-2 px-1 text-meta font-medium text-success">
                <AppIcon name="verified" className="mt-0.5 shrink-0 text-[14px] leading-none" />
                Rekening, arah dana, dan nominal sesuai. Periksa deskripsi dan tanggal sebelum
                mengonfirmasi.
              </p>
            ) : null}
          </div>
        ) : null}
      </WorkflowFormSheet>
    </div>
  );
}
