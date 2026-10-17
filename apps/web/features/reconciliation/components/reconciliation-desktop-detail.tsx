"use client";

import type {
  ReconciliationCashTransaction,
  ReconciliationHistoryRow,
  ReconciliationStatementRow,
} from "@/app/actions/finance/reconciliation-workspace";
import { AppIcon, Button, FactRow, GroupedSurface, MoneyValue, StatusBadge } from "@/components/ui";
import { parseNumericToCents } from "@atria/core/finance/money-minor";
import type { CashDirection } from "@atria/core/finance/cash-direction";
import { cashDisplayTitle } from "../utils/reconciliation-cash-copy";
import { directionCopy, formatReconciliationDate } from "./reconciliation-primitives";

export type ReconciliationDesktopSelection =
  | {
      readonly kind: "cash";
      readonly item: ReconciliationCashTransaction;
      readonly statements: readonly ReconciliationStatementRow[];
    }
  | {
      readonly kind: "statement";
      readonly item: ReconciliationStatementRow;
      readonly cashTransactions: readonly ReconciliationCashTransaction[];
    }
  | { readonly kind: "history"; readonly item: ReconciliationHistoryRow };

export interface ReconciliationDesktopDetailProps {
  readonly selection: ReconciliationDesktopSelection;
  readonly pending: boolean;
  readonly onOpenMatch: (cashId: string, statementId?: string) => void;
  readonly onOpenHistory: (historyId: string) => void;
}

type ReconciliationEvidence = {
  readonly bankAccountId: string;
  readonly type: CashDirection;
  readonly amount: number;
};

function matchesEvidence(left: ReconciliationEvidence, right: ReconciliationEvidence): boolean {
  return (
    left.bankAccountId === right.bankAccountId &&
    left.type === right.type &&
    parseNumericToCents(left.amount.toFixed(2)) === parseNumericToCents(right.amount.toFixed(2))
  );
}

function formatConfirmationTime(value: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function DetailAmount({
  amount,
  type,
}: {
  readonly amount: number;
  readonly type: CashDirection;
}): React.JSX.Element {
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-support text-on-surface-variant">
        <AppIcon name={type === "INFLOW" ? "south_west" : "north_east"} className="icon-sm" />
        {directionCopy(type)}
      </p>
      <MoneyValue
        amount={amount}
        fractionDigits={Number.isInteger(amount) ? 0 : 2}
        variant="fullDynamic"
        size="lg"
      />
    </div>
  );
}

function CandidateEvidence({
  title,
  description,
  account,
  date,
  pending,
  onReview,
}: {
  readonly title: string;
  readonly description?: string;
  readonly account: string;
  readonly date: Date;
  readonly pending: boolean;
  readonly onReview: () => void;
}): React.JSX.Element {
  return (
    <div className="space-y-3 px-4 py-3">
      <div className="space-y-1">
        <p className="text-row font-semibold wrap-anywhere text-on-surface">{title}</p>
        {description ? (
          <p className="text-support wrap-anywhere text-on-surface-variant">{description}</p>
        ) : null}
        <p className="text-support wrap-anywhere text-on-surface-variant">
          {account} · {formatReconciliationDate(date)}
        </p>
      </div>
      <Button variant="secondary" size="compact" fullWidth disabled={pending} onClick={onReview}>
        Tinjau pasangan
      </Button>
    </div>
  );
}

function CashDetail({
  item,
  statements,
  pending,
  onOpenMatch,
}: {
  readonly item: ReconciliationCashTransaction;
  readonly statements: readonly ReconciliationStatementRow[];
  readonly pending: boolean;
  readonly onOpenMatch: ReconciliationDesktopDetailProps["onOpenMatch"];
}): React.JSX.Element {
  const candidates = statements.filter((statement) => matchesEvidence(item, statement));
  return (
    <div className="grid min-w-0 items-start gap-4 @2xl:grid-cols-2">
      <GroupedSurface variant="desktopPanel" className="min-w-0 overflow-hidden">
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-row font-bold">Catatan Paduna Build</h2>
            <StatusBadge
              label={item.exceptionReason ? "Pengecualian" : "Belum cocok"}
              tone={item.exceptionReason || item.ageDays > 3 ? "warning" : "neutral"}
            />
          </div>
          <p className="text-row font-semibold wrap-anywhere">{cashDisplayTitle(item)}</p>
          <DetailAmount amount={item.amount} type={item.type} />
        </div>
        <div className="divide-y divide-outline-variant/40 border-t border-outline-variant/40">
          <FactRow label="Rekening" value={item.bankAccountName} layout="stacked" />
          <FactRow label="Dicatat" value={formatReconciliationDate(item.createdAt)} />
          {item.source ? (
            <>
              <FactRow label="Sumber" value={item.source.label} layout="stacked" />
              <FactRow label="Proyek" value={item.source.projectName} layout="stacked" />
            </>
          ) : null}
          <FactRow
            label="Referensi bank"
            value={item.bankReference || "Tidak dicatat"}
            layout="stacked"
          />
        </div>
        {item.exceptionReason ? (
          <div className="space-y-1 border-t border-outline-variant/40 px-4 py-3">
            <h3 className="text-support font-semibold text-warning">Alasan pengecualian</h3>
            <p className="text-support wrap-anywhere whitespace-pre-wrap">{item.exceptionReason}</p>
            {item.exceptionByName || item.exceptionAt ? (
              <p className="text-meta text-on-surface-variant">
                {[
                  item.exceptionByName,
                  item.exceptionAt ? formatConfirmationTime(item.exceptionAt) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
        ) : null}
        {candidates.length === 0 ? (
          <div className="border-t border-outline-variant/40 p-4">
            <Button
              variant="primary"
              size="compact"
              fullWidth
              disabled={pending}
              onClick={() => onOpenMatch(item.id)}
            >
              Periksa catatan
            </Button>
          </div>
        ) : null}
      </GroupedSurface>
      <section aria-label="Kandidat mutasi bank" className="min-w-0 space-y-2">
        <h3 className="px-1 text-row font-bold">Mutasi bank yang sesuai</h3>
        <GroupedSurface
          variant="desktopPanel"
          className="min-w-0 divide-y divide-outline-variant/40"
        >
          <p className="px-4 py-3 text-support text-on-surface-variant">
            {candidates.length > 0
              ? `${candidates.length} kandidat dengan rekening, arah, dan nominal yang sama. Periksa tanggal dan keterangannya sebelum mengonfirmasi.`
              : "Belum ada kandidat dalam data yang dimuat. Periksa sumber rekening koran atau catat alasan pengecualian."}
          </p>
          {candidates.map((candidate) => (
            <CandidateEvidence
              key={candidate.id}
              title={candidate.description}
              account={candidate.bankAccountName}
              date={candidate.transactionDate}
              pending={pending}
              onReview={() => onOpenMatch(item.id, candidate.id)}
            />
          ))}
        </GroupedSurface>
      </section>
    </div>
  );
}

function StatementDetail({
  item,
  cashTransactions,
  pending,
  onOpenMatch,
}: {
  readonly item: ReconciliationStatementRow;
  readonly cashTransactions: readonly ReconciliationCashTransaction[];
  readonly pending: boolean;
  readonly onOpenMatch: ReconciliationDesktopDetailProps["onOpenMatch"];
}): React.JSX.Element {
  const candidates = cashTransactions.filter((cash) => matchesEvidence(item, cash));
  return (
    <div className="grid min-w-0 items-start gap-4 @2xl:grid-cols-2">
      <GroupedSurface variant="desktopPanel" className="min-w-0 overflow-hidden">
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-row font-bold">Mutasi bank</h2>
            <StatusBadge
              label={candidates.length > 1 ? "Beberapa kandidat" : "Belum cocok"}
              tone={candidates.length > 1 ? "warning" : "neutral"}
            />
          </div>
          <p className="text-row font-semibold wrap-anywhere">{item.description}</p>
          <DetailAmount amount={item.amount} type={item.type} />
        </div>
        <div className="divide-y divide-outline-variant/40 border-t border-outline-variant/40">
          <FactRow label="Rekening" value={item.bankAccountName} layout="stacked" />
          <FactRow label="Tanggal bank" value={formatReconciliationDate(item.transactionDate)} />
        </div>
      </GroupedSurface>
      <section aria-label="Kandidat catatan Paduna Build" className="min-w-0 space-y-2">
        <h3 className="px-1 text-row font-bold">Catatan Paduna Build yang sesuai</h3>
        <GroupedSurface
          variant="desktopPanel"
          className="min-w-0 divide-y divide-outline-variant/40"
        >
          <p className="px-4 py-3 text-support text-on-surface-variant">
            {candidates.length > 0
              ? `${candidates.length} kandidat dengan rekening, arah, dan nominal yang sama. Pilih catatan untuk meninjau pasangan.`
              : "Belum ada kandidat dalam data yang dimuat. Periksa apakah transaksi sudah dicatat pada rekening dan arah dana yang benar."}
          </p>
          {candidates.map((candidate) => (
            <CandidateEvidence
              key={candidate.id}
              title={cashDisplayTitle(candidate)}
              description={
                candidate.source
                  ? `${candidate.source.label} · ${candidate.source.projectName}`
                  : undefined
              }
              account={candidate.bankAccountName}
              date={candidate.createdAt}
              pending={pending}
              onReview={() => onOpenMatch(candidate.id, item.id)}
            />
          ))}
        </GroupedSurface>
      </section>
    </div>
  );
}

function HistoryDetail({
  item,
  pending,
  onOpenHistory,
}: {
  readonly item: ReconciliationHistoryRow;
  readonly pending: boolean;
  readonly onOpenHistory: (historyId: string) => void;
}): React.JSX.Element {
  return (
    <div className="grid min-w-0 items-start gap-4 @2xl:grid-cols-2">
      <GroupedSurface variant="desktopPanel" className="min-w-0 overflow-hidden">
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-row font-bold">Rekonsiliasi terkonfirmasi</h2>
            <StatusBadge label="Terkunci" tone="neutral" />
          </div>
          <DetailAmount amount={item.amount} type={item.type} />
        </div>
        <div className="divide-y divide-outline-variant/40 border-t border-outline-variant/40">
          <FactRow label="Rekening" value={item.bankAccountName} layout="stacked" />
          <FactRow
            label="Dikonfirmasi (WIB)"
            value={formatConfirmationTime(item.reconciledAt)}
            layout="stacked"
          />
          <FactRow label="Oleh" value={item.reconciledByName} layout="stacked" />
        </div>
        <div className="space-y-3 border-t border-outline-variant/40 p-4">
          <p className="flex items-start gap-2 text-support text-on-surface-variant">
            <AppIcon name="lock" className="icon-sm shrink-0" />
            Pasangan ini sudah diverifikasi. Catatan yang direkonsiliasi tidak dapat diedit atau
            dihapus.
          </p>
          <Button
            variant="secondary"
            size="compact"
            fullWidth
            disabled={pending}
            onClick={() => onOpenHistory(item.id)}
          >
            Buka bukti pencocokan
          </Button>
        </div>
      </GroupedSurface>
      <GroupedSurface variant="desktopPanel" className="min-w-0 divide-y divide-outline-variant/40">
        <div className="space-y-1 p-4">
          <h3 className="text-row font-bold">Catatan Paduna Build</h3>
          <p className="text-support wrap-anywhere">{item.cashDescription}</p>
        </div>
        <FactRow
          label="Referensi bank"
          value={item.bankReference || "Tidak dicatat"}
          layout="stacked"
        />
        <div className="space-y-1 p-4">
          <h3 className="text-row font-bold">Mutasi bank</h3>
          <p className="text-support wrap-anywhere">{item.statementDescription}</p>
        </div>
        <FactRow label="Tanggal bank" value={formatReconciliationDate(item.transactionDate)} />
        <FactRow label="Sumber data" value={item.importFileName} layout="stacked" />
      </GroupedSurface>
    </div>
  );
}

export function ReconciliationDesktopDetail({
  selection,
  pending,
  onOpenMatch,
  onOpenHistory,
}: ReconciliationDesktopDetailProps): React.JSX.Element {
  return (
    <section
      aria-label="Rincian rekonsiliasi"
      className="@container min-w-0 space-y-3 xl:sticky xl:top-24"
    >
      {selection.kind === "cash" ? (
        <CashDetail
          item={selection.item}
          statements={selection.statements}
          pending={pending}
          onOpenMatch={onOpenMatch}
        />
      ) : selection.kind === "statement" ? (
        <StatementDetail
          item={selection.item}
          cashTransactions={selection.cashTransactions}
          pending={pending}
          onOpenMatch={onOpenMatch}
        />
      ) : (
        <HistoryDetail item={selection.item} pending={pending} onOpenHistory={onOpenHistory} />
      )}
    </section>
  );
}
