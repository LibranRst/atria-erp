import { and, asc, eq, ilike } from "drizzle-orm";
import { db } from "@backend/db";
import { project, INSTANCE_TENANT_ID } from "@backend/db/schema";
import { actorCan } from "@backend/lib/auth/permissions";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { AiToolContext } from "./context";
import { clientInvoiceInputSchema, budgetSettingsInputSchema } from "@atria/core/ai/finance-input";
import {
  prepareFinanceInput,
  readFinanceInputProject,
  readFinanceBudgetSettings,
} from "@backend/server/usecases/ai/finance-input-context";

export function buildFinanceInputTools(actor: AiToolContext): ToolSet {
  return {
    getClientInvoiceContext: tool({
      description:
        "Read-only scoped project contract/invoices. Prefer projectQuery with the human-selected project name to resolve actual IDs server-side; multiple matches return choices instead of choosing. If a supplied ID is rejected, resolve projectQuery again and use the returned project.id exactly, never carry an invented/stale ID. Paginated invoices20. Existing active invoices block schedules; single invoices require ACTIVE projects.",
      inputSchema: z
        .object({
          projectId: z.string().guid().optional(),
          projectQuery: z.string().trim().min(1).max(100).optional(),
          offset: z.number().int().min(0).max(100000).default(0),
        })
        .strict()
        .refine(
          (input) => Boolean(input.projectId || input.projectQuery),
          "Isi nama atau ID proyek terverifikasi.",
        ),
      execute: async (input) => {
        try {
          if (
            !actorCan(actor, "use:ai_chat") ||
            !actorCan(actor, "view:project") ||
            !actorCan(actor, "view:client_invoice") ||
            actor.dataScope === "NONE"
          )
            return { error: "Akses proyek dan invoice klien diperlukan." };
          let projectId = input.projectId;
          if (input.projectQuery) {
            const matches = await db.query.project.findMany({
              where: and(
                eq(project.tenantId, INSTANCE_TENANT_ID),
                ilike(project.name, `%${input.projectQuery}%`),
                actor.dataScope === "ASSIGNED"
                  ? eq(project.projectManagerId, actor.userId)
                  : undefined,
              ),
              columns: { id: true, name: true, status: true },
              orderBy: [asc(project.name)],
              limit: 21,
            });
            if (input.projectQuery.length === 1 || matches.length !== 1)
              return {
                projects: matches.slice(0, 20),
                hasMore: matches.length > 20,
                needsDisambiguation: true,
                instruction:
                  "Minta user memilih proyek yang tersedia; jangan mengarang ID atau memilih sendiri.",
              };
            projectId = matches[0].id;
          }
          if (projectId) {
            const context = await readFinanceInputProject(actor, projectId);
            const active = context.invoices.filter((row) => row.status !== "VOID");
            return {
              project: {
                id: context.project.id,
                name: context.project.name,
                status: context.project.status,
                contractValue: Number(context.project.totalContractValue),
              },
              activeInvoiceTotal: active.reduce((sum, row) => sum + Number(row.amount), 0),
              hasActiveInvoices: active.length > 0,
              invoices: context.invoices.slice(input.offset, input.offset + 20).map((row) => ({
                id: row.id,
                invoiceNumber: row.invoiceNumber,
                amount: Number(row.amount),
                status: row.status,
                dueDate: row.dueDate?.toISOString().slice(0, 10),
                stage: row.stage,
              })),
              nextOffset: context.invoices.length > input.offset + 20 ? input.offset + 20 : null,
            };
          }
        } catch (error: unknown) {
          return {
            error:
              error instanceof Error && !error.message.startsWith("Failed query:")
                ? error.message
                : "Sumber invoice/pengaturan belum dapat dibaca.",
          };
        }
      },
    }),
    getBudgetSettingsContext: tool({
      description:
        "Read-only actual company budget defaults for a authorized company-settings administrator. Returns exact setting/category IDs, cap and margin derived from Settings. Defaults affect future budgets only. Never infer a policy from general examples.",
      inputSchema: z.object({ settingId: z.string().guid().optional() }).strict(),
      execute: async (input) => {
        try {
          const setting = await readFinanceBudgetSettings(actor, input.settingId);
          return {
            settingId: setting.id,
            name: setting.name,
            budgetCapRatio: Number(setting.budgetCapRatio),
            targetMarginRatio: 1 - Number(setting.budgetCapRatio),
            notes: setting.notes,
            categories: setting.categories.map((row) => ({
              id: row.id,
              name: row.expenseCategory.name,
              ratioPercentage: Number(row.ratioPercentage),
              isEnabled: row.isEnabled,
            })),
            instruction:
              "Sertakan seluruh kategori terbaru dan pertahankan nilai yang tidak diminta berubah. Default untuk budget berikutnya; proyek tersimpan tetap.",
          };
        } catch {
          return {
            error: "Pengaturan budget tidak tersedia dalam akses Anda atau belum dapat dibaca.",
          };
        }
      },
    }),
    proposeBudgetSettings: tool({
      description:
        "Read-only immutable preview of company budget cap/name/notes/category defaults. Use getBudgetSettingsContext first and preserve all untouched categories. Percentages are fractions (35%=0.35), active allocations must total at most100%. A human presses a protected confirmation button; prose approval never saves. Company manage:budget_settings and view:settings required; project dataScope never grants this Settings right. Only future budget setup changes; existing budgets/cash/stock remain. Do not alter approval or security settings.",
      inputSchema: budgetSettingsInputSchema,
      execute: async (input) => {
        try {
          return { proposal: await prepareFinanceInput(actor, input) };
        } catch (error: unknown) {
          return {
            error:
              error instanceof Error && !error.message.startsWith("Failed query:")
                ? error.message
                : "Usulan pengaturan belum dapat disiapkan.",
          };
        }
      },
    }),

    proposeClientInvoiceSchedule: tool({
      description:
        "Use for requests to create an entire payment schedule/jadwal termin, not a single DP invoice. Read getClientInvoiceContext for the human-selected project and use its exact project.id. Include EVERY requested installment; never replace a multi-term schedule with its DP alone. Each percentage is a fraction, all terms total100%, maximum24; firstDueDate is human-supplied and later terms are monthly. Existing active invoices block creation. The server generates invoice numbers. Immutable preview only: human reviews all terms and clicks Buat jadwal termin. No cash movement, paid status or sending to client.",
      inputSchema: clientInvoiceInputSchema.options[1],
      execute: async (input) => {
        try {
          return { proposal: await prepareFinanceInput(actor, input) };
        } catch (error: unknown) {
          return {
            error:
              error instanceof Error && !error.message.startsWith("Failed query:")
                ? error.message
                : "Jadwal termin belum dapat disiapkan.",
          };
        }
      },
    }),
    proposeClientInvoice: tool({
      description:
        "Use only the exact project.id returned by a successful getClientInvoiceContext for the human-selected project. If context failed, resolve its name again with projectQuery before preparing a proposal. Read-only proposal for ONE invoice: human-supplied invoice number, amount, stage and due date. For jadwal termin/multiple installments use proposeClientInvoiceSchedule instead; never invent a suffix/number or prepare only a DP from a schedule request. Call getClientInvoiceContext first; ask for missing dates/amounts/labels. Ratios are fractions (35%=0.35); never silently change other categories or choose a project. Each proposal is a fresh immutable review. Corrections produce a new proposal. Human must press its confirmation button; conversation approval never writes business data. Invoice/schedule creates UNPAID records, no cash movement or sending to client. Never change approval/security settings with this tool.",
      inputSchema: clientInvoiceInputSchema.options[0],
      execute: async (input) => {
        try {
          return { proposal: await prepareFinanceInput(actor, input) };
        } catch (error: unknown) {
          return {
            error:
              error instanceof Error && !error.message.startsWith("Failed query:")
                ? error.message
                : "Usulan belum dapat disiapkan.",
          };
        }
      },
    }),
  };
}
