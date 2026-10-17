import React from "react";
import type {
  ReconciliationCashTransaction,
  ReconciliationStatementRow,
} from "@/app/actions/finance/reconciliation-workspace";
import { FactRow, GroupedSurface, MoneyValue } from "@/components/ui";
import { directionCopy, formatReconciliationDate } from "./reconciliation-primitives";

export function StatementImportSummary({
  accountName,
  fileName,
  rowCount,
  inflow,
  outflow,
  state,
}: {
  readonly accountName: string | undefined;
  readonly fileName: string;
  readonly rowCount: number;
  readonly inflow: number;
  readonly outflow: number;
  readonly state: "unread" | "reading" | "failed" | "ready";
}): React.JSX.Element {
  return (
    <GroupedSurface>
      <div className="divide-y divide-outline-variant/20">
        <FactRow
          layout="stacked"
          label="Rekening"
          wrapLabel
          value={accountName || "Belum dipilih"}
        />
        <FactRow layout="stacked" label="Berkas" wrapLabel value={fileName || "Belum dipilih"} />
        <FactRow
          layout="stacked"
          label="Pratinjau"
          wrapLabel
          value={
            state === "failed"
              ? "Perlu diperiksa"
              : state === "reading"
                ? "Sedang dibaca…"
                : state === "ready"
                  ? `${rowCount} mutasi`
                  : "Belum dibaca"
          }
        />
        {state === "ready" && rowCount > 0 ? (
          <>
            <FactRow
              layout="stacked"
              label="Dana masuk"
              wrapLabel
              value={
                <MoneyValue
                  fractionDigits={Number.isInteger(inflow) ? 0 : 2}
                  amount={inflow}
                  variant="compact"
                />
              }
            />
            <FactRow
              layout="stacked"
              label="Dana keluar"
              wrapLabel
              value={
                <MoneyValue
                  fractionDigits={Number.isInteger(outflow) ? 0 : 2}
                  amount={outflow}
                  variant="compact"
                />
              }
            />
          </>
        ) : null}
        <p className="px-4 py-3 text-support text-on-surface-variant">
          Mutasi ini adalah bukti bank. Impor tidak mengubah saldo rekening Paduna Build.
        </p>
      </div>
    </GroupedSurface>
  );
}

export function StatementDraftSummary({
  accountName,
  date,
  type,
  amount,
}: {
  readonly accountName: string | undefined;
  readonly date: string;
  readonly type: "INFLOW" | "OUTFLOW";
  readonly amount: string;
}): React.JSX.Element {
  const value = Number(amount);
  return (
    <GroupedSurface>
      <div className="divide-y divide-outline-variant/20">
        <FactRow
          layout="stacked"
          label="Rekening"
          wrapLabel
          value={accountName || "Belum dipilih"}
        />
        <FactRow
          layout="stacked"
          label="Tanggal"
          wrapLabel
          value={date ? formatReconciliationDate(new Date(date)) : "Belum diisi"}
        />
        <FactRow layout="stacked" label="Arah" wrapLabel value={directionCopy(type)} />
        <FactRow
          layout="stacked"
          label="Nominal"
          wrapLabel
          value={
            Number.isFinite(value) && value > 0 ? (
              <MoneyValue
                fractionDigits={Number.isInteger(value) ? 0 : 2}
                amount={value}
                variant="compact"
              />
            ) : (
              "Belum diisi"
            )
          }
        />
        <p className="px-4 py-3 text-support text-on-surface-variant">
          Menyalin bukti bank tidak mencatat kas masuk atau keluar baru di Paduna Build.
        </p>
      </div>
    </GroupedSurface>
  );
}

export function ReconciliationMatchSummary({
  cash,
  statement,
  candidateCount,
}: {
  readonly cash: ReconciliationCashTransaction | null;
  readonly statement: ReconciliationStatementRow | null;
  readonly candidateCount: number;
}): React.JSX.Element | null {
  if (!cash) return null;
  return (
    <GroupedSurface>
      <div className="divide-y divide-outline-variant/20">
        <FactRow layout="stacked" label="Rekening" wrapLabel value={cash.bankAccountName} />
        <FactRow layout="stacked" label="Arah" wrapLabel value={directionCopy(cash.type)} />
        <FactRow
          layout="stacked"
          label="Nominal"
          wrapLabel
          value={
            <MoneyValue
              fractionDigits={Number.isInteger(cash.amount) ? 0 : 2}
              amount={cash.amount}
              variant="compact"
            />
          }
        />
        <FactRow layout="stacked" label="Kandidat" value={`${candidateCount} mutasi`} />
        <FactRow
          layout="stacked"
          label="Bukti bank"
          wrapLabel
          value={statement ? "Sudah dipilih" : "Belum dipilih"}
        />
        <p className="px-4 py-3 text-support text-on-surface-variant">
          Pencocokan mengubah status rekonsiliasi. Saldo rekening tetap sama.
        </p>
      </div>
    </GroupedSurface>
  );
}
