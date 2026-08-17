import "server-only";

import { db } from "@/db";
import { bankAccount, project, vendor, vendorBill } from "@/db/schema";
import { getPendingApprovalDetails } from "@/lib/finance/approval-details";
import { tool } from "ai";
import { and, asc, eq, ilike, lte, ne } from "drizzle-orm";
import { z } from "zod";

import {
  accessibleProjectIds,
  hasGlobalScope,
  hasPermission,
  permissionDenied,
  projectScopeCondition,
  type AiToolContext,
} from "./context";
import { daysUntil, describeFilters, money, toNumber } from "./shared";

/**
 * Tool batch 2: posisi kas, antrean persetujuan, dan tagihan vendor jatuh tempo.
 *
 * Semuanya read-only. Tool yang menyentuh data finansial global digerbangi
 * kunci izin yang sama dengan yang dipakai Server Action, lalu dibatasi lagi
 * per proyek untuk peran yang tidak berlingkup global.
 */

const MAX_ROWS = 20;

export function buildFinanceTools(context: AiToolContext) {
  return {
    getBankBalances: tool({
      description:
        "Get the balance of every active bank account, plus the combined total available cash. Use for questions about how much cash the company has.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!hasPermission(context, "view:bank_account")) {
          return permissionDenied("data rekening dan saldo bank");
        }

        const rows = await db.query.bankAccount.findMany({
          where: eq(bankAccount.isActive, true),
          columns: { name: true, bankName: true, balance: true },
          orderBy: [asc(bankAccount.name)],
        });

        const total = rows.reduce((sum, row) => sum + toNumber(row.balance), 0);

        return {
          totalAvailable: money(String(total)),
          accounts: rows.map((row) => ({
            accountName: row.name,
            bankName: row.bankName,
            balance: money(row.balance),
          })),
        };
      },
    }),

    getPendingApprovals: tool({
      description:
        "List approval requests still waiting for a decision, with amount, project, who requested it, and how urgent it is. Use for questions about what needs a decision.",
      inputSchema: z.object({
        projectName: z
          .string()
          .min(2)
          .optional()
          .describe(
            "Part of a project name. Pass this when the user asks about approvals for one specific project.",
          ),
        minPriority: z
          .enum(["CRITICAL", "WARNING", "NORMAL"])
          .optional()
          .describe(
            "Lowest priority to include. Pass CRITICAL when the user asks only about urgent approvals.",
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_ROWS)
          .default(10)
          .describe("Maximum number of approvals to return."),
      }),
      execute: async ({ projectName, minPriority, limit }) => {
        // Antrean persetujuan adalah pandangan finansial lintas proyek, jadi hanya
        // untuk peran berlingkup global. PM tidak boleh melihat pengajuan proyek lain.
        if (!hasPermission(context, "view:cost") || !hasGlobalScope(context)) {
          return permissionDenied("antrean persetujuan lintas proyek");
        }

        // Penyaringan terjadi sebelum pemotongan `limit`, supaya meminta
        // "yang kritis saja" tidak kehilangan baris kritis di luar sepuluh teratas.
        const all = await getPendingApprovalDetails();
        const rank: Record<string, number> = { CRITICAL: 0, WARNING: 1, NORMAL: 2 };
        const needle = projectName?.trim().toLowerCase();

        const details = all
          .filter((detail) => !needle || detail.projectName.toLowerCase().includes(needle))
          .filter((detail) => !minPriority || rank[detail.priority] <= rank[minPriority])
          .slice(0, limit);
        const now = new Date();

        return {
          appliedFilters: describeFilters([
            projectName ? `Proyek "${projectName}"` : null,
            minPriority === "CRITICAL"
              ? "Hanya kritis"
              : minPriority === "WARNING"
                ? "Kritis dan perhatian"
                : null,
          ]),
          totalWaiting: details.length,
          approvals: details.map((detail) => ({
            projectName: detail.projectName,
            description: detail.description,
            amount: money(String(detail.amount)),
            requestedBy: detail.requestedBy,
            priority: detail.priority,
            priorityReason: detail.priorityReason,
            waitingDays: Math.max(
              0,
              Math.floor((now.getTime() - detail.createdAt.getTime()) / 86_400_000),
            ),
          })),
        };
      },
    }),

    getUpcomingBills: tool({
      description:
        "List vendor bills that are unpaid and due within a number of days, including bills already overdue. Use for questions about upcoming payment obligations.",
      inputSchema: z.object({
        withinDays: z
          .number()
          .int()
          .min(1)
          .max(180)
          .default(30)
          .describe("How many days ahead to look. Overdue bills are always included."),
        projectName: z
          .string()
          .min(2)
          .optional()
          .describe(
            "Part of a project name. Pass this when the user asks about bills for one specific project.",
          ),
        limit: z.number().int().min(1).max(MAX_ROWS).default(10),
      }),
      execute: async ({ withinDays, projectName, limit }) => {
        if (!hasPermission(context, "view:vendor_bill")) {
          return permissionDenied("data tagihan vendor");
        }

        const projectIds = await accessibleProjectIds(context);
        const scope = projectScopeCondition(projectIds, vendorBill.projectId);

        const horizon = new Date();
        horizon.setDate(horizon.getDate() + withinDays);

        const conditions = [
          ne(vendorBill.status, "PAID"),
          ne(vendorBill.status, "VOID"),
          lte(vendorBill.dueDate, horizon),
        ];
        if (scope) conditions.push(scope);
        if (projectName) conditions.push(ilike(project.name, `%${projectName}%`));

        const rows = await db
          .select({
            billNumber: vendorBill.billNumber,
            amount: vendorBill.amount,
            status: vendorBill.status,
            dueDate: vendorBill.dueDate,
            projectId: vendorBill.projectId,
            projectName: project.name,
            vendorName: vendor.name,
          })
          .from(vendorBill)
          .innerJoin(project, eq(vendorBill.projectId, project.id))
          .innerJoin(vendor, eq(vendorBill.vendorId, vendor.id))
          .where(and(...conditions))
          .orderBy(asc(vendorBill.dueDate))
          .limit(limit);

        const total = rows.reduce((sum, row) => sum + toNumber(row.amount), 0);

        return {
          appliedFilters: describeFilters([projectName ? `Proyek "${projectName}"` : null]),
          horizonDays: withinDays,
          totalOutstanding: money(String(total)),
          bills: rows.map((row) => {
            const days = daysUntil(row.dueDate);
            return {
              billNumber: row.billNumber,
              vendorName: row.vendorName,
              projectName: row.projectName,
              projectId: row.projectId,
              amount: money(row.amount),
              status: row.status,
              dueInDays: days,
              timing: days < 0 ? "OVERDUE" : days === 0 ? "DUE_TODAY" : "UPCOMING",
            };
          }),
        };
      },
    }),
  };
}
