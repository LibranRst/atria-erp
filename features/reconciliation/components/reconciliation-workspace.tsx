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
  BottomSheet,
  DatePickerField,
  FormField,
  FormSection,
  MoneyInput,
  OperationalFormSheet,
  SheetSelect,
  TextInput,
  Textarea,
  useSheetPresenceValue,
  WorkflowFormSheet,
} from "@/components/ui";
import { MoneyValue, PageHeader } from "@/components/ui/feedback/page-primitives";
import { SegmentedTabs } from "@/components/ui/navigation/segmented-tabs";
import { formatIdr } from "@/lib/utils/money";
import { formatIsoDate } from "@/components/ui/form/form-control-utils";
import { updateUrlSearchParam, useBrowserUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { useRouter } from "next/navigation";
import type { CashDirection } from "@/lib/finance/cash-direction";
import { AppIcon } from "@/components/ui/icon/app-icon";
import {
  cashDisplayTitle,
  cashRowMetaCopy,
  cashSourceCopy,
  cashStatusCopy,
} from "@/features/reconciliation/utils/reconciliation-cash-copy";
import {
  cashTransactionNeedsAction,
  statementRowNeedsAction,
} from "@/features/reconciliation/utils/reconciliation-presentation";

type ReconciliationView = "cash" | "statement" | "history";

type StatementDraft = {
  readonly bankAccountId: string;
  readonly transactionDate: string;
  readonly description: string;
  readonly amount: string;
  readonly type: CashDirection;
};

type ImportDraft = {
  readonly bankAccountId: string;
  readonly fileName: string;
  readonly content: string;
};

function newStatementDraft(bankAccountId: string): StatementDraft {
  return {
    bankAccountId,
    transactionDate: formatIsoDate(new Date()),
    description: "",
    amount: "",
    type: "INFLOW",
  };
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function directionCopy(type: CashDirection): string {
  return type === "INFLOW" ? "Dana masuk" : "Dana keluar";
}

function directionIcon(type: CashDirection): string {
  return type === "INFLOW" ? "south_west" : "north_east";
}

function EmptyState({
  kind,
}: {
  readonly kind: "cash" | "statement" | "history";
}): React.JSX.Element {
  const statement = kind === "statement";
  const history = kind === "history";
  return (
    <div className="flex min-h-30 items-center gap-3 px-4 py-5">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ring-1 ${statement ? "bg-surface-container-low text-on-surface-variant ring-black/[0.035]" : "bg-success/8 text-success ring-success/6"}`}
        aria-hidden="true"
      >
        <AppIcon name={history ? "history" : statement ? "receipt_long" : "check_circle"} className="text-[19px] leading-none" />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-on-surface">
          {history
            ? "Belum ada riwayat"
            : statement
              ? "Belum ada mutasi bank"
              : "Semua catatan sudah cocok"}
        </p>
        <p className="mt-0.5 text-[10px] leading-4 text-on-surface-variant">
          {history
            ? "Pasangan yang sudah dikonfirmasi akan tersimpan di sini."
            : statement
              ? "Impor CSV rekening koran untuk menemukan pasangan secara otomatis."
              : "Tidak ada transaksi internal yang perlu ditinjau."}
        </p>
      </div>
    </div>
  );
}

function ReconciliationRow({
  title,
  context,
  status,
  statusTone = "neutral",
  amount,
  type,
  interactive = true,
  presentation = "grouped",
  onClick,
  ariaLabel,
}: {
  readonly title: string;
  readonly context: string;
  readonly status: string;
  readonly statusTone?: "neutral" | "success" | "warning";
  readonly amount: number;
  readonly type: CashDirection;
  readonly interactive?: boolean;
  readonly presentation?: "card" | "grouped";
  readonly onClick?: () => void;
  readonly ariaLabel?: string;
}): React.JSX.Element {
  const statusClass =
    statusTone === "success"
      ? "text-success"
      : statusTone === "warning"
        ? "text-warning"
        : "text-on-surface-variant/65";
  const content = (
    <>
      <span className="flex min-w-0 items-start gap-3">
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[13px] leading-5 font-semibold tracking-[-0.01em] text-on-surface">
            {title}
          </span>
          <span className="mt-1 block truncate text-[10px] leading-4 font-medium text-on-surface-variant/70">
            {context}
          </span>
        </span>
        {interactive ? (
          <span
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center text-on-surface-variant/38"
            aria-hidden="true"
          >
            <AppIcon name="chevron_right" className="text-[18px] leading-none" />
          </span>
        ) : null}
      </span>

      <span className="mt-3 flex min-w-0 items-center justify-between gap-3 border-t border-black/5 pt-2.5">
        <span
          className={`flex max-w-[42%] min-w-0 items-center gap-1.5 text-[10px] leading-4 font-semibold ${statusClass}`}
        >
          <AppIcon name={statusTone === "success"
              ? "check_circle"
              : statusTone === "warning"
                ? "error"
                : directionIcon(type)} className="shrink-0 text-[14px] leading-none" />
          <span className="truncate">{status}</span>
        </span>
        <MoneyValue
          amount={amount}
          variant="fullDynamic"
          prefix={type === "INFLOW" ? "+" : "-"}
          tone={type === "INFLOW" ? "primary" : "danger"}
          align="right"
          size="sm"
          className="min-w-0 flex-1"
        />
      </span>
    </>
  );

  const className = `block min-h-25 w-full px-4 py-3.5 text-left outline-none transition-colors focus-visible:bg-surface-container-low active:bg-surface-container-low/70 ${
    presentation === "card"
      ? "overflow-hidden rounded-[26px] bg-white shadow-[0_1px_2px_rgba(17,17,17,0.025),0_12px_30px_rgba(17,17,17,0.05)] ring-1 ring-black/3"
      : ""
  }`;

  if (!interactive) return <div className={className}>{content}</div>;

  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={className}>
      {content}
    </button>
  );
}

function ReconciliationHistoryRow({
  item,
  onClick,
}: {
  readonly item: ReconciliationWorkspaceData["history"][number];
  readonly onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Buka riwayat ${item.cashDescription}, ${formatIdr(item.amount)}`}
      className="block min-h-27 w-full px-4 py-3.5 text-left transition-colors outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low/70"
    >
      <span className="flex min-w-0 items-start gap-3">
        <span className="min-w-0 flex-1 space-y-1.5">
          <span className="flex min-w-0 items-center gap-2">
            <AppIcon name="receipt_long" className="shrink-0 text-[14px] leading-none text-on-surface-variant/55" />
            <span className="truncate text-[12px] leading-4 font-semibold text-on-surface">
              {item.cashDescription}
            </span>
          </span>
          <span className="flex min-w-0 items-center gap-2 pl-0.5">
            <AppIcon name="link" className="shrink-0 text-[13px] leading-none text-success" />
            <span className="truncate text-[11px] leading-4 font-medium text-on-surface-variant/75">
              {item.statementDescription}
            </span>
          </span>
        </span>
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center text-on-surface-variant/38"
          aria-hidden="true"
        >
          <AppIcon name="chevron_right" className="text-[18px] leading-none" />
        </span>
      </span>

      <span className="mt-3 flex min-w-0 items-center justify-between gap-3 border-t border-black/5 pt-2.5">
        <span className="flex max-w-[42%] min-w-0 items-center gap-1.5 text-[10px] leading-4 font-semibold text-success">
          <AppIcon name="check_circle" className="shrink-0 text-[14px] leading-none" />
          <span className="truncate">Cocok {formatDate(item.reconciledAt)}</span>
        </span>
        <MoneyValue
          amount={item.amount}
          variant="fullDynamic"
          prefix={item.type === "INFLOW" ? "+" : "-"}
          tone={item.type === "INFLOW" ? "primary" : "danger"}
          align="right"
          size="sm"
          className="min-w-0 flex-1"
        />
      </span>
    </button>
  );
}

function ReconciliationGroupedSurface({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="divide-y divide-black/5.5 overflow-hidden rounded-[26px] bg-white/88 shadow-[0_1px_2px_rgba(17,17,17,0.025),0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/2.5 max-[430px]:rounded-3xl">
      {children}
    </div>
  );
}

function SheetMoneySummary({
  amount,
  type,
  label,
  meta,
  confirmed = false,
}: {
  readonly amount: number;
  readonly type: CashDirection;
  readonly label: string;
  readonly meta: string;
  readonly confirmed?: boolean;
}): React.JSX.Element {
  return (
    <section className="px-1 py-1 text-center" aria-label={label}>
      <p
        className={`flex items-center justify-center gap-1.5 text-[10px] leading-4 font-bold ${confirmed ? "text-success" : "text-on-surface-variant"}`}
      >
        <AppIcon name={confirmed ? "check_circle" : directionIcon(type)} className="text-[15px] leading-none" />
        {label}
      </p>
      <MoneyValue
        amount={amount}
        variant="fullDynamic"
        prefix={type === "INFLOW" ? "+" : "-"}
        tone={type === "INFLOW" ? "primary" : "danger"}
        align="center"
        size="hero"
        className="mx-auto mt-2 w-full"
      />
      <p className="mt-1.5 text-[10px] leading-4 font-medium text-on-surface-variant/70">{meta}</p>
    </section>
  );
}

function EvidenceDescription({
  icon,
  title,
  description,
}: {
  readonly icon: string;
  readonly title: string;
  readonly description: string;
}): React.JSX.Element {
  return (
    <div className="flex min-h-17 items-start gap-3 px-4 py-3.5">
      <AppIcon name={icon} className="mt-0.5 shrink-0 text-[17px] leading-none text-on-surface-variant/55" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] leading-5 font-semibold text-on-surface">{title}</span>
        <span className="mt-0.5 block text-[10px] leading-4 font-medium text-on-surface-variant/70">
          {description}
        </span>
      </span>
    </div>
  );
}

function EvidenceMetaRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): React.JSX.Element {
  return (
    <div className="flex min-h-12 items-start justify-between gap-4 px-4 py-3">
      <span className="shrink-0 text-[10px] leading-4 font-medium text-on-surface-variant">
        {label}
      </span>
      <span className="min-w-0 text-right text-[11px] leading-4 font-semibold wrap-break-word text-on-surface">
        {value}
      </span>
    </div>
  );
}

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
  const { presentedValue: presentedHistory, handleExitComplete: handleHistoryExitComplete } =
    useSheetPresenceValue(selectedHistory, selectedHistoryId);
  const actionableCashTransactions = data.cashTransactions.filter(cashTransactionNeedsAction);
  const passiveCashTransactions = data.cashTransactions.filter(
    (item) => !cashTransactionNeedsAction(item),
  );
  const actionableStatementRows = data.statementRows.filter(statementRowNeedsAction);
  const passiveStatementRows = data.statementRows.filter((item) => !statementRowNeedsAction(item));
  const actionRequiredCount = actionableCashTransactions.length;
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

  function renderCashRow(
    item: ReconciliationCashTransaction,
    presentation: "card" | "grouped",
  ): React.JSX.Element {
    return (
      <ReconciliationRow
        key={item.id}
        title={cashDisplayTitle(item)}
        context={cashSourceCopy(item, formatDate(item.createdAt))}
        status={cashRowMetaCopy(item)}
        statusTone={item.exceptionReason ? "warning" : item.ageDays > 3 ? "warning" : "neutral"}
        amount={item.amount}
        type={item.type}
        presentation={presentation}
        onClick={() => openMatch(item.id)}
        ariaLabel={`Cocokkan ${cashDisplayTitle(item)}, ${item.source ? `${item.source.label} dari ${item.source.projectName}, ` : ""}${directionCopy(item.type)}, ${formatIdr(item.amount)}`}
      />
    );
  }

  function renderStatementRow(
    item: ReconciliationStatementRow,
    presentation: "card" | "grouped",
  ): React.JSX.Element {
    const suggested = item.suggestedCashTransactionId !== null;
    const hasMultipleCandidates = item.candidateCount > 1;
    const interactive = suggested || hasMultipleCandidates;
    const status = suggested
      ? "Pasangan ditemukan"
      : hasMultipleCandidates
        ? `${item.candidateCount} kandidat — tinjau Catatan Atria`
        : `${directionCopy(item.type)} · Belum ada pasangan`;

    return (
      <ReconciliationRow
        key={item.id}
        title={item.description}
        context={`${item.bankAccountName} · ${formatDate(item.transactionDate)}`}
        status={status}
        statusTone={suggested ? "success" : hasMultipleCandidates ? "warning" : "neutral"}
        amount={item.amount}
        type={item.type}
        presentation={presentation}
        interactive={interactive}
        onClick={
          suggested
            ? () => openSuggestedMatch(item)
            : hasMultipleCandidates
              ? () => changeView("cash")
              : undefined
        }
        ariaLabel={
          suggested
            ? `Tinjau pasangan ${item.description}, ${formatIdr(item.amount)}`
            : hasMultipleCandidates
              ? `Tinjau ${item.candidateCount} kandidat untuk ${item.description} di Catatan Atria`
              : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-5 pb-8 max-[430px]:space-y-4">
      <PageHeader title="Rekonsiliasi" subtitle="Cocokkan catatan Atria dengan mutasi bank." />

      <section
        className="rounded-[26px] bg-white/88 p-4 shadow-[0_1px_2px_rgba(17,17,17,0.025),0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/2.5 max-[430px]:rounded-3xl max-[430px]:p-3.5"
        aria-label="Antrean rekonsiliasi"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-container-high/65 text-on-surface-variant ring-1 ring-black/[0.035]">
              <AppIcon name="account_balance" className="text-[17px]" />
            </span>
            <p className="truncate text-[10px] font-bold tracking-[0.13em] text-on-surface-variant/60 uppercase">
              Antrean rekonsiliasi
            </p>
          </div>
          <span
            className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[9px] font-semibold ring-1 ${actionRequiredCount > 0 ? "bg-warning/9 text-warning ring-warning/8" : "bg-success/8 text-success ring-success/8"}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {actionRequiredCount > 0 ? "Perlu ditinjau" : "Terkendali"}
          </span>
        </div>

        <div className="mt-3.5 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[28px] leading-none font-black text-on-surface tabular-nums">
              {actionRequiredCount}
            </p>
            <p className="mt-1 text-[10px] font-semibold text-on-surface-variant">
              transaksi perlu tindakan
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[9px] font-semibold text-on-surface-variant/60">Sudah cocok</p>
            <p className="mt-1 font-mono text-sm font-black text-on-surface tabular-nums">
              {data.historyTotal}
            </p>
          </div>
        </div>

        <div className="mt-3.5 flex items-center gap-2 border-t border-black/5.5 pt-3 text-[10px] leading-4 text-on-surface-variant">
          <AppIcon name="verified_user" className="text-[16px] text-success" />
          <span>Pencocokan tidak mengubah saldo rekening.</span>
        </div>
      </section>

      <SegmentedTabs
        value={activeView}
        options={[
          {
            value: "statement",
            label: "Mutasi bank",
            count: data.statementRows.length > 0 ? data.statementRows.length : undefined,
          },
          {
            value: "cash",
            label: "Catatan Atria",
            count: actionRequiredCount > 0 ? actionRequiredCount : undefined,
          },
          {
            value: "history",
            label: "Riwayat",
          },
        ]}
        onChange={changeView}
        ariaLabel="Sumber rekonsiliasi"
        density="compact"
        layoutId="reconciliation-source-tabs"
      />

      <section className="space-y-2">
        <div className="flex min-h-11 items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] leading-5 font-bold tracking-[-0.015em] text-on-surface">
              {activeView === "history"
                ? "Sudah cocok"
                : activeView === "cash"
                  ? actionableCashTransactions.length > 0
                    ? "Perlu tindakan"
                    : "Belum cocok"
                  : actionableStatementRows.length > 0
                    ? "Perlu tindakan"
                    : "Belum cocok"}
            </h2>
            <p className="mt-0.5 truncate text-[10px] leading-4 text-on-surface-variant">
              {activeView === "cash"
                ? "Catatan yang siap dicocokkan ditampilkan lebih dahulu."
                : activeView === "history"
                  ? "Pasangan yang sudah dikonfirmasi."
                  : "Mutasi yang memiliki kandidat ditampilkan lebih dahulu."}
            </p>
          </div>
          {activeView === "statement" ? (
            <button
              type="button"
              onClick={openImport}
              className="relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 text-[10px] font-semibold text-on-primary outline-none after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] focus-visible:ring-2 focus-visible:ring-primary/30 active:bg-primary/88"
            >
              <AppIcon name="upload_file" className="text-[15px]" />
              Impor CSV
            </button>
          ) : null}
        </div>

        <div className="space-y-3">
          {activeView === "history" ? (
            <ReconciliationGroupedSurface>
              {data.history.length === 0 ? (
                <EmptyState kind="history" />
              ) : (
                data.history.map((item) => (
                  <ReconciliationHistoryRow
                    key={item.id}
                    item={item}
                    onClick={() => setSelectedHistoryId(item.id)}
                  />
                ))
              )}
            </ReconciliationGroupedSurface>
          ) : activeView === "cash" ? (
            data.cashTransactions.length === 0 ? (
              <ReconciliationGroupedSurface>
                <EmptyState kind="cash" />
              </ReconciliationGroupedSurface>
            ) : (
              <>
                {actionableCashTransactions.map((item) => renderCashRow(item, "card"))}
                {passiveCashTransactions.length > 0 ? (
                  <div className="space-y-2">
                    <p className="px-1 text-[10px] leading-4 font-bold tracking-[0.08em] text-on-surface-variant/65 uppercase">
                      Pengecualian dicatat
                    </p>
                    <ReconciliationGroupedSurface>
                      {passiveCashTransactions.map((item) => renderCashRow(item, "grouped"))}
                    </ReconciliationGroupedSurface>
                  </div>
                ) : null}
              </>
            )
          ) : data.statementRows.length === 0 ? (
            <ReconciliationGroupedSurface>
              <EmptyState kind="statement" />
            </ReconciliationGroupedSurface>
          ) : (
            <>
              {actionableStatementRows.map((item) => renderStatementRow(item, "card"))}
              {passiveStatementRows.length > 0 ? (
                <div className="space-y-2">
                  <p className="px-1 text-[10px] leading-4 font-bold tracking-[0.08em] text-on-surface-variant/65 uppercase">
                    Belum ada kandidat
                  </p>
                  <ReconciliationGroupedSurface>
                    {passiveStatementRows.map((item) => renderStatementRow(item, "grouped"))}
                  </ReconciliationGroupedSurface>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>

      <BottomSheet
        open={selectedHistory !== null}
        title="Detail rekonsiliasi"
        onClose={() => setSelectedHistoryId(null)}
        onExitComplete={handleHistoryExitComplete}
      >
        {presentedHistory ? (
          <div className="space-y-4">
            <SheetMoneySummary
              amount={presentedHistory.amount}
              type={presentedHistory.type}
              label="Sudah cocok"
              meta={`${formatDate(presentedHistory.reconciledAt)} · ${presentedHistory.reconciledByName}`}
              confirmed
            />

            <FormSection title="Catatan Atria" helper="Transaksi yang tercatat di dalam Atria.">
              <EvidenceDescription
                icon="receipt_long"
                title={presentedHistory.cashDescription}
                description={`${presentedHistory.bankAccountName} · ${directionCopy(presentedHistory.type)}`}
              />
              <EvidenceMetaRow
                label="Referensi bank"
                value={presentedHistory.bankReference || "Tidak dicatat"}
              />
            </FormSection>

            <FormSection title="Mutasi bank" helper="Bukti pada rekening koran yang dipasangkan.">
              <EvidenceDescription
                icon="account_balance"
                title={presentedHistory.statementDescription}
                description={`${formatDate(presentedHistory.transactionDate)} · ${presentedHistory.bankAccountName}`}
              />
              <EvidenceMetaRow label="Sumber data" value={presentedHistory.importFileName} />
            </FormSection>

            <p className="px-1 text-[10px] leading-4 text-on-surface-variant">
              Nominal, arah dana, dan rekening pada kedua catatan telah diverifikasi sebagai satu
              transaksi.
            </p>
          </div>
        ) : null}
      </BottomSheet>

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
              className="min-h-10 rounded-full bg-primary/8 px-3.5 text-[10px] font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary/25 active:bg-primary/12"
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
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-surface-container-low text-on-surface-variant ring-1 ring-black/[0.035]"
              aria-hidden="true"
            >
              <AppIcon name="description" className="text-[18px] leading-none" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-on-surface">
                {importDraft.fileName || "Belum ada file"}
              </p>
              <p className="mt-0.5 text-[10px] leading-4 text-on-surface-variant">
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
              className="relative inline-flex min-h-10 shrink-0 items-center rounded-full bg-surface-container-high px-3.5 text-[10px] font-semibold text-on-surface outline-none after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] focus-visible:ring-2 focus-visible:ring-primary/25 active:bg-surface-container-highest"
            >
              Pilih file
            </button>
          </div>
        </FormSection>

        <div className="flex items-start gap-2 px-1 text-[10px] leading-4 text-on-surface-variant">
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
              className="font-bold text-primary underline decoration-primary/25 underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
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
                <p className="px-5 py-3 text-[10px] leading-4 font-medium text-warning">
                  Catat mutasi bank dengan rekening, arah, dan nominal yang sama.
                </p>
              ) : null}
            </FormSection>

            {selectedStatement ? (
              <p className="flex items-start gap-2 px-1 text-[10px] leading-4 font-medium text-success">
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
