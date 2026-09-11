"use client";

import type {
  ReconciliationCashTransaction,
  ReconciliationStatementRow,
  ReconciliationWorkspace,
} from "@/app/actions/finance/reconciliation-workspace";
import {
  AppIcon,
  GroupedSurface,
  SegmentedTabs,
  SummaryFact,
  SummarySurface,
} from "@/components/ui";
import {
  cashDisplayTitle,
  cashRowMetaCopy,
  cashSourceCopy,
} from "@/features/reconciliation/utils/reconciliation-cash-copy";
import {
  cashTransactionNeedsAction,
  statementRowNeedsAction,
} from "@/features/reconciliation/utils/reconciliation-presentation";
import { formatIdr } from "@atria/core/utils/money";
import {
  directionCopy,
  formatReconciliationDate,
  ReconciliationEmptyState,
  ReconciliationHistoryRow,
  ReconciliationRow,
  type ReconciliationView,
} from "./reconciliation-primitives";

interface ReconciliationQueueProps {
  readonly data: ReconciliationWorkspace;
  readonly activeView: ReconciliationView;
  readonly onChangeView: (view: ReconciliationView) => void;
  readonly onOpenImport: () => void;
  readonly onOpenMatch: (cashId: string) => void;
  readonly onOpenSuggestedMatch: (statement: ReconciliationStatementRow) => void;
  readonly onSelectHistory: (historyId: string) => void;
}

export function ReconciliationQueue({
  data,
  activeView,
  onChangeView,
  onOpenImport,
  onOpenMatch,
  onOpenSuggestedMatch,
  onSelectHistory,
}: ReconciliationQueueProps): React.JSX.Element {
  const actionableCashTransactions = data.cashTransactions.filter(cashTransactionNeedsAction);
  const passiveCashTransactions = data.cashTransactions.filter(
    (item) => !cashTransactionNeedsAction(item),
  );
  const actionableStatementRows = data.statementRows.filter(statementRowNeedsAction);
  const passiveStatementRows = data.statementRows.filter((item) => !statementRowNeedsAction(item));
  const actionRequiredCount = actionableCashTransactions.length;

  function renderCashRow(
    item: ReconciliationCashTransaction,
    presentation: "card" | "grouped" = "grouped",
  ): React.JSX.Element {
    return (
      <ReconciliationRow
        key={item.id}
        title={cashDisplayTitle(item)}
        context={cashSourceCopy(item, formatReconciliationDate(item.createdAt))}
        status={cashRowMetaCopy(item)}
        statusTone={item.exceptionReason ? "warning" : item.ageDays > 3 ? "warning" : "neutral"}
        amount={item.amount}
        type={item.type}
        presentation={presentation}
        onClick={() => onOpenMatch(item.id)}
        ariaLabel={`Cocokkan ${cashDisplayTitle(item)}, ${item.source ? `${item.source.label} dari ${item.source.projectName}, ` : ""}${directionCopy(item.type)}, ${formatIdr(item.amount)}`}
      />
    );
  }

  function renderStatementRow(
    item: ReconciliationStatementRow,
    presentation: "card" | "grouped" = "grouped",
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
        context={`${item.bankAccountName} · ${formatReconciliationDate(item.transactionDate)}`}
        status={status}
        statusTone={suggested ? "success" : hasMultipleCandidates ? "warning" : "neutral"}
        amount={item.amount}
        type={item.type}
        presentation={presentation}
        interactive={interactive}
        onClick={
          suggested
            ? () => onOpenSuggestedMatch(item)
            : hasMultipleCandidates
              ? () => onChangeView("cash")
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
    <>
      <SummarySurface
        ariaLabel="Antrean rekonsiliasi"
        eyebrow="Rekonsiliasi"
        icon="account_balance"
        status={actionRequiredCount > 0 ? "Perlu ditinjau" : "Terkendali"}
        statusTone={actionRequiredCount > 0 ? "warning" : "positive"}
      >
        <div className="flex items-end justify-between gap-4 px-3.5 pt-3.5 pb-2">
          <div className="min-w-0">
            <p className="financial-amount text-[36px] leading-none font-extrabold tracking-[-0.045em] text-on-surface tabular-nums max-[430px]:text-[32px]">
              {actionRequiredCount}
            </p>
            <p className="text-meta font-semibold text-on-surface-variant">
              transaksi perlu tindakan
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 px-2 pb-2">
          <SummaryFact label="Mutasi bank" value={String(data.statementRows.length)} />
          <SummaryFact label="Sudah cocok" value={String(data.historyTotal)} />
        </div>
      </SummarySurface>

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
          { value: "history", label: "Riwayat" },
        ]}
        onChange={onChangeView}
        ariaLabel="Sumber rekonsiliasi"
        density="compact"
        layoutId="reconciliation-source-tabs"
      />

      <section className="space-y-2">
        <div className="flex min-h-11 items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <h2 className="truncate text-section font-bold tracking-[-0.015em] text-on-surface">
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
            <p className="mt-0.5 truncate text-meta text-on-surface-variant">
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
              onClick={onOpenImport}
              className="relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 text-meta font-semibold text-on-primary outline-none after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-primary/88"
            >
              <AppIcon name="upload_file" className="text-[15px]" />
              Import
            </button>
          ) : null}
        </div>

        <div className="space-y-3">
          {activeView === "history" ? (
            <GroupedSurface className="divide-y divide-black/5.5">
              {data.history.length === 0 ? (
                <ReconciliationEmptyState kind="history" />
              ) : (
                data.history.map((item) => (
                  <ReconciliationHistoryRow
                    key={item.id}
                    item={item}
                    onClick={() => onSelectHistory(item.id)}
                  />
                ))
              )}
            </GroupedSurface>
          ) : activeView === "cash" ? (
            data.cashTransactions.length === 0 ? (
              <GroupedSurface className="divide-y divide-black/5.5">
                <ReconciliationEmptyState kind="cash" />
              </GroupedSurface>
            ) : (
              <div className="space-y-sm">
                {actionableCashTransactions.length > 0 ? (
                  <GroupedSurface className="divide-y divide-black/5.5">
                    {actionableCashTransactions.map((item) => renderCashRow(item, "grouped"))}
                  </GroupedSurface>
                ) : null}
                {passiveCashTransactions.length > 0 ? (
                  <div className="space-y-2">
                    <p className="px-1 text-meta font-bold tracking-[0.08em] text-on-surface-variant/65 uppercase">
                      Pengecualian dicatat
                    </p>
                    <GroupedSurface className="divide-y divide-black/5.5">
                      {passiveCashTransactions.map((item) => renderCashRow(item, "grouped"))}
                    </GroupedSurface>
                  </div>
                ) : null}
              </div>
            )
          ) : data.statementRows.length === 0 ? (
            <GroupedSurface className="divide-y divide-black/5.5">
              <ReconciliationEmptyState kind="statement" />
            </GroupedSurface>
          ) : (
            <div className="space-y-sm">
              {actionableStatementRows.length > 0 ? (
                <GroupedSurface className="divide-y divide-black/5.5">
                  {actionableStatementRows.map((item) => renderStatementRow(item, "grouped"))}
                </GroupedSurface>
              ) : null}
              {passiveStatementRows.length > 0 ? (
                <div className="space-y-2">
                  <p className="px-1 text-meta font-bold tracking-[0.08em] text-on-surface-variant/65 uppercase">
                    Belum ada kandidat
                  </p>
                  <GroupedSurface className="divide-y divide-black/5.5">
                    {passiveStatementRows.map((item) => renderStatementRow(item, "grouped"))}
                  </GroupedSurface>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
