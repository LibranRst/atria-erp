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
import { statementMutationSchema } from "@atria/core/ai/bank-reconciliation";
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
  MoneyValue,
  OperationalFormSheet,
  PageHeader,
  AdaptiveSelect,
  Textarea,
  TextInput,
  WorkflowFormSheet,
  Button,
  ConfirmationDialog,
} from "@/components/ui";
import { formatIdr } from "@atria/core/utils/money";
import { updateUrlSearchParam, useBrowserUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { useRouter } from "@/lib/navigation/workspace-navigation";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";

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
import { StatementImportPreview, type StatementPreviewRow } from "./statement-import-preview";
import type {
  ReconciliationMatchContext,
  ReconciliationHistoryRow,
} from "@atria/core/finance/reconciliation-desktop";
import { readReconciliationMatchContext } from "../hooks/reconciliation-read-client";
import { ReconciliationDesktopWorkspace } from "./reconciliation-desktop-workspace";
import {
  ReconciliationMatchSummary,
  StatementDraftSummary,
  StatementImportSummary,
} from "./reconciliation-form-summary";

function validateImportRows(rows: readonly StatementPreviewRow[]): StatementPreviewRow[] {
  if (rows.length > 500) throw new Error("Maksimal 500 mutasi per berkas.");
  return rows.map((row, index) => {
    const parsed = statementMutationSchema.safeParse(row);
    if (!parsed.success)
      throw new Error(`Mutasi ${index + 1}: periksa tanggal, deskripsi, nominal, dan arah dana.`);
    return {
      transactionDate: parsed.data.transactionDate,
      description: parsed.data.description,
      amount: parsed.data.amount,
      type: parsed.data.type,
    };
  });
}

export function ReconciliationWorkspace({
  initialData,
}: {
  readonly initialData: ReconciliationWorkspaceData;
}): React.JSX.Element {
  const router = useRouter();
  const desktop = useWorkspacePresentation() === "desktop";
  const [desktopRevision, setDesktopRevision] = React.useState(0);
  const matchReturnFocusRef = React.useRef<HTMLElement | null>(null);
  const importFallbackFocusRef = React.useRef<HTMLDivElement | null>(null);
  const desktopRefreshToken = React.useMemo(
    () => ({ source: initialData, revision: desktopRevision }),
    [initialData, desktopRevision],
  );
  const [matchContext, setMatchContext] = React.useState<ReconciliationMatchContext | null>(null);
  const [desktopHistory, setDesktopHistory] = React.useState<ReconciliationHistoryRow | null>(null);
  const data = React.useMemo(
    (): ReconciliationWorkspaceData => ({
      ...initialData,
      cashTransactions: [
        ...new Map([
          ...initialData.cashTransactions.map((row) => [row.id, row] as const),
          ...(matchContext?.cashTransactions ?? []).map((row) => [row.id, row] as const),
        ]).values(),
      ],
      statementRows: [
        ...new Map([
          ...initialData.statementRows.map((row) => [row.id, row] as const),
          ...(matchContext?.statementRows ?? []).map((row) => [row.id, row] as const),
        ]).values(),
      ],
    }),
    [initialData, matchContext],
  );
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
  const [previewRows, setPreviewRows] = React.useState<StatementPreviewRow[]>([]);
  const [importPreviewPage, setImportPreviewPage] = React.useState(1);
  const [importPreviewPageSize, setImportPreviewPageSize] = React.useState<10 | 25 | 50>(10);
  const [hasReadImport, setHasReadImport] = React.useState(false);
  const [importReadPhase, setImportReadPhase] = React.useState<"idle" | "reading" | "analyzing">(
    "idle",
  );
  const isReadingImport = importReadPhase !== "idle";
  const importReadEpoch = React.useRef(0);
  const importReadPending = React.useRef(false);
  const importWritePending = React.useRef(false);
  const importOpenRef = React.useRef(false);
  const [importFileUrl, setImportFileUrl] = React.useState<string | null>(null);
  const [importManualConfirmOpen, setImportManualConfirmOpen] = React.useState(false);
  const [detectedBank, setDetectedBank] = React.useState<string | null>(null);
  const [detectedAccountNumber, setDetectedAccountNumber] = React.useState<string | null>(null);
  React.useEffect(
    () => () => {
      importReadEpoch.current += 1;
      importOpenRef.current = false;
    },
    [],
  );

  const selectedCash = data.cashTransactions.find((item) => item.id === selectedCashId) ?? null;
  const exceptionCash = data.cashTransactions.find((item) => item.id === exceptionCashId) ?? null;
  const selectedHistory =
    desktopHistory?.id === selectedHistoryId
      ? desktopHistory
      : (data.history.find((item) => item.id === selectedHistoryId) ?? null);
  const matchingStatements = selectedCash
    ? (matchContext?.statementRows ?? data.statementRows).filter(
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
    if (pending || importReadPending.current || importWritePending.current) return;
    setError(null);
    setDraft(newStatementDraft(data.bankAccounts[0]?.id ?? ""));
    setManualOpen(true);
  }

  function openImport(): void {
    if (pending || importWritePending.current) return;
    importReadEpoch.current += 1;
    importReadPending.current = false;
    importOpenRef.current = true;
    setError(null);
    setPreviewRows([]);
    setImportPreviewPage(1);
    setImportPreviewPageSize(10);
    setHasReadImport(false);
    setImportReadPhase("idle");
    setDetectedBank(null);
    setDetectedAccountNumber(null);
    setImportFileUrl(null);
    setImportManualConfirmOpen(false);
    setImportDraft({
      bankAccountId: data.bankAccounts[0]?.id ?? "",
      fileName: "",
      content: "",
    });
    setImportOpen(true);
  }

  function resetImport(preserveAccount: boolean = false): void {
    importReadEpoch.current += 1;
    importReadPending.current = false;
    setImportReadPhase("idle");
    setPreviewRows([]);
    setImportPreviewPage(1);
    setHasReadImport(false);
    setDetectedBank(null);
    setDetectedAccountNumber(null);
    setImportFileUrl(null);
    setError(null);
    setImportDraft((current) => ({
      bankAccountId: preserveAccount ? current.bankAccountId : (data.bankAccounts[0]?.id ?? ""),
      fileName: "",
      content: "",
    }));
  }

  function closeImport(): void {
    if (pending || importReadPending.current || importWritePending.current) return;
    importOpenRef.current = false;
    resetImport();
    setImportOpen(false);
  }

  function switchImportToManual(): void {
    if (pending || importReadPending.current || importWritePending.current) return;
    importOpenRef.current = false;
    resetImport();
    setImportManualConfirmOpen(false);
    setImportOpen(false);
    openManual();
  }

  function openMatch(cashId: string, statementId?: string): void {
    setError(null);
    if (desktop) {
      startTransition(async () => {
        try {
          const result = await readReconciliationMatchContext({ cashTransactionId: cashId });
          if (!result.success) {
            toast.error(result.error.message);
            return;
          }
          if (!result.data.cashTransactions.some((row) => row.id === cashId)) {
            toast.error("Catatan sudah berubah. Segarkan data sebelum mencocokkan.");
            return;
          }
          setMatchContext(result.data);
          setSelectedCashId(cashId);
          setSelectedStatementId(
            statementId ??
              (result.data.statementRows.length === 1
                ? (result.data.statementRows[0]?.id ?? null)
                : null),
          );
        } catch {
          toast.error("Pasangan belum dapat dimuat. Coba lagi.");
        }
      });
      return;
    }
    setMatchContext(null);
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
    if (desktop) {
      openMatch(statement.suggestedCashTransactionId, statement.id);
      return;
    }
    setError(null);
    setSelectedCashId(statement.suggestedCashTransactionId);
    setSelectedStatementId(statement.id);
  }

  function refresh(): void {
    setDesktopRevision((revision) => revision + 1);
    setMatchContext(null);
    setDesktopHistory(null);
    router.refresh();
  }

  function changeView(view: ReconciliationView): void {
    updateUrlSearchParam("view", view === "statement" ? null : view, "replace");
  }

  async function selectFile(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !importOpenRef.current || pending || importWritePending.current) return;
    const epoch = ++importReadEpoch.current;
    const current = (): boolean => importOpenRef.current && importReadEpoch.current === epoch;
    importReadPending.current = true;
    setImportReadPhase("reading");
    setPreviewRows([]);
    setImportPreviewPage(1);
    setHasReadImport(false);
    setImportFileUrl(null);
    setDetectedBank(null);
    setDetectedAccountNumber(null);
    setError(null);
    setImportDraft((current) => ({
      ...current,
      fileName: file.name,
    }));

    try {
      if (file.size > 10_000_000) throw new Error("Ukuran file mutasi maksimal 10 MB.");
      if (file.name.toLowerCase().endsWith(".csv")) {
        const content = await file.text();
        if (!current()) return;
        try {
          const rows = parseBankStatementCsv(content).map((row) => ({
            transactionDate: row.transactionDate.toISOString().slice(0, 10),
            description: row.description,
            amount: Number(row.amount),
            type: row.type,
          }));
          setPreviewRows(validateImportRows(rows));
          setHasReadImport(true);
          return;
        } catch (error: unknown) {
          if (!(error instanceof Error) || !error.message.startsWith("CSV_MISSING_HEADERS"))
            throw error;
          // Only a different source format proceeds to the document reader.
        }
      }
      if (!current()) return;
      setImportReadPhase("analyzing");
      const uploaded = await uploadToImageKit({
        file,
        folder: "/chat-attachments",
        purpose: "bank_statement",
        fileNamePrefix: "statement",
        subject: "rekening koran",
      });
      if (!current()) return;
      const res = await analyzeBankStatement({
        fileName: uploaded.fileName,
        fileUrl: uploaded.url,
        mimeType: uploaded.mimeType,
      });
      if (!current()) return;
      if (!res.success) throw new Error(res.error.message);

      setPreviewRows(
        validateImportRows(
          res.data.rows.map((r) => ({
            transactionDate: r.transactionDate,
            description: r.description,
            amount: r.amount,
            type: r.type,
          })),
        ),
      );
      setHasReadImport(true);
      setImportFileUrl(uploaded.url);
      setDetectedBank(res.data.detectedBankName ?? null);
      setDetectedAccountNumber(res.data.detectedAccountNumber ?? null);
    } catch (err: unknown) {
      if (!current()) return;
      setError(
        err instanceof Error
          ? err.message.replace(/^CSV_[A-Z_]+:\s*/, "")
          : "Berkas rekening koran belum dapat dibaca. Coba lagi.",
      );
    } finally {
      if (current()) {
        importReadPending.current = false;
        setImportReadPhase("idle");
      }
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
    if (
      pending ||
      importReadPending.current ||
      importWritePending.current ||
      !importOpenRef.current
    )
      return;
    if (!importDraft.bankAccountId) {
      setError("Pilih rekening tujuan.");
      return;
    }
    if (previewRows.length === 0) {
      setError("Belum ada mutasi yang siap diimpor.");
      return;
    }
    setError(null);
    importWritePending.current = true;
    startTransition(async () => {
      try {
        const result = await importParsedBankStatementRows({
          bankAccountId: importDraft.bankAccountId,
          fileName: importDraft.fileName || "Mutasi Rekening Koran",
          ...(importFileUrl ? { fileUrl: importFileUrl } : {}),
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
        importOpenRef.current = false;
        resetImport();
        refresh();
      } catch {
        setError("Mutasi belum dapat disimpan. Periksa koneksi dan coba lagi.");
      } finally {
        importWritePending.current = false;
      }
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
  const importDisabledReason = isReadingImport
    ? "Sedang membaca berkas rekening koran…"
    : !importDraft.bankAccountId
      ? "Pilih rekening tujuan."
      : previewRows.length === 0
        ? "Pilih file mutasi bank untuk dipratinjau terlebih dahulu."
        : undefined;
  const importInflow = previewRows
    .filter((row) => row.type === "INFLOW")
    .reduce((sum, row) => sum + row.amount, 0);
  const importOutflow = previewRows
    .filter((row) => row.type === "OUTFLOW")
    .reduce((sum, row) => sum + row.amount, 0);
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
    <div
      ref={importFallbackFocusRef}
      tabIndex={-1}
      aria-label="Rekonsiliasi"
      className={desktop ? "min-w-0 space-y-4 pb-8" : "space-y-sm pb-8"}
    >
      <div hidden={desktop} inert={desktop} className={desktop ? "hidden" : "space-y-sm"}>
        <PageHeader
          title="Rekonsiliasi"
          subtitle="Cocokkan catatan Paduna Build dengan mutasi bank."
        />

        <ReconciliationQueue
          data={initialData}
          activeView={activeView}
          onChangeView={changeView}
          onOpenImport={openImport}
          onOpenMatch={openMatch}
          onOpenSuggestedMatch={openSuggestedMatch}
          onSelectHistory={setSelectedHistoryId}
        />
      </div>
      <div hidden={!desktop} inert={!desktop} className={desktop ? "min-w-0" : "hidden"}>
        <ReconciliationDesktopWorkspace
          active={desktop}
          activeView={activeView}
          onChangeView={changeView}
          refreshToken={desktopRefreshToken}
          suspended={
            pending ||
            manualOpen ||
            importOpen ||
            selectedCashId !== null ||
            exceptionCashId !== null ||
            selectedHistoryId !== null
          }
          pending={pending}
          onOpenImport={openImport}
          onOpenManual={openManual}
          onOpenMatch={openMatch}
          matchReturnFocusRef={matchReturnFocusRef}
          onOpenHistory={(item) => {
            setDesktopHistory(item);
            setSelectedHistoryId(item.id);
          }}
        />
      </div>

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
          onDiscard: () => resetImport(),
          description: "Pratinjau mutasi rekening koran yang belum disimpan akan dibuang.",
        }}
        open={importOpen}
        title="Impor rekening koran"
        fallbackFocusRef={importFallbackFocusRef}
        desktopSize="wide"
        desktopFooterPlacement="aside"
        desktopAsideSummary={
          <StatementImportSummary
            accountName={
              data.bankAccounts.find((account) => account.id === importDraft.bankAccountId)?.name
            }
            fileName={importDraft.fileName}
            detectedBankName={detectedBank}
            detectedAccountNumber={detectedAccountNumber}
            rowCount={previewRows.length}
            inflow={importInflow}
            outflow={importOutflow}
            state={
              !hasReadImport && error
                ? "failed"
                : isReadingImport
                  ? "reading"
                  : hasReadImport
                    ? "ready"
                    : "unread"
            }
          />
        }
        submitLabel={
          previewRows.length > 0 ? `Simpan ${previewRows.length} Mutasi` : "Pilih Berkas"
        }
        submittingLabel={isReadingImport ? "Membaca berkas…" : "Menyimpan…"}
        pending={pending || isReadingImport}
        disabled={previewRows.length === 0 || !importDraft.bankAccountId || isReadingImport}
        disabledReason={importDisabledReason}
        statusText={
          error
            ? undefined
            : previewRows.length > 0
              ? `Periksa ${previewRows.length} mutasi sebelum disimpan sebagai bukti bank.`
              : "Unggah mutasi untuk dianalisis oleh AI atau format CSV standar Paduna Build."
        }
        statusTone={error ? "danger" : "default"}
        error={
          error ? (
            <p className="text-xs text-error" role="alert">
              {error}
            </p>
          ) : undefined
        }
        onClose={closeImport}
        onSubmit={submitImport}
      >
        <FormSection
          title="Rekening tujuan"
          helper="Pilih rekening bank tempat mutasi ini akan dicatat."
          action={
            <Button
              type="button"
              onClick={downloadTemplate}
              className="min-h-10 rounded-full bg-primary/8 px-3.5 text-meta font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-primary/12"
              variant="secondary"
              size="compact"
            >
              Unduh template
            </Button>
          }
        >
          <AdaptiveSelect
            label="Rekening"
            value={importDraft.bankAccountId}
            options={accountOptions}
            disabled={pending || isReadingImport}
            onChange={(bankAccountId) => {
              if (pending || importReadPending.current || importWritePending.current) return;
              setImportDraft((current) => ({ ...current, bankAccountId }));
            }}
            required
          />
        </FormSection>

        {isReadingImport ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-[22px] bg-surface-container-low p-8 text-center ring-1 ring-ring-subtle">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <AppIcon name="sync" className="icon-lg animate-spin leading-none" />
            </div>
            <div>
              <p className="text-row font-semibold text-on-surface">
                {importReadPhase === "analyzing"
                  ? "Menganalisis rekening koran…"
                  : "Membaca berkas rekening koran…"}
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
                disabled={pending || isReadingImport}
                onChange={selectFile}
              />
              <Button
                type="button"
                disabled={pending || isReadingImport}
                onClick={() => fileInputRef.current?.click()}
                className="relative inline-flex min-h-11 shrink-0 items-center rounded-full bg-primary px-4 text-meta font-semibold text-white shadow-control outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-primary/90"
                variant="primary"
                size="compact"
              >
                Pilih berkas
              </Button>
            </div>
          </FormSection>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-surface-container-high px-2.5 py-1 text-meta font-semibold text-on-surface">
                  {previewRows.length} baris terdeteksi
                </span>
                {detectedBank ? (
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-meta font-semibold text-primary">
                    Bank: {detectedBank}
                  </span>
                ) : null}
              </div>
              <Button
                type="button"
                variant="tertiary"
                size="compact"
                disabled={pending || isReadingImport}
                onClick={() => {
                  if (pending || importReadPending.current || importWritePending.current) return;
                  resetImport(true);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                Ganti berkas
              </Button>
            </div>

            {/* Inset metric cells */}
            {!desktop ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-[16px] bg-surface-container-lowest p-3 ring-1 ring-ring-subtle">
                  <p className="text-eyebrow font-semibold tracking-wider text-on-surface-variant uppercase">
                    Total Masuk
                  </p>
                  <MoneyValue
                    amount={importInflow}
                    fractionDigits={Number.isInteger(importInflow) ? 0 : 2}
                    variant="fullDynamic"
                    size="sm"
                    className="mt-1"
                  />
                </div>
                <div className="rounded-[16px] bg-surface-container-lowest p-3 ring-1 ring-ring-subtle">
                  <p className="text-eyebrow font-semibold tracking-wider text-on-surface-variant uppercase">
                    Total Keluar
                  </p>
                  <MoneyValue
                    amount={importOutflow}
                    fractionDigits={Number.isInteger(importOutflow) ? 0 : 2}
                    variant="fullDynamic"
                    size="sm"
                    className="mt-1"
                  />
                </div>
              </div>
            ) : null}

            {/* Tabel Baris Pratinjau */}
            {desktop ? (
              <StatementImportPreview
                rows={previewRows}
                pending={pending}
                page={importPreviewPage}
                pageSize={importPreviewPageSize}
                onPageChange={setImportPreviewPage}
                onPageSizeChange={(size) => {
                  setImportPreviewPageSize(size);
                  setImportPreviewPage(1);
                }}
                onToggleDirection={(index) => {
                  if (pending || importReadPending.current || importWritePending.current) return;
                  setPreviewRows((current) =>
                    current.map((row, rowIndex) =>
                      rowIndex === index
                        ? { ...row, type: row.type === "INFLOW" ? "OUTFLOW" : "INFLOW" }
                        : row,
                    ),
                  );
                }}
                onRemove={(index) => {
                  if (pending || importReadPending.current || importWritePending.current) return;
                  setPreviewRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
                }}
              />
            ) : (
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
                          <MoneyValue
                            amount={row.amount}
                            prefix={row.type === "INFLOW" ? "+ " : "- "}
                            fractionDigits={Number.isInteger(row.amount) ? 0 : 2}
                            variant="fullDynamic"
                            size="sm"
                            align="right"
                          />
                          <button
                            type="button"
                            disabled={pending || isReadingImport}
                            onClick={() =>
                              !pending &&
                              !importReadPending.current &&
                              !importWritePending.current &&
                              setPreviewRows((curr) =>
                                curr.map((r, i) =>
                                  i === idx
                                    ? { ...r, type: r.type === "INFLOW" ? "OUTFLOW" : "INFLOW" }
                                    : r,
                                ),
                              )
                            }
                            title="Klik untuk mengubah Masuk / Keluar"
                            className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-support font-bold transition hover:opacity-80 active:scale-[1.05] ${
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
                          disabled={pending || isReadingImport}
                          onClick={() => {
                            if (pending || importReadPending.current || importWritePending.current)
                              return;
                            setPreviewRows((curr) => curr.filter((_, i) => i !== idx));
                          }}
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
            )}
          </div>
        )}

        <div className="flex items-start gap-2 px-1 text-meta text-on-surface-variant">
          <AppIcon name="info" className="mt-0.5 icon-sm shrink-0 text-primary" />
          <p>
            AI membaca kolom tanggal, deskripsi, dan nominal secara otomatis. Ingin memasukkan satu
            transaksi saja?{" "}
            <button
              type="button"
              disabled={pending || isReadingImport}
              onClick={() => {
                if (pending || importReadPending.current || importWritePending.current) return;
                if (previewRows.length > 0 || importDraft.fileName)
                  setImportManualConfirmOpen(true);
                else switchImportToManual();
              }}
              className="font-bold text-primary underline decoration-primary/25 underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              Catat manual
            </button>
            .
          </p>
        </div>
      </OperationalFormSheet>

      <ConfirmationDialog
        open={importManualConfirmOpen}
        title="Beralih ke catatan manual?"
        fallbackFocusRef={importFallbackFocusRef}
        description="Pratinjau berkas yang belum disimpan akan dibuang. Belum ada mutasi bank atau saldo rekening yang berubah."
        confirmLabel="Beralih ke manual"
        onClose={() => setImportManualConfirmOpen(false)}
        onConfirm={switchImportToManual}
      />

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
        fallbackFocusRef={importFallbackFocusRef}
        desktopSize="wide"
        desktopFooterPlacement="aside"
        desktopAsideSummary={
          <StatementDraftSummary
            accountName={
              data.bankAccounts.find((account) => account.id === draft.bankAccountId)?.name
            }
            date={draft.transactionDate}
            type={draft.type}
            amount={draft.amount}
          />
        }
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
        returnFocusRef={desktop ? matchReturnFocusRef : undefined}
        desktopSize="wide"
        desktopFooterPlacement="aside"
        desktopAsideSummary={
          <ReconciliationMatchSummary
            cash={selectedCash}
            statement={selectedStatement}
            candidateCount={matchingStatements.length}
          />
        }
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
            {!desktop ? (
              <SheetMoneySummary
                amount={selectedCash.amount}
                type={selectedCash.type}
                label="Nominal yang akan dicocokkan"
                meta={`${selectedCash.bankAccountName} · ${directionCopy(selectedCash.type)}`}
              />
            ) : null}

            <FormSection
              title="Catatan Paduna Build"
              helper="Transaksi internal yang sedang ditinjau."
            >
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
