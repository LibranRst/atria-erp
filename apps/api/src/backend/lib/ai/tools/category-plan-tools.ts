import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { db } from "@backend/db";
import { INSTANCE_TENANT_ID, project, vendor, itemPriceLibrary } from "@backend/db/schema";
import { and, asc, eq, ilike, inArray, or } from "drizzle-orm";
import { packageInputSchema, packageCategorySchema } from "@atria/core/ai/category-plan";
import { rapIdSchema } from "@atria/core/ai/rap-draft";
import {
  canPlanPackages,
  readPackageContext,
  currentPackageItems,
  packageSnapshot,
  buildPackageProposal,
  packageFailure,
} from "@backend/server/usecases/ai/category-plan-context";
import { permissionDenied, type AiToolContext } from "./context";

export function buildCategoryPlanTools(context: AiToolContext): ToolSet {
  return {
    getCategoryPlanContext: tool({
      description:
        "Read-only scoped lookup for Tukang/Subcon packages, category budget usage, existing package IDs, active Settings templates and vendor names/IDs. Ask user to choose ambiguous matches. offset paginates50 packages; hasMore flags additional candidates. No finance, stock or business changes.",
      inputSchema: z
        .object({
          projectId: rapIdSchema.optional(),
          projectQuery: z.string().max(100).optional(),
          category: packageCategorySchema.optional(),
          packageQuery: z.string().max(100).optional(),
          templateQuery: z.string().max(100).optional(),
          vendorQuery: z.string().max(100).optional(),
          offset: z.number().int().min(0).max(100000).default(0),
        })
        .strict(),
      execute: async (input) => {
        if (!canPlanPackages(context))
          return permissionDenied("perencanaan paket dan budget proyek");
        try {
          if (!input.projectId) {
            const projects = await db.query.project.findMany({
              where: and(
                eq(project.tenantId, INSTANCE_TENANT_ID),
                inArray(project.status, ["DRAFT", "ACTIVE"]),
                context.dataScope === "ASSIGNED"
                  ? eq(project.projectManagerId, context.userId)
                  : undefined,
                input.projectQuery
                  ? ilike(project.name, `%${input.projectQuery.trim()}%`)
                  : undefined,
              ),
              columns: { id: true, name: true },
              orderBy: [asc(project.name)],
              limit: 21,
            });
            return {
              projects: projects.slice(0, 20),
              hasMore: projects.length > 20,
              needsDisambiguation: projects.length > 1,
            };
          }
          const state = await readPackageContext(context, input.projectId);
          const categories = state.budget.categories.filter(
            (c) =>
              (c.expenseCategory.code === "TUKANG" || c.expenseCategory.code === "SUBCON") &&
              (!input.category || c.expenseCategory.code === input.category),
          );
          const query = input.packageQuery?.trim().toLocaleLowerCase("id-ID");
          const items = currentPackageItems(state).filter(
            (i) =>
              categories.some((c) => c.id === i.projectBudgetCategoryId) &&
              (!query || `${i.name} ${i.area}`.toLocaleLowerCase("id-ID").includes(query)),
          );
          const templates = categories.length
            ? await db.query.itemPriceLibrary.findMany({
                where: and(
                  eq(itemPriceLibrary.tenantId, INSTANCE_TENANT_ID),
                  eq(itemPriceLibrary.isActive, true),
                  inArray(
                    itemPriceLibrary.expenseCategoryId,
                    categories.map((c) => c.expenseCategoryId),
                  ),
                  or(
                    eq(itemPriceLibrary.itemType, "WORK_PACKAGE"),
                    eq(itemPriceLibrary.itemType, "SUBCON_PACKAGE"),
                  ),
                  input.templateQuery
                    ? ilike(itemPriceLibrary.name, `%${input.templateQuery.trim()}%`)
                    : undefined,
                ),
                orderBy: [asc(itemPriceLibrary.name)],
                limit: 21,
              })
            : [];
          const vendors = await db.query.vendor.findMany({
            where: and(
              eq(vendor.tenantId, INSTANCE_TENANT_ID),
              eq(vendor.isActive, true),
              input.vendorQuery ? ilike(vendor.name, `%${input.vendorQuery.trim()}%`) : undefined,
            ),
            columns: { id: true, name: true },
            orderBy: [asc(vendor.name)],
            limit: 21,
          });
          return {
            project: { id: state.project.id, name: state.project.name },
            rap: state.rap ? { id: state.rap.id, setupStage: state.rap.setupStage } : null,
            budgets: categories.map((c) => ({
              category: c.expenseCategory.code,
              allocated: c.allocatedAmount,
              actual: c.actualAmount,
              pending: c.pendingAmount,
              remaining: c.remainingAmount,
            })),
            items: items.slice(input.offset, input.offset + 50).map((i) => ({
              itemId: i.id,
              category: i.expenseCategory.code,
              statusLabel:
                i.status === "DRAFT"
                  ? "Draft"
                  : i.status === "ACTIVE"
                    ? "Siap"
                    : i.status === "LOCKED"
                      ? "Terkunci"
                      : "Selesai",
              ...packageSnapshot(i),
            })),
            totalMatches: items.length,
            hasMore: items.length > input.offset + 50,
            needsDisambiguation: Boolean(query) && items.length > 1,
            templates: templates.slice(0, 20).map((t) => ({
              id: t.id,
              name: t.name,
              scopeDescription: t.description,
              unit: t.unit,
              estimatedUnitCost: t.defaultInternalCost,
              vendorId: t.defaultVendorId,
              itemType: t.itemType,
            })),
            templatesHasMore: templates.length > 20,
            vendors: vendors.slice(0, 20),
            vendorsHasMore: vendors.length > 20,
            instruction:
              "Gunakan ID lookup yang sesuai. Paket Siap perlu Edit Lagi secara manual; RAP terkunci perlu revisi. Estimasi bukan realisasi biaya. Harga manual harus diberikan pengguna; template hanya memakai referensi aktif dan override beralasan.",
          };
        } catch (error: unknown) {
          return packageFailure(error);
        }
      },
    }),
    proposeCategoryPlanPackages: tool({
      description:
        "Prepare an immutable reviewed proposal to create/edit1–50 Tukang/Subcon Draft packages in one project, including mixed categories. Use getCategoryPlanContext for IDs/budget/templates/vendors. MANUAL requires complete name, area, quantity, unit and user-supplied unit estimate. LIBRARY derives name/scope/unit/vendor from active Settings template; price override needs reason. UPDATE only current Draft package IDs with partial changes; unspecified fields and category/source/client prices preserved. Ask for ambiguous/missing inputs. No readiness, deletion, finalization, stock, cash or expense changes. Corrections generate a fresh complete proposal. Only explicit user confirmation button saves all rows atomically; never execute from chat approval. No writes.",
      inputSchema: packageInputSchema,
      execute: async (input) => {
        if (!canPlanPackages(context))
          return permissionDenied("perencanaan paket dan budget proyek");
        try {
          return {
            proposal: buildPackageProposal(
              input,
              await readPackageContext(context, input.projectId, input),
            ),
            instruction:
              "Review kategori, lingkup, vendor dan biaya sebelum/sesudah. Hanya tombol konfirmasi menyimpan seluruh paket sebagai Draft. Alokasi, realisasi, stok dan kas tetap.",
          };
        } catch (error: unknown) {
          return packageFailure(error);
        }
      },
    }),
  };
}
