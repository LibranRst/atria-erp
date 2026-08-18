import "server-only";

import { db } from "@/db";
import {
  client,
  expenseCategory,
  project,
  projectBudgetCategory,
  projectBudgets,
} from "@/db/schema";
import {
  resolveEffectiveProjectHealth,
  projectHealthReasonLabel,
} from "@atria/core/project/effective-health";
import { tool } from "ai";
import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { z } from "zod";
import {
  canAccessProject,
  hasGlobalScope,
  PROJECT_ACCESS_DENIED,
  type AiToolContext,
} from "./context";
import { describeFilters, money, statusLabel, toNumber } from "./shared";

/**
 * Tool batch 1: orientasi proyek, budget per kategori, dan kesehatan keuangan.
 * Ini fondasi yang dipakai hampir semua pertanyaan sebelum masuk ke detail lain.
 */

const MAX_PROJECT_ROWS = 20;

export function buildProjectTools(context: AiToolContext) {
  return {
    listProjects: tool({
      description:
        "List projects the current user can access, with status and financial health. When the user names a project, ALWAYS pass `query` with that name so only the matching project is returned — never fetch every project and filter it yourself.",
      inputSchema: z.object({
        query: z
          .string()
          .min(2)
          .optional()
          .describe(
            "Part of a project or client name, for example 'Sudirman'. Pass this whenever the user mentions a specific project.",
          ),
        status: z
          .enum(["ACTIVE", "DRAFT", "ON_HOLD", "COMPLETED", "CANCELLED"])
          .optional()
          .describe("Filter by project status. Omit to include all statuses."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_PROJECT_ROWS)
          .default(10)
          .describe("Maximum number of projects to return."),
      }),
      execute: async ({ query, status, limit }) => {
        const scopeCondition = hasGlobalScope(context)
          ? undefined
          : eq(project.projectManagerId, context.userId);
        const statusCondition = status ? eq(project.status, status) : undefined;
        // Pencarian dilakukan di database, bukan dengan mengambil semua baris lalu
        // menyaringnya: hasil yang kembali harus persis sebanyak yang ditanyakan,
        // karena hasil itulah yang dirender sebagai kartu kepada pengguna.
        const searchCondition = query
          ? or(ilike(project.name, `%${query}%`), ilike(client.name, `%${query}%`))
          : undefined;
        const conditions = [scopeCondition, statusCondition, searchCondition].filter(
          (condition) => condition !== undefined,
        );
        // Join eksplisit, bukan relational query: `where` pada relational query
        // tidak bisa menjangkau kolom tabel yang di-join, sehingga pencarian
        // berdasarkan nama klien akan diam-diam tidak pernah cocok.
        const rows = await db
          .select({
            id: project.id,
            name: project.name,
            status: project.status,
            financialHealth: project.financialHealth,
            totalContractValue: project.totalContractValue,
            clientName: client.name,
          })
          .from(project)
          .innerJoin(client, eq(project.clientId, client.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(project.updatedAt))
          .limit(limit);

        return {
          appliedFilters: describeFilters([
            query ? `Cocok "${query}"` : null,
            status ? `Status ${statusLabel(status)}` : null,
          ]),
          projects: rows.map((row) => ({
            projectId: row.id,
            name: row.name,
            clientName: row.clientName,
            status: row.status,
            storedHealth: row.financialHealth,
            contractValue: money(row.totalContractValue),
          })),
        };
      },
    }),

    getProjectsAtRisk: tool({
      description:
        "Rank the projects that need attention right now, each with its worst expense category. Use this for any question about which project is most concerning, riskiest, or over budget. Prefer this over calling getProjectBudget for every project one by one.",
      inputSchema: z.object({
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_PROJECT_ROWS)
          .default(5)
          .describe("Maximum number of projects to return."),
      }),
      execute: async ({ limit }) => {
        // Pertanyaan "mana yang paling mengkhawatirkan" dijawab satu panggilan,
        // dan hanya mengembalikan proyek yang benar-benar bermasalah. Sebelumnya
        // model memanggil getProjectBudget untuk setiap proyek, sehingga kartu
        // proyek yang sehat pun ikut muncul dan tidak menjawab apa pun.
        const scopeCondition = hasGlobalScope(context)
          ? undefined
          : eq(project.projectManagerId, context.userId);

        const budgets = await db
          .select({
            projectId: project.id,
            projectName: project.name,
            storedHealth: project.financialHealth,
            budgetId: projectBudgets.id,
          })
          .from(projectBudgets)
          .innerJoin(project, eq(projectBudgets.projectId, project.id))
          .where(scopeCondition);

        if (budgets.length === 0) {
          return { appliedFilters: ["Hanya berisiko"], projects: [] };
        }

        const categories = await db
          .select({
            budgetId: projectBudgetCategory.projectBudgetId,
            name: expenseCategory.name,
            allocated: projectBudgetCategory.allocatedAmount,
            actual: projectBudgetCategory.actualAmount,
            remaining: projectBudgetCategory.remainingAmount,
            usedPercentage: projectBudgetCategory.usedPercentage,
            status: projectBudgetCategory.status,
          })
          .from(projectBudgetCategory)
          .innerJoin(
            expenseCategory,
            eq(projectBudgetCategory.expenseCategoryId, expenseCategory.id),
          )
          .where(
            inArray(
              projectBudgetCategory.projectBudgetId,
              budgets.map((row) => row.budgetId),
            ),
          );

        const assessed = budgets.map((budget) => {
          const own = categories.filter((row) => row.budgetId === budget.budgetId);
          const allocatedTotal = own.reduce((sum, row) => sum + toNumber(row.allocated), 0);
          const actualTotal = own.reduce((sum, row) => sum + toNumber(row.actual), 0);
          const remainingTotal = own.reduce((sum, row) => sum + toNumber(row.remaining), 0);
          const usedPercentage = allocatedTotal > 0 ? (actualTotal / allocatedTotal) * 100 : 0;

          const health = resolveEffectiveProjectHealth({
            storedHealth: budget.storedHealth,
            remainingBudget: remainingTotal,
            usedPercentage,
            categoryStatuses: own.map((row) => row.status),
          });

          // Kategori terburuk: yang minus lebih dulu, lalu pemakaian tertinggi.
          const worst = [...own].sort((left, right) => {
            const leftOver = toNumber(left.remaining) < 0 ? 0 : 1;
            const rightOver = toNumber(right.remaining) < 0 ? 0 : 1;
            if (leftOver !== rightOver) return leftOver - rightOver;
            return toNumber(right.usedPercentage) - toNumber(left.usedPercentage);
          })[0];

          return {
            projectId: budget.projectId,
            projectName: budget.projectName,
            health: health.effectiveHealth,
            reasons: health.healthReasons.map((reason) => projectHealthReasonLabel(reason)),
            usedPercentage: Math.round(usedPercentage * 10) / 10,
            totalRemaining: money(String(remainingTotal)),
            worstCategory: worst
              ? {
                  categoryName: worst.name,
                  usedPercentage: toNumber(worst.usedPercentage),
                  remaining: money(worst.remaining),
                  status: worst.status,
                }
              : null,
          };
        });

        const atRisk = assessed
          .filter((row) => row.health !== "HEALTHY")
          .sort((left, right) => {
            const rank = (row: { health: string }) => (row.health === "CRITICAL" ? 0 : 1);
            const byHealth = rank(left) - rank(right);
            return byHealth !== 0 ? byHealth : right.usedPercentage - left.usedPercentage;
          })
          .slice(0, limit);

        return {
          appliedFilters: ["Hanya berisiko"],
          assessedCount: assessed.length,
          projects: atRisk,
        };
      },
    }),

    getProjectBudget: tool({
      description:
        "Get budget versus actual spending per expense category for one project, including remaining amount, used percentage, and per-category status.",
      inputSchema: z.object({
        projectId: z.guid().describe("The project id, obtained from listProjects."),
      }),
      execute: async ({ projectId }) => {
        if (!(await canAccessProject(context, projectId))) {
          return PROJECT_ACCESS_DENIED;
        }

        const projectRow = await db.query.project.findFirst({
          where: eq(project.id, projectId),
          columns: { name: true },
        });

        const budget = await db.query.projectBudgets.findFirst({
          where: eq(projectBudgets.projectId, projectId),
          columns: {
            id: true,
            status: true,
            internalBudget: true,
            contractValue: true,
            projectProgressPercentage: true,
          },
        });

        if (!budget) {
          return { error: "Proyek ini belum memiliki budget yang tersusun." };
        }

        const categories = await db
          .select({
            name: expenseCategory.name,
            code: expenseCategory.code,
            allocated: projectBudgetCategory.allocatedAmount,
            actual: projectBudgetCategory.actualAmount,
            pending: projectBudgetCategory.pendingAmount,
            remaining: projectBudgetCategory.remainingAmount,
            usedPercentage: projectBudgetCategory.usedPercentage,
            status: projectBudgetCategory.status,
            sortOrder: projectBudgetCategory.sortOrder,
          })
          .from(projectBudgetCategory)
          .innerJoin(
            expenseCategory,
            eq(projectBudgetCategory.expenseCategoryId, expenseCategory.id),
          )
          .where(eq(projectBudgetCategory.projectBudgetId, budget.id))
          .orderBy(projectBudgetCategory.sortOrder);

        return {
          // Id ikut dikembalikan agar kartu di antarmuka bisa membuka budget
          // proyek ini. Model diminta tidak menampilkan id kepada pengguna.
          projectId,
          projectName: projectRow?.name,
          budgetStatus: budget.status,
          internalBudget: money(budget.internalBudget),
          contractValue: money(budget.contractValue),
          projectProgressPercentage: toNumber(budget.projectProgressPercentage),
          categories: categories.map((row) => ({
            categoryName: row.name,
            categoryCode: row.code,
            allocated: money(row.allocated),
            actual: money(row.actual),
            pending: money(row.pending),
            remaining: money(row.remaining),
            usedPercentage: toNumber(row.usedPercentage),
            status: row.status,
          })),
        };
      },
    }),

    getProjectHealth: tool({
      description:
        "Get the effective financial health of one project (HEALTHY, WARNING, or CRITICAL) together with the reasons behind it.",
      inputSchema: z.object({
        projectId: z.guid().describe("The project id, obtained from listProjects."),
      }),
      execute: async ({ projectId }) => {
        if (!(await canAccessProject(context, projectId))) {
          return PROJECT_ACCESS_DENIED;
        }

        const row = await db.query.project.findFirst({
          where: eq(project.id, projectId),
          columns: { name: true, financialHealth: true },
        });

        if (!row) {
          return PROJECT_ACCESS_DENIED;
        }

        const budget = await db.query.projectBudgets.findFirst({
          where: eq(projectBudgets.projectId, projectId),
          columns: { id: true, internalBudget: true },
        });

        if (!budget) {
          return {
            projectName: row.name,
            health: row.financialHealth,
            reasons: [],
            note: "Belum ada budget tersusun, sehingga penilaian hanya memakai status tersimpan.",
          };
        }

        const categories = await db
          .select({
            status: projectBudgetCategory.status,
            remaining: projectBudgetCategory.remainingAmount,
            allocated: projectBudgetCategory.allocatedAmount,
            actual: projectBudgetCategory.actualAmount,
          })
          .from(projectBudgetCategory)
          .where(eq(projectBudgetCategory.projectBudgetId, budget.id));

        const allocatedTotal = categories.reduce((sum, row) => sum + toNumber(row.allocated), 0);
        const actualTotal = categories.reduce((sum, row) => sum + toNumber(row.actual), 0);
        const remainingTotal = categories.reduce((sum, row) => sum + toNumber(row.remaining), 0);
        const usedPercentage = allocatedTotal > 0 ? (actualTotal / allocatedTotal) * 100 : 0;

        const result = resolveEffectiveProjectHealth({
          storedHealth: row.financialHealth,
          remainingBudget: remainingTotal,
          usedPercentage,
          categoryStatuses: categories.map((category) => category.status),
        });

        return {
          projectId,
          projectName: row.name,
          health: result.effectiveHealth,
          reasons: result.healthReasons.map((reason) => projectHealthReasonLabel(reason)),
          totalAllocated: money(String(allocatedTotal)),
          totalActual: money(String(actualTotal)),
          totalRemaining: money(String(remainingTotal)),
          usedPercentage: Math.round(usedPercentage * 10) / 10,
        };
      },
    }),
  };
}
