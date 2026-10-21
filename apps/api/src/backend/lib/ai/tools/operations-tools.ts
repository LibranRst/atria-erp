import { db } from "@backend/db";
import { INSTANCE_TENANT_ID } from "@backend/db/schema";
import {
  expenseCategory,
  project,
  projectExpenses,
  projectRap,
  projectRapItem,
  stockMovement,
} from "@backend/db/schema";
import { projectMaterialProjection } from "@atria/core/material/project-material-projection";
import { tool } from "ai";
import { and, count, desc, eq, gte, ilike, inArray, lt, or } from "drizzle-orm";
import { z } from "zod";

import {
  accessibleProjectIds,
  canAccessProject,
  hasPermission,
  permissionDenied,
  PROJECT_ACCESS_DENIED,
  projectScopeCondition,
  type AiToolContext,
} from "./context";
import { describeFilters, money, toNumber } from "./shared";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import {
  isFinancialHistoryQuestion,
  parseFinancialHistoryRequest,
} from "@atria/core/ai/financial-history";
import {
  isExpenseStatusQuestion,
  isSupportedCurrentExpenseStatusQuestion,
} from "../grounded-expenses";

/**
 * Tool batch 3: kebutuhan material lapangan, pengeluaran terakhir, dan kategori
 * biaya dari Settings. Ini bagian yang paling dipakai PM di lokasi proyek.
 */

const MAX_ROWS = 20;
const expenseDateSchema = z.iso.date();
const jakartaDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function buildOperationsTools(context: AiToolContext) {
  return {
    getMaterialShortage: tool({
      description:
        "For one project, list RAP material items that still need to be bought, comparing required quantity against what is already secured through purchase, receipt, or reservation.",
      inputSchema: z.object({
        projectId: z.guid().describe("The project id, obtained from listProjects."),
        limit: z.number().int().min(1).max(MAX_ROWS).default(10),
      }),
      execute: async ({ projectId, limit }) => {
        if (!hasPermission(context, "view:material")) {
          return permissionDenied("data material dan stok");
        }
        if (!(await canAccessProject(context, projectId))) {
          return PROJECT_ACCESS_DENIED;
        }

        const rap = await db.query.projectRap.findFirst({
          where: eq(projectRap.projectId, projectId),
          columns: { id: true, status: true },
          orderBy: [desc(projectRap.revision)],
        });

        if (!rap) {
          return { error: "Proyek ini belum memiliki RAP material." };
        }

        const items = await db.query.projectRapItem.findMany({
          where: eq(projectRapItem.projectRapId, rap.id),
          columns: {
            id: true,
            name: true,
            unit: true,
            totalQuantity: true,
            estimatedUnitCost: true,
          },
        });

        if (items.length === 0) {
          return { rapStatus: rap.status, shortages: [], note: "RAP belum berisi item material." };
        }

        const movements = await db
          .select({
            projectRapItemId: stockMovement.projectRapItemId,
            movementType: stockMovement.movementType,
            quantity: stockMovement.quantity,
            createdAt: stockMovement.createdAt,
            id: stockMovement.id,
          })
          .from(stockMovement)
          .where(
            and(
              eq(stockMovement.projectId, projectId),
              inArray(
                stockMovement.projectRapItemId,
                items.map((item) => item.id),
              ),
            ),
          );

        const shortages = items
          .map((item) => {
            const itemMovements = movements
              .filter((movement) => movement.projectRapItemId === item.id)
              .map((movement) => ({
                projectRapItemId: movement.projectRapItemId,
                movementType: movement.movementType,
                quantity: movement.quantity,
                createdAt: movement.createdAt,
                id: movement.id,
              }));

            const required = toNumber(item.totalQuantity);
            const projection = projectMaterialProjection(itemMovements, required);

            return {
              materialName: item.name,
              unit: item.unit,
              requiredQuantity: required,
              securedQuantity: projection.securedQuantity,
              needToBuyQuantity: projection.needToBuy,
              estimatedPurchaseCost: money(
                String(projection.needToBuy * toNumber(item.estimatedUnitCost)),
              ),
            };
          })
          .filter((item) => item.needToBuyQuantity > 0)
          .sort(
            (left, right) => right.estimatedPurchaseCost.amount - left.estimatedPurchaseCost.amount,
          )
          .slice(0, limit);

        const totalCost = shortages.reduce(
          (sum, item) => sum + item.estimatedPurchaseCost.amount,
          0,
        );

        return {
          projectId,
          rapStatus: rap.status,
          shortageCount: shortages.length,
          estimatedTotalPurchaseCost: money(String(totalCost)),
          shortages,
        };
      },
    }),

    getRecentExpenses: tool({
      description:
        "Read current recorded expense statuses and exact amounts in the actor's project scope. Search description with query, project with projectQuery or actual projectId, canonical/field expense with expenseId, status/category, or inclusive Jakarta expenseDate from/to. Canonical id and projectCostId are different: payment tools require projectCostId. Results are bounded (20/page), matchedCount/hasMore require pagination; never sum a recent page as all project expenses. Duplicate descriptions and one-character queries require human choice, never auto-select the first. No historical status/paid-at inference.",
      inputSchema: z
        .object({
          projectId: z
            .guid()
            .optional()
            .describe("Narrow to one project. Omit to cover every project the user can access."),
          expenseId: z.guid().optional(),
          query: z.string().trim().min(1).max(160).optional(),
          projectQuery: z.string().trim().min(1).max(120).optional(),
          categoryCode: z
            .enum(["MATERIAL", "TUKANG", "OPERASIONAL", "LAIN_LAIN", "SUBCON"])
            .optional(),
          status: z
            .enum(["SUBMITTED", "VERIFIED", "APPROVED", "REJECTED", "PAID", "INVENTORY_ASSET"])
            .optional(),
          dateFrom: expenseDateSchema.optional(),
          dateTo: expenseDateSchema.optional(),
          limit: z.number().int().min(1).max(MAX_ROWS).default(10),
          offset: z.number().int().min(0).max(100000).default(0),
        })
        .refine((input) => !input.dateFrom || !input.dateTo || input.dateFrom <= input.dateTo, {
          message: "Tanggal awal tidak boleh melewati tanggal akhir.",
          path: ["dateTo"],
        }),
      execute: async ({
        projectId,
        expenseId,
        query,
        projectQuery,
        categoryCode,
        status,
        dateFrom,
        dateTo,
        limit,
        offset,
      }) => {
        if (!hasPermission(context, "view:cost")) {
          return permissionDenied("data pengeluaran proyek");
        }
        if (context.dataScope === "NONE") return PROJECT_ACCESS_DENIED;
        const asOf = context.asOf ? new Date(context.asOf) : new Date();
        const datedQuestion =
          context.userQuestion && isFinancialHistoryQuestion(context.userQuestion);
        if (
          datedQuestion &&
          isExpenseStatusQuestion(context.userQuestion ?? "") &&
          !isSupportedCurrentExpenseStatusQuestion(context.userQuestion ?? "")
        ) {
          return {
            error:
              "Riwayat status persetujuan pada tanggal lampau belum tersedia. Sebutkan status saat ini untuk pengeluaran pada tanggal tersebut.",
          };
        }
        const dateRequest = datedQuestion
          ? parseFinancialHistoryRequest(context.userQuestion ?? "", asOf)
          : null;
        if (dateRequest?.error) return { error: dateRequest.error };
        if (dateRequest && (dateRequest.periods.length !== 1 || dateRequest.comparison)) {
          return {
            error:
              "Gunakan laporan periode untuk perbandingan. Daftar status saat ini memerlukan satu rentang tanggal pengeluaran.",
          };
        }
        const dateRange = dateRequest?.periods[0]
          ? { ...dateRequest.periods[0], asOf: asOf.toISOString() }
          : undefined;

        if (projectId && !(await canAccessProject(context, projectId))) {
          return PROJECT_ACCESS_DENIED;
        }

        const projectIds = await accessibleProjectIds(context);
        const conditions = [
          eq(projectExpenses.tenantId, INSTANCE_TENANT_ID),
          eq(project.tenantId, INSTANCE_TENANT_ID),
          eq(expenseCategory.tenantId, INSTANCE_TENANT_ID),
        ];
        if (projectId) {
          conditions.push(eq(projectExpenses.projectId, projectId));
        } else {
          const scope = projectScopeCondition(projectIds, projectExpenses.projectId);
          if (scope) conditions.push(scope);
        }
        const idCondition = expenseId
          ? or(
              eq(projectExpenses.id, expenseId),
              eq(projectExpenses.legacyProjectCostId, expenseId),
            )
          : undefined;
        if (idCondition) conditions.push(idCondition);
        // Treat a user's search as literal text; '%' and '_' cannot broaden the query.
        const literalPattern = (value: string): string => `%${value.replace(/[\\%_]/g, "\\$&")}%`;
        const descriptionSearchCondition = query
          ? ilike(projectExpenses.description, literalPattern(query))
          : undefined;
        if (descriptionSearchCondition) conditions.push(descriptionSearchCondition);
        if (projectQuery) conditions.push(ilike(project.name, literalPattern(projectQuery)));
        if (categoryCode) conditions.push(eq(expenseCategory.code, categoryCode));
        const statusCondition = status ? eq(projectExpenses.status, status) : undefined;
        if (statusCondition) conditions.push(statusCondition);
        if (dateRange) {
          conditions.push(
            gte(projectExpenses.expenseDate, new Date(dateRange.start)),
            lt(projectExpenses.expenseDate, new Date(dateRange.end)),
          );
        } else {
          if (dateFrom)
            conditions.push(
              gte(projectExpenses.expenseDate, new Date(`${dateFrom}T00:00:00+07:00`)),
            );
          if (dateTo)
            conditions.push(
              lt(
                projectExpenses.expenseDate,
                new Date(new Date(`${dateTo}T00:00:00+07:00`).getTime() + 86400000),
              ),
            );
        }

        const rows = await db
          .select({
            id: projectExpenses.id,
            projectCostId: projectExpenses.legacyProjectCostId,
            description: projectExpenses.description,
            amount: projectExpenses.amount,
            status: projectExpenses.status,
            paymentStatus: projectExpenses.paymentStatus,
            expenseDate: projectExpenses.expenseDate,
            projectId: projectExpenses.projectId,
            projectName: project.name,
            categoryName: expenseCategory.name,
            categoryId: expenseCategory.id,
            categoryCode: expenseCategory.code,
            sourceType: projectExpenses.sourceType,
            isCashImpact: projectExpenses.isCashImpact,
          })
          .from(projectExpenses)
          .innerJoin(project, eq(projectExpenses.projectId, project.id))
          .innerJoin(expenseCategory, eq(projectExpenses.expenseCategoryId, expenseCategory.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(projectExpenses.expenseDate), desc(projectExpenses.id))
          .limit(limit + 1)
          .offset(offset);
        const [matched] = await db
          .select({ value: count() })
          .from(projectExpenses)
          .innerJoin(project, eq(projectExpenses.projectId, project.id))
          .innerJoin(expenseCategory, eq(projectExpenses.expenseCategoryId, expenseCategory.id))
          .where(and(...conditions));
        const hasMore = rows.length > limit;
        let descriptionMatchesInScope: number | undefined;
        if (expenseId && rows.length === 1) {
          // An ID from the model is not a human choice. Check this exact name in
          // the current authorized/project/date/category scope independently of
          // that ID and lifecycle filter before a named reread can be certified.
          const [sameDescription] = await db
            .select({ value: count() })
            .from(projectExpenses)
            .innerJoin(project, eq(projectExpenses.projectId, project.id))
            .innerJoin(expenseCategory, eq(projectExpenses.expenseCategoryId, expenseCategory.id))
            .where(
              and(
                ...conditions.filter(
                  (condition) =>
                    condition !== idCondition &&
                    condition !== statusCondition &&
                    condition !== descriptionSearchCondition,
                ),
                ilike(projectExpenses.description, rows[0].description.replace(/[\\%_]/g, "\\$&")),
              ),
            );
          descriptionMatchesInScope = sameDescription?.value ?? 0;
        }
        const scopedProject = projectId
          ? await db.query.project.findFirst({
              where: and(eq(project.id, projectId), eq(project.tenantId, INSTANCE_TENANT_ID)),
              columns: { id: true, name: true },
            })
          : undefined;

        return {
          appliedFilters: describeFilters([
            query ? `Deskripsi cocok "${query}"` : null,
            projectQuery ? `Proyek cocok "${projectQuery}"` : null,
            categoryCode ? `Kategori ${formatBusinessLabel(categoryCode)}` : null,
            status ? `Status ${formatBusinessLabel(status)}` : null,
            dateRange
              ? `Tanggal pengeluaran ${dateRange.label} (Asia/Jakarta)`
              : dateFrom || dateTo
                ? `Tanggal pengeluaran ${dateFrom ?? "awal"}–${dateTo ?? "sekarang"} (Asia/Jakarta)`
                : null,
          ]),
          offset,
          limit,
          hasMore,
          nextOffset: hasMore ? offset + limit : null,
          matchedCount: matched?.value ?? 0,
          ...(scopedProject ? { project: scopedProject } : {}),
          ...(dateRange ? { dateRange } : {}),
          requiresExpenseChoice:
            query?.length === 1 ||
            projectQuery?.length === 1 ||
            Boolean(query && (matched?.value ?? 0) > 1),
          scope:
            "Pengeluaran tercatat pada proyek dalam akses Anda; halaman ini bukan total seluruh proyek.",
          dateBasis: "expenseDate" as const,
          timeZone: "Asia/Jakarta" as const,
          expenses: rows.slice(0, limit).map((row) => ({
            id: row.id,
            projectCostId: row.projectCostId,
            description: row.description,
            projectId: row.projectId,
            projectName: row.projectName,
            categoryName: row.categoryName,
            categoryId: row.categoryId,
            categoryCode: row.categoryCode,
            amount: money(row.amount),
            exactAmount: row.amount,
            status: row.status,
            paymentStatus: row.paymentStatus,
            expenseDate: jakartaDate.format(row.expenseDate),
            sourceType: row.sourceType,
            isCashImpact: row.isCashImpact,
            ...(descriptionMatchesInScope !== undefined ? { descriptionMatchesInScope } : {}),
          })),
        };
      },
    }),

    getExpenseCategories: tool({
      description:
        "List the active expense categories configured in Settings. Use to map a user's wording onto a real category before drafting an expense.",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await db.query.expenseCategory.findMany({
          where: and(
            eq(expenseCategory.tenantId, INSTANCE_TENANT_ID),
            eq(expenseCategory.isActive, true),
          ),
          columns: { code: true, name: true, description: true },
          orderBy: [expenseCategory.sortOrder],
        });

        return {
          categories: rows.map((row) => ({
            code: row.code,
            name: row.name,
            description: row.description,
          })),
        };
      },
    }),
  };
}
