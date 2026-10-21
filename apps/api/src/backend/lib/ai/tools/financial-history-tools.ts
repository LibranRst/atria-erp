import { db } from "@backend/db";
import {
  bankAccount,
  cashTransaction,
  expenseCategory,
  INSTANCE_TENANT_ID,
  project,
  projectExpenses,
} from "@backend/db/schema";
import {
  aggregateHistoricalCash,
  bindsFinancialHistoryEntity,
  aggregateHistoricalExpenses,
  parseFinancialHistoryRequest,
  type FinancialHistoryOutput,
} from "@atria/core/ai/financial-history";
import { tool, type Tool } from "ai";
import { and, asc, count, eq, gte, ilike, lt, sum } from "drizzle-orm";
import { z } from "zod";
import { hasGlobalScope, hasPermission, permissionDenied, type AiToolContext } from "./context";

export type FinancialHistoryToolContext = AiToolContext & {
  /** Original validated human text from the request, never a model tool argument. */
  readonly userQuestion?: string;
  /** ISO clock captured server-side once per human turn. */
  readonly asOf?: string;
};
export const financialHistoryInputSchema = z
  .object({
    projectId: z.uuid().optional(),
    projectName: z.string().min(1).max(200).optional(),
    bankAccountId: z.uuid().optional(),
    bankAccountName: z.string().min(1).max(100).optional(),
  })
  .strict();
export type FinancialHistoryInput = z.infer<typeof financialHistoryInputSchema>;
export type FinancialHistoryReadResult =
  | FinancialHistoryOutput
  | {
      readonly error: string;
      readonly needsDisambiguation?: boolean;
      readonly projects?: readonly { id: string; name: string }[];
      readonly accounts?: readonly { id: string; name: string }[];
    };
export async function readFinancialHistory(
  context: FinancialHistoryToolContext,
  raw: FinancialHistoryInput,
): Promise<FinancialHistoryReadResult> {
  if (!hasPermission(context, "use:ai_chat")) return permissionDenied("asisten AI");
  const parsed = financialHistoryInputSchema.safeParse(raw);
  if (!parsed.success) return { error: "Filter laporan tidak valid." };
  const input = parsed.data,
    question = context.userQuestion ?? "";
  const now = context.asOf ? new Date(context.asOf) : new Date();
  const request = parseFinancialHistoryRequest(question, now);
  if (request.error) return { error: request.error };
  if (!question.trim())
    return { error: "Pertanyaan asli diperlukan untuk menentukan periode laporan." };
  return db.transaction(
    async (tx): Promise<FinancialHistoryReadResult> => {
      const issues: string[] = [];
      let expensesAllowed =
        request.domains.includes("expenses") &&
        hasPermission(context, "view:cost") &&
        context.dataScope !== "NONE";
      let cashAllowed =
        request.domains.includes("cash") &&
        hasPermission(context, "view:bank_account") &&
        hasGlobalScope(context);
      if (request.domains.includes("expenses") && !expensesAllowed)
        issues.push(
          "Izin atau cakupan proyek Anda tidak menyediakan pembacaan riwayat pengeluaran.",
        );
      if (request.domains.includes("cash") && !cashAllowed)
        issues.push(
          "Arus kas perusahaan hanya tersedia untuk izin rekening dengan cakupan global.",
        );
      let selectedProject: { id: string; name: string } | undefined;
      if (expensesAllowed && !input.projectId && !input.projectName) {
        const candidates = await tx
          .select({ id: project.id, name: project.name })
          .from(project)
          .where(
            and(
              eq(project.tenantId, INSTANCE_TENANT_ID),
              context.dataScope === "ASSIGNED"
                ? eq(project.projectManagerId, context.userId)
                : undefined,
            ),
          )
          .orderBy(asc(project.id))
          .limit(501);
        const exact = candidates.filter((p) => bindsFinancialHistoryEntity(question, p.name, p.id));
        if (exact.length > 1)
          return {
            error: "Pilih satu proyek secara jelas untuk laporan periode ini.",
            needsDisambiguation: true,
            projects: exact.slice(0, 20),
          };
        selectedProject = exact[0];
        if (
          !selectedProject &&
          /\b(?:proyek|project)\b/i.test(question) &&
          !/\b(?:seluruh|semua|perusahaan|company|all|ditugaskan|saya)\b/i.test(question)
        )
          return {
            error:
              "Sebutkan satu proyek secara jelas, atau minta seluruh proyek yang dapat Anda akses.",
            needsDisambiguation: true,
            projects: candidates.slice(0, 20),
          };
      }
      if (input.projectId || input.projectName) {
        if (!expensesAllowed) return { error: "Proyek tidak ditemukan atau di luar akses Anda." };
        const matches = await tx
          .select({ id: project.id, name: project.name })
          .from(project)
          .where(
            and(
              eq(project.tenantId, INSTANCE_TENANT_ID),
              context.dataScope === "ASSIGNED"
                ? eq(project.projectManagerId, context.userId)
                : undefined,
              input.projectId
                ? eq(project.id, input.projectId)
                : ilike(project.name, `%${input.projectName?.replace(/[\\%_]/g, "\\$&")}%`),
            ),
          )
          .orderBy(asc(project.id))
          .limit(21);
        const exact = matches.filter((p) => bindsFinancialHistoryEntity(question, p.name, p.id));
        if (exact.length !== 1 || matches.length > 20)
          return {
            error: matches.length
              ? "Pilih satu proyek secara jelas untuk laporan periode ini."
              : "Proyek tidak ditemukan atau di luar akses Anda.",
            needsDisambiguation: matches.length > 0,
            projects: matches.slice(0, 20),
          };
        selectedProject = exact[0];
        if (cashAllowed) {
          cashAllowed = false;
          issues.push(
            "Arus kas per proyek belum memiliki pembacaan terverifikasi. Laporan kas tersedia per rekening atau seluruh perusahaan; pengeluaran proyek tetap dihitung terpisah.",
          );
        }
      }
      if (selectedProject && cashAllowed) {
        cashAllowed = false;
        issues.push(
          "Arus kas per proyek belum memiliki pembacaan terverifikasi. Minta arus kas rekening/perusahaan secara terpisah.",
        );
      }
      if (cashAllowed && /\b(?:proyek|project)\b/i.test(question) && !selectedProject) {
        cashAllowed = false;
        issues.push(
          "Arus kas per proyek belum memiliki pembacaan terverifikasi. Minta arus kas rekening/perusahaan secara terpisah.",
        );
      }
      let selectedAccount: { id: string; name: string } | undefined;
      if (cashAllowed && !input.bankAccountId && !input.bankAccountName) {
        const candidates = await tx
          .select({ id: bankAccount.id, name: bankAccount.name })
          .from(bankAccount)
          .where(eq(bankAccount.tenantId, INSTANCE_TENANT_ID))
          .orderBy(asc(bankAccount.id))
          .limit(501);
        const exact = candidates.filter((a) => bindsFinancialHistoryEntity(question, a.name, a.id));
        if (exact.length > 1)
          return {
            error: "Pilih satu rekening secara jelas untuk laporan periode ini.",
            needsDisambiguation: true,
            accounts: exact.slice(0, 20),
          };
        selectedAccount = exact[0];
        if (
          !selectedAccount &&
          /\b(?:rekening|account)\b/i.test(question) &&
          !/\b(?:seluruh|semua|perusahaan|company|all)\b/i.test(question)
        )
          return {
            error: "Sebutkan satu rekening secara jelas, atau minta arus kas seluruh perusahaan.",
            needsDisambiguation: true,
            accounts: candidates.slice(0, 20),
          };
      }
      if (input.bankAccountId || input.bankAccountName) {
        if (!cashAllowed) return { error: "Rekening tidak ditemukan atau di luar akses Anda." };
        const matches = await tx
          .select({ id: bankAccount.id, name: bankAccount.name })
          .from(bankAccount)
          .where(
            and(
              eq(bankAccount.tenantId, INSTANCE_TENANT_ID),
              input.bankAccountId
                ? eq(bankAccount.id, input.bankAccountId)
                : ilike(bankAccount.name, `%${input.bankAccountName?.replace(/[\\%_]/g, "\\$&")}%`),
            ),
          )
          .orderBy(asc(bankAccount.id))
          .limit(21);
        const exact = matches.filter((a) => bindsFinancialHistoryEntity(question, a.name, a.id));
        if (exact.length !== 1 || matches.length > 20)
          return {
            error: matches.length
              ? "Pilih satu rekening secara jelas untuk laporan periode ini."
              : "Rekening tidak ditemukan atau di luar akses Anda.",
            needsDisambiguation: matches.length > 0,
            accounts: matches.slice(0, 20),
          };
        selectedAccount = exact[0];
        if (expensesAllowed) {
          expensesAllowed = false;
          issues.push(
            "Pengeluaran tercatat tidak dipilah menurut rekening pembayaran; minta cakupan proyek atau seluruh proyek untuk bagian pengeluaran.",
          );
        }
      }
      if (selectedAccount && expensesAllowed) {
        expensesAllowed = false;
        issues.push(
          "Pengeluaran tercatat tidak dipilah menurut rekening pembayaran; minta cakupan proyek atau seluruh proyek secara terpisah.",
        );
      }
      const periods: FinancialHistoryOutput["periods"] = [];
      for (const range of request.periods) {
        const start = new Date(range.start),
          end = new Date(range.end);
        const expenses = expensesAllowed
          ? aggregateHistoricalExpenses(
              await tx
                .select({
                  categoryId: expenseCategory.id,
                  categoryName: expenseCategory.name,
                  status: projectExpenses.status,
                  sourceType: projectExpenses.sourceType,
                  amount: sum(projectExpenses.amount),
                  count: count(),
                })
                .from(projectExpenses)
                .innerJoin(
                  project,
                  and(
                    eq(project.id, projectExpenses.projectId),
                    eq(project.tenantId, INSTANCE_TENANT_ID),
                  ),
                )
                .innerJoin(
                  expenseCategory,
                  and(
                    eq(expenseCategory.id, projectExpenses.expenseCategoryId),
                    eq(expenseCategory.tenantId, INSTANCE_TENANT_ID),
                  ),
                )
                .where(
                  and(
                    eq(projectExpenses.tenantId, INSTANCE_TENANT_ID),
                    gte(projectExpenses.expenseDate, start),
                    lt(projectExpenses.expenseDate, end),
                    selectedProject ? eq(projectExpenses.projectId, selectedProject.id) : undefined,
                    context.dataScope === "ASSIGNED"
                      ? eq(project.projectManagerId, context.userId)
                      : undefined,
                  ),
                )
                .groupBy(
                  expenseCategory.id,
                  expenseCategory.name,
                  projectExpenses.status,
                  projectExpenses.sourceType,
                ),
            )
          : undefined;
        const cash = cashAllowed
          ? aggregateHistoricalCash(
              await tx
                .select({
                  type: cashTransaction.type,
                  category: cashTransaction.category,
                  referenceType: cashTransaction.referenceType,
                  amount: sum(cashTransaction.amount),
                  count: count(),
                })
                .from(cashTransaction)
                .innerJoin(
                  bankAccount,
                  and(
                    eq(bankAccount.id, cashTransaction.bankAccountId),
                    eq(bankAccount.tenantId, INSTANCE_TENANT_ID),
                  ),
                )
                .where(
                  and(
                    eq(cashTransaction.tenantId, INSTANCE_TENANT_ID),
                    gte(cashTransaction.createdAt, start),
                    lt(cashTransaction.createdAt, end),
                    selectedAccount
                      ? eq(cashTransaction.bankAccountId, selectedAccount.id)
                      : undefined,
                  ),
                )
                .groupBy(
                  cashTransaction.type,
                  cashTransaction.category,
                  cashTransaction.referenceType,
                ),
            )
          : undefined;
        periods.push({ ...range, ...(expenses ? { expenses } : {}), ...(cash ? { cash } : {}) });
      }
      return {
        kind: "financial-history",
        asOf: now.toISOString(),
        timeZone: "Asia/Jakarta",
        comparison: request.comparison,
        scope: selectedProject
          ? {
              kind: "project",
              projectId: selectedProject.id,
              projectName: selectedProject.name,
              label: selectedProject.name,
            }
          : selectedAccount
            ? {
                kind: "account",
                accountId: selectedAccount.id,
                accountName: selectedAccount.name,
                label: selectedAccount.name,
              }
            : context.dataScope === "ASSIGNED"
              ? { kind: "assigned", label: "Seluruh proyek yang ditugaskan kepada Anda" }
              : { kind: "company", label: "Seluruh catatan perusahaan ini" },
        periods,
        issues,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
export type FinancialHistoryTools = {
  readonly getFinancialHistory: Tool<
    FinancialHistoryInput,
    FinancialHistoryReadResult,
    Record<string, unknown>
  >;
};
export function buildFinancialHistoryTools(
  context: FinancialHistoryToolContext,
): FinancialHistoryTools {
  return {
    getFinancialHistory: tool({
      description:
        "Read full scoped historical recorded expenses or cash flow for 1–2 periods. Dates are derived server-side from the ORIGINAL user question in Asia/Jakarta; tool arguments cannot choose dates. Supported: today/yesterday/this month/last month, named months with year, explicit dates/ranges. Expense date is expenseDate; cash date is cash ledger createdAt, not import/reconciliation date. Returns exact totals/counts, current expense statuses, partial-period basis, excluded transfers/opening/adjustments. This is not past balance/budget/stock snapshots or forecasts. Use project/account filter only when explicitly named by user; never select a first ambiguous match. Company/account cash requires GLOBAL bank-read access.",
      inputSchema: financialHistoryInputSchema,
      execute: async (input: FinancialHistoryInput): Promise<FinancialHistoryReadResult> =>
        readFinancialHistory(context, input),
    }),
  };
}
