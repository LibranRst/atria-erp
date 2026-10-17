import { z } from "zod";
import type { CashDirection } from "./cash-direction";

// Stored PostgreSQL UUIDs include historical IDs without RFC version/variant bits.
const databaseIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);

export const reconciliationDesktopInputSchema = z
  .object({
    view: z.enum(["statement", "cash", "history"]),
    search: z.string().trim().max(120).default(""),
    accountId: databaseIdSchema.optional(),
    direction: z.enum(["all", "INFLOW", "OUTFLOW"]).default("all"),
    status: z.enum(["all", "actionable", "exception", "candidate", "unmatched"]).default("all"),
    sort: z.enum(["date", "amount", "description", "account", "status"]).default("date"),
    sortDirection: z.enum(["ascending", "descending"]).default("descending"),
    page: z.number().int().min(1).default(1),
    pageSize: z.union([z.literal(10), z.literal(25), z.literal(50)]).default(10),
  })
  .superRefine((input, context) => {
    const allowed =
      input.view === "cash"
        ? ["all", "actionable", "exception"]
        : input.view === "statement"
          ? ["all", "candidate", "unmatched"]
          : ["all"];
    if (!allowed.includes(input.status))
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "Filter tidak tersedia untuk tab ini.",
      });
  });

export type ReconciliationDesktopRequest = z.input<typeof reconciliationDesktopInputSchema>;
export type ReconciliationDesktopInput = z.output<typeof reconciliationDesktopInputSchema>;

export type ReconciliationCashTransaction = {
  readonly id: string;
  readonly bankAccountId: string;
  readonly bankAccountName: string;
  readonly type: CashDirection;
  readonly amount: number;
  readonly description: string;
  readonly source: {
    readonly label: "Pengeluaran Lapangan";
    readonly projectName: string;
    readonly description: string;
  } | null;
  readonly bankReference: string | null;
  readonly createdAt: Date;
  readonly ageDays: number;
  readonly exceptionReason: string | null;
  readonly exceptionAt: Date | null;
  readonly exceptionByName: string | null;
};
export type ReconciliationStatementRow = {
  readonly id: string;
  readonly bankAccountId: string;
  readonly bankAccountName: string;
  readonly type: CashDirection;
  readonly amount: number;
  readonly description: string;
  readonly transactionDate: Date;
  readonly suggestedCashTransactionId: string | null;
  readonly candidateCount: number;
};
export type ReconciliationHistoryRow = {
  readonly id: string;
  readonly cashTransactionId: string;
  readonly bankAccountName: string;
  readonly type: CashDirection;
  readonly amount: number;
  readonly cashDescription: string;
  readonly statementDescription: string;
  readonly bankReference: string | null;
  readonly transactionDate: Date;
  readonly reconciledAt: Date;
  readonly reconciledByName: string;
  readonly importFileName: string;
};
export type ReconciliationDesktopCounts = {
  readonly cash: number;
  readonly statement: number;
  readonly history: number;
  readonly exceptions: number;
  readonly actionRequired: number;
};
export type ReconciliationDesktopBankAccount = {
  readonly id: string;
  readonly name: string;
  readonly bankName: string;
};
type ReconciliationDesktopPage<Row> = {
  readonly rows: readonly Row[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: 10 | 25 | 50;
  readonly updatedAt: Date;
  readonly counts: ReconciliationDesktopCounts;
  readonly bankAccounts: readonly ReconciliationDesktopBankAccount[];
};
export type ReconciliationDesktopData =
  | (ReconciliationDesktopPage<ReconciliationCashTransaction> & { readonly view: "cash" })
  | (ReconciliationDesktopPage<ReconciliationStatementRow> & { readonly view: "statement" })
  | (ReconciliationDesktopPage<ReconciliationHistoryRow> & { readonly view: "history" });

export const reconciliationMatchContextInputSchema = z
  .object({
    cashTransactionId: databaseIdSchema.optional(),
    statementRowId: databaseIdSchema.optional(),
  })
  .refine((input) => Boolean(input.cashTransactionId) !== Boolean(input.statementRowId), {
    message: "Pilih satu catatan kas atau mutasi bank.",
  });
export type ReconciliationMatchContextInput = z.infer<typeof reconciliationMatchContextInputSchema>;
export type ReconciliationMatchContext = {
  readonly cashTransactions: readonly ReconciliationCashTransaction[];
  readonly statementRows: readonly ReconciliationStatementRow[];
};
