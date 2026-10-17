import type { PermissionKey } from "@atria/core/auth/permissions";
import type {
  ReconciliationCashTransaction,
  ReconciliationDesktopBankAccount,
  ReconciliationDesktopCounts,
  ReconciliationHistoryRow,
  ReconciliationStatementRow,
} from "@atria/core/finance/reconciliation-desktop";
import type { ReconciliationWorkspace } from "@/app/actions/finance/reconciliation-workspace";

export type ReconciliationFixtureScenario = "complete" | "empty" | "source-error" | "pending";
export const RECONCILIATION_FIXTURE_REFERENCE = new Date("2026-10-15T05:00:00.000Z");
export const reconciliationFixtureId = (index: number): string =>
  `bef10000-0000-4000-8000-${String(index).padStart(12, "0")}`;
export const RECONCILIATION_FIXTURE_PERMISSIONS: readonly PermissionKey[] = [
  "reconcile:ledger",
  "view:bank_account",
];
export const RECONCILIATION_FIXTURE_ACCOUNTS: readonly ReconciliationDesktopBankAccount[] = [
  { id: reconciliationFixtureId(1), name: "Operasional utama", bankName: "BCA" },
  { id: reconciliationFixtureId(2), name: "Pembayaran proyek", bankName: "Mandiri" },
  { id: reconciliationFixtureId(3), name: "Penerimaan klien", bankName: "BCA" },
];
const descriptions = [
  "Pelunasan multipleks 18 mm dan laminasi HPL kitchen Menteng",
  "Termin fabrikasi solid surface countertop Cipete House",
  "Upah instalasi kabinet dan finishing BSD Office",
  "Penerimaan termin pekerjaan interior dari klien",
  "Pembayaran engsel soft-close dan rel laci workshop",
  "Pengadaan material dan perlengkapan instalasi untuk kitchen, pantry, dan storage lantai dua sesuai rincian nota vendor",
];

function cashRow(index: number): ReconciliationCashTransaction {
  const effectiveIndex = index === 6 ? 5 : index;
  const account = RECONCILIATION_FIXTURE_ACCOUNTS[effectiveIndex % 3]!;
  const exception = index === 4 || index === 13;
  return {
    id: reconciliationFixtureId(100 + index),
    bankAccountId: account.id,
    bankAccountName: account.name,
    type: effectiveIndex % 4 === 3 ? "INFLOW" : "OUTFLOW",
    amount: (effectiveIndex + 1) * 185_000 + (effectiveIndex % 5 === 0 ? 0.25 : 0),
    description: `${descriptions[index % descriptions.length]} · tahap ${Math.floor(index / 6) + 1}`,
    source:
      index % 3 === 0
        ? {
            label: "Pengeluaran Lapangan",
            projectName:
              index % 2 === 0 ? "Menteng Villa · Kitchen & Living" : "Cipete House · Interior",
            description: descriptions[index % descriptions.length]!,
          }
        : null,
    bankReference: index % 4 === 0 ? `TRX-${20261000 + index}` : null,
    createdAt: new Date(Date.UTC(2026, 9, 14 - (index % 12), 3, index)),
    ageDays: 1 + (index % 12),
    exceptionReason: exception
      ? "Pembayaran tunai didokumentasikan dengan bukti kas. Data sintetis; tidak tersedia mutasi bank untuk transaksi ini."
      : null,
    exceptionAt: exception ? new Date("2026-10-14T07:00:00.000Z") : null,
    exceptionByName: exception ? "Karin Putri" : null,
  };
}

export const RECONCILIATION_FIXTURE_CASH: readonly ReconciliationCashTransaction[] = Array.from(
  { length: 25 },
  (_, index) => cashRow(index),
);

function statementRow(
  cash: ReconciliationCashTransaction,
  index: number,
): ReconciliationStatementRow {
  const candidates = RECONCILIATION_FIXTURE_CASH.filter(
    (row) =>
      row.bankAccountId === cash.bankAccountId &&
      row.type === cash.type &&
      row.amount === cash.amount,
  );
  return {
    id: reconciliationFixtureId(500 + index),
    bankAccountId: cash.bankAccountId,
    bankAccountName: cash.bankAccountName,
    type: cash.type,
    amount: cash.amount,
    description: `Mutasi bank · ${cash.description}`,
    transactionDate: new Date(Date.UTC(2026, 9, 14 - (index % 12), 5, index)),
    suggestedCashTransactionId: candidates.length === 1 ? candidates[0]!.id : null,
    candidateCount: candidates.length,
  };
}
const linkedStatements = RECONCILIATION_FIXTURE_CASH.filter((_, index) => index !== 2).map(
  (cash, index) => statementRow(cash, index),
);
export const RECONCILIATION_FIXTURE_STATEMENTS: readonly ReconciliationStatementRow[] = [
  ...linkedStatements,
  statementRow(RECONCILIATION_FIXTURE_CASH[1]!, 50),
  ...[0, 1].map((index): ReconciliationStatementRow => ({
    id: reconciliationFixtureId(590 + index),
    bankAccountId: RECONCILIATION_FIXTURE_ACCOUNTS[index]!.id,
    bankAccountName: RECONCILIATION_FIXTURE_ACCOUNTS[index]!.name,
    type: index === 0 ? "OUTFLOW" : "INFLOW",
    amount: 77_500.75 + index * 20_000,
    description:
      index === 0
        ? "Biaya administrasi bank · bukti belum dicatat"
        : "Penerimaan dengan referensi bank yang masih perlu ditelusuri",
    transactionDate: new Date("2026-10-15T02:30:00.000Z"),
    suggestedCashTransactionId: null,
    candidateCount: 0,
  })),
];
export const RECONCILIATION_FIXTURE_HISTORY: readonly ReconciliationHistoryRow[] = Array.from(
  { length: 12 },
  (_, index): ReconciliationHistoryRow => ({
    id: reconciliationFixtureId(800 + index),
    cashTransactionId: reconciliationFixtureId(900 + index),
    bankAccountName: RECONCILIATION_FIXTURE_ACCOUNTS[index % 3]!.name,
    type: index % 3 === 0 ? "INFLOW" : "OUTFLOW",
    amount: (index + 1) * 425_000 + (index === 0 ? 0.75 : 0),
    cashDescription: descriptions[index % descriptions.length]!,
    statementDescription: `Mutasi bank terverifikasi · ${descriptions[index % descriptions.length]}`,
    bankReference: index % 2 === 0 ? `BANK-${index + 100}` : null,
    transactionDate: new Date(Date.UTC(2026, 9, 13 - index, 2)),
    reconciledAt: new Date(Date.UTC(2026, 9, 14 - index, 4)),
    reconciledByName: index % 2 === 0 ? "Karin Putri" : "Libran",
    importFileName:
      index % 2 === 0 ? "bca-oktober-2026-sintetis.csv" : "mandiri-oktober-2026-sintetis.csv",
  }),
);

export function reconciliationFixtureData(
  scenario: ReconciliationFixtureScenario = "complete",
): ReconciliationWorkspace {
  const empty = scenario === "empty";
  return {
    bankAccounts: RECONCILIATION_FIXTURE_ACCOUNTS,
    cashTransactions: empty ? [] : RECONCILIATION_FIXTURE_CASH,
    statementRows: empty ? [] : RECONCILIATION_FIXTURE_STATEMENTS,
    history: empty ? [] : RECONCILIATION_FIXTURE_HISTORY,
    historyTotal: empty ? 0 : RECONCILIATION_FIXTURE_HISTORY.length,
  };
}
export function reconciliationFixtureCounts(
  scenario: ReconciliationFixtureScenario,
): ReconciliationDesktopCounts {
  const data = reconciliationFixtureData(scenario);
  const exceptions = data.cashTransactions.filter((row) => row.exceptionReason !== null).length;
  return {
    cash: data.cashTransactions.length,
    statement: data.statementRows.length,
    history: data.historyTotal,
    exceptions,
    actionRequired: data.cashTransactions.length - exceptions,
  };
}
