"use client";

import { uploadToImageKit } from "@/lib/media/upload-to-imagekit";

import React from "react";
import { toast } from "sonner";

import {
  importParsedBankStatementRows,
  recordBankStatementRow,
  type ReconciliationCashTransaction,
  type ReconciliationStatementRow,
  type ReconciliationWorkspace as ReconciliationWorkspaceData,
} from "@/app/actions/finance/reconciliation-workspace";
import { analyzeBankStatement } from "@/app/actions/finance/analyze-bank-statement";
import { parseBankStatementCsv } from "@atria/core/finance/bank-statement-csv";
import {
  clearReconciliationException,
  markReconciliationException,
  reconcileCashTransaction,
} from "@/app/actions/finance/reconcile-cash-transaction";
import {
  AppIcon,
  DatePickerField,
  FormField,
  FormSection,
  MoneyInput,
  OperationalFormSheet,
  PageHeader,
  AdaptiveSelect,
  Textarea,
  TextInput,
  WorkflowFormSheet,
} from "@/components/ui";
import { formatIdr } from "@atria/core/utils/money";
import { updateUrlSearchParam, useBrowserUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { useRouter } from "@/lib/navigation/workspace-navigation";

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
  const [previewRows, setPreviewRows] = React.useState<
    Array<{
      transactionDate: string;
      description: string;
      amount: number;
      type: "INFLOW" | "OUTFLOW";
    }>
  >([]);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [detectedBank, setDetectedBank] = React.useState<string | null>(null);

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
    setPreviewRows([]);
    setIsAnalyzing(false);
    setDetectedBank(null);
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

  async function selectFile(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10_000_000) {
      setError("Ukuran file mutasi maksimal 10 MB.");
      return;
    }
    setError(null);
    setImportDraft((current) => ({
      ...current,
      fileName: file.name,
    }));

    const lowerName = file.name.toLowerCase();
    const isCsv = lowerName.endsWith(".csv");

    if (isCsv) {
      const content = await file.text();
      try {
        const parsed = parseBankStatementCsv(content);
        const rows = parsed.map((r) => ({
          transactionDate: r.transactionDate.toISOString().slice(0, 10),
          description: r.description,
          amount: Number(r.amount),
          type: r.type,
        }));
        setPreviewRows(rows);
        setDetectedBank(null);
        return;
      } catch {
        // Format CSV bank non-standar, teruskan ke AI
      }
    }

    setIsAnalyzing(true);
    try {
      const uploaded = await uploadToImageKit({
        file,
        folder: "/chat-attachments",
        purpose: "bank_statement",
        fileNamePrefix: "statement",
        subject: "rekening koran",
      });
      const res = await analyzeBankStatement({
        fileName: uploaded.fileName,
        fileUrl: uploaded.url,
        mimeType: uploaded.mimeType,
      });

      if (!res.success) {
        setError(res.error.message);
        return;
      }

      setPreviewRows(
        res.data.rows.map((r) => ({
          transactionDate: r.transactionDate,
          description: r.description,
          amount: r.amount,
          type: r.type,
        })),
      );
      setDetectedBank(res.data.detectedBankName ?? null);

      if (res.data.detectedBankName) {
        const matched = data.bankAccounts.find(
          (acc) =>
            acc.bankName.toLowerCase().includes(res.data.detectedBankName!.toLowerCase()) ||
            acc.name.toLowerCase().includes(res.data.detectedBankName!.toLowerCase()),
        );
        if (matched) {
          setImportDraft((curr) => ({ ...curr, bankAccountId: matched.id }));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menganalisis berkas rekening koran.");
    } finally {
      setIsAnalyzing(false);
    }
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
    if (previewRows.length === 0) {
      setError("Belum ada mutasi yang siap diimpor.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await importParsedBankStatementRows({
        bankAccountId: importDraft.bankAccountId,
        fileName: importDraft.fileName || "Mutasi Rekening Koran",
        rows: previewRows.map((r) => ({
          transactionDate: new Date(r.transactionDate),
          description: r.description,
          amount: r.amount,
          type: r.type,
        })),
      });
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
      setPreviewRows([]);
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

  // Setiap sheet di aplikasi ini menjelaskan mengapa action utamanya nonaktif;
  // tanpa itu tombol mati terlihat seperti kerusakan. Aturan panjang alasan
  // pengecualian khususnya tidak terlihat sama sekali dari layar.
  const exceptionDisabledReason =
    exceptionReason.trim().length < 10 ? "Tulis alasan minimal 10 karakter." : undefined;
  const importDisabledReason = isAnalyzing
    ? "Sedang menganalisis berkas rekening koran…"
    : !importDraft.bankAccountId
      ? "Pilih rekening tujuan."
      : previewRows.length === 0
        ? "Pilih file mutasi bank untuk dipratinjau terlebih dahulu."
        : undefined;
  const manualDisabledReason = !draft.bankAccountId
    ? "Pilih rekening mutasi."
    : !draft.transactionDate
      ? "Isi tanggal mutasi."
      : Number(draft.amount) <= 0
        ? "Isi nominal lebih dari 0."
        : !draft.description
          ? "Isi deskripsi sesuai rekening koran."
          : undefined;

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
        dismissal={{
          mode: "confirm",
          dirty: exceptionReason !== (exceptionCash?.exceptionReason ?? ""),
          onDiscard: () => setExceptionReason(exceptionCash?.exceptionReason ?? ""),
          description: "Alasan pengecualian yang belum disimpan akan hilang.",
        }}
        open={exceptionCash !== null}
        title="Catat pengecualian"
        submitLabel="Simpan alasan"
        submittingLabel="Menyimpan…"
        pending={pending}
        disabled={exceptionReason.trim().length < 10}
        disabledReason={exceptionDisabledReason}
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
        dismissal={{
          mode: "confirm",
          dirty: previewRows.length > 0 || Boolean(importDraft.fileName),
          onDiscard: () => {
            setImportDraft({
              bankAccountId: data.bankAccounts[0]?.id ?? "",
              fileName: "",
              content: "",
            });
            setPreviewRows([]);
          },
          description: "Pratinjau mutasi rekening koran yang belum disimpan akan dibuang.",
        }}
        open={importOpen}
        title="Impor rekening koran"
        submitLabel={
          previewRows.length > 0 ? `Simpan ${previewRows.length} Mutasi` : "Pilih Berkas"
        }
        submittingLabel="Menyimpan…"
        pending={pending || isAnalyzing}
        disabled={previewRows.length === 0 || !importDraft.bankAccountId || isAnalyzing}
        disabledReason={importDisabledReason}
        statusText={
          error
            ? undefined
            : previewRows.length > 0
              ? `Periksa ${previewRows.length} mutasi sebelum disimpan ke buku besar.`
              : "Unggah mutasi untuk dianalisis oleh AI atau format CSV standar Atria."
        }
        statusTone={error ? "danger" : "default"}
        error={
          error ? (
            <p className="text-xs text-error" role="alert">
              {error}
            </p>
          ) : undefined
        }
        onClose={() => {
          setImportOpen(false);
          setPreviewRows([]);
        }}
        onSubmit={submitImport}
      >
        <FormSection
          title="Rekening tujuan"
          helper="Pilih rekening bank tempat mutasi ini akan dicatat."
          action={
            <button
              type="button"
              onClick={downloadTemplate}
              className="min-h-10 rounded-full bg-primary/8 px-3.5 text-meta font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-primary/12"
            >
              Unduh template
            </button>
          }
        >
          <AdaptiveSelect
            label="Rekening"
            value={importDraft.bankAccountId}
            options={accountOptions}
            onChange={(bankAccountId) =>
              setImportDraft((current) => ({ ...current, bankAccountId }))
            }
            required
          />
        </FormSection>

        {isAnalyzing ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-[22px] bg-surface-container-low p-8 text-center ring-1 ring-ring-subtle">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <AppIcon name="sync" className="icon-lg animate-spin leading-none" />
            </div>
            <div>
              <p className="text-row font-semibold text-on-surface">
                Menganalisis rekening koran dengan AI…
              </p>
              <p className="mt-1 text-meta text-on-surface-variant">
                Mengekstrak baris transaksi dari {importDraft.fileName}
              </p>
            </div>
          </div>
        ) : previewRows.length === 0 ? (
          <FormSection
            title="Unggah berkas mutasi"
            helper="Pilih file CSV, spreadsheet Excel (.xlsx/.xls), PDF, atau gambar mutasi bank."
          >
            <div className="flex min-h-20 items-center gap-3 px-5 py-4">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-surface-container-low text-primary ring-1 ring-ring-subtle"
                aria-hidden="true"
              >
                <AppIcon name="upload_file" className="icon-lg leading-none" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-on-surface">
                  {importDraft.fileName || "Belum ada berkas"}
                </p>
                <p className="mt-0.5 text-meta text-on-surface-variant">
                  CSV · XLSX · XLS · PDF · JPG/PNG · Maks 10 MB
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,.pdf,application/pdf,image/*"
                className="sr-only"
                onChange={selectFile}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative inline-flex min-h-11 shrink-0 items-center rounded-full bg-primary px-4 text-meta font-semibold text-white shadow-control outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-primary/90"
              >
                Pilih berkas
              </button>
            </div>
          </FormSection>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-surface-container-high px-2.5 py-1 text-meta font-semibold text-on-surface">
                  {previewRows.length} baris terdeteksi
                </span>
                {detectedBank ? (
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-meta font-semibold text-primary">
                    Bank: {detectedBank}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPreviewRows([]);
                  setImportDraft((c) => ({ ...c, fileName: "" }));
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="text-meta font-semibold text-primary hover:underline"
              >
                Ganti berkas
              </button>
            </div>

            {/* Inset metric cells */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[16px] bg-surface-container-lowest p-3 ring-1 ring-ring-subtle">
                <p className="text-eyebrow font-semibold tracking-wider text-on-surface-variant uppercase">
                  Total Masuk
                </p>
                <p className="mt-1 text-row font-bold text-success">
                  {formatIdr(
                    previewRows
                      .filter((r) => r.type === "INFLOW")
                      .reduce((sum, r) => sum + r.amount, 0),
                  )}
                </p>
              </div>
              <div className="rounded-[16px] bg-surface-container-lowest p-3 ring-1 ring-ring-subtle">
                <p className="text-eyebrow font-semibold tracking-wider text-on-surface-variant uppercase">
                  Total Keluar
                </p>
                <p className="mt-1 text-row font-bold text-error">
                  {formatIdr(
                    previewRows
                      .filter((r) => r.type === "OUTFLOW")
                      .reduce((sum, r) => sum + r.amount, 0),
                  )}
                </p>
              </div>
            </div>

            {/* Tabel Baris Pratinjau */}
            <div className="overflow-hidden rounded-inset bg-white ring-1 ring-ring-subtle">
              <div className="border-b border-outline-variant/15 bg-surface-container-low/50 px-4 py-2.5 text-eyebrow font-semibold tracking-wider text-on-surface-variant uppercase">
                Pratinjau Mutasi Rekening Koran
              </div>
              <div className="max-h-64 divide-y divide-outline-variant/10 overflow-y-auto">
                {previewRows.map((row, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-on-surface">
                        {row.description}
                      </p>
                      <p className="mt-0.5 text-meta text-on-surface-variant">
                        {row.transactionDate}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5">
                      <div className="text-right">
                        <p
                          className={`text-xs font-bold tabular-nums ${
                            row.type === "INFLOW" ? "text-success" : "text-error"
                          }`}
                        >
                          {row.type === "INFLOW" ? "+" : "-"} {formatIdr(row.amount)}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewRows((curr) =>
                              curr.map((r, i) =>
                                i === idx
                                  ? { ...r, type: r.type === "INFLOW" ? "OUTFLOW" : "INFLOW" }
                                  : r,
                              ),
                            )
                          }
                          title="Klik untuk mengubah Masuk / Keluar"
                          className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition hover:opacity-80 active:scale-95 ${
                            row.type === "INFLOW"
                              ? "bg-success/10 text-success ring-1 ring-success/20"
                              : "bg-error/10 text-error ring-1 ring-error/20"
                          }`}
                        >
                          <span>{row.type === "INFLOW" ? "Masuk" : "Keluar"}</span>
                          <AppIcon name="swap_horiz" className="h-2.5 w-2.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewRows((curr) => curr.filter((_, i) => i !== idx))}
                        title="Hapus baris ini"
                        className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-error"
                      >
                        <AppIcon name="close" className="icon-xs leading-none" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 px-1 text-meta text-on-surface-variant">
          <AppIcon name="info" className="mt-0.5 icon-sm shrink-0 text-primary" />
          <p>
            AI membaca kolom tanggal, deskripsi, dan nominal secara otomatis. Ingin memasukkan satu
            transaksi saja?{" "}
            <button
              type="button"
              onClick={() => {
                setImportOpen(false);
                setPreviewRows([]);
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
        dismissal={{
          mode: "confirm",
          dirty:
            JSON.stringify(draft) !==
            JSON.stringify(newStatementDraft(data.bankAccounts[0]?.id ?? "")),
          onDiscard: () => setDraft(newStatementDraft(data.bankAccounts[0]?.id ?? "")),
          description: "Mutasi bank yang belum disimpan akan hilang.",
        }}
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
        disabledReason={manualDisabledReason}
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
          <AdaptiveSelect
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
          <AdaptiveSelect
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
        dismissal={{
          mode: "confirm",
          dirty: selectedStatementId !== null,
          onDiscard: () => setSelectedStatementId(null),
          description: "Pilihan pencocokan yang belum dikonfirmasi akan dibuang.",
        }}
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
              <AdaptiveSelect
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
                <AppIcon name="verified" className="mt-0.5 icon-xs shrink-0 leading-none" />
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
