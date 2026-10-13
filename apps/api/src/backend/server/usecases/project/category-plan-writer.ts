import {
  auditLog,
  INSTANCE_TENANT_ID,
  projectRap,
  projectCategoryPlanItem,
  projectBudgetCategory,
  projectBudgets,
  expenseCategory,
  vendor,
  itemPriceLibrary,
} from "@backend/db/schema";
import {
  assertFinancePermission,
  lockFinanceProject,
  type FinanceTransaction,
} from "../finance/mutation-access";
import type { Actor } from "@backend/server/actor";
import type {
  CreateProjectCategoryPlanItemInput,
  UpdateProjectCategoryPlanItemInput,
} from "@atria/core/validations/category-plan";
import { calculateRapMaterialCost } from "@atria/core/project/rap-cost";
import { and, desc, eq, ne } from "drizzle-orm";
import type { z } from "zod";
import type { copyTemplateToCategoryPlanSchema } from "@atria/core/validations/workflow-governance";

type Item = typeof projectCategoryPlanItem.$inferSelect;
export async function lockPackageProjectTx(
  tx: FinanceTransaction,
  actor: Actor,
  projectId: string,
): Promise<typeof projectRap.$inferSelect | undefined> {
  assertFinancePermission(actor, "update:budget");
  const project = await lockFinanceProject(tx, actor, projectId);
  if (project.tenantId !== INSTANCE_TENANT_ID || !["DRAFT", "ACTIVE"].includes(project.status))
    throw new Error("FORBIDDEN: Proyek tidak tersedia untuk perencanaan.");
  const [rap] = await tx
    .select()
    .from(projectRap)
    .where(and(eq(projectRap.projectId, projectId), eq(projectRap.tenantId, INSTANCE_TENANT_ID)))
    .orderBy(desc(projectRap.revision), desc(projectRap.createdAt))
    .limit(1)
    .for("update");
  if (rap && rap.status !== "DRAFT")
    throw new Error("FORBIDDEN: RAP sudah terkunci. Gunakan alur revisi.");
  return rap;
}
export async function resolvePackageCategoryTx(
  tx: FinanceTransaction,
  projectId: string,
  categoryId: string,
): Promise<typeof projectBudgetCategory.$inferSelect & { code: "TUKANG" | "SUBCON" }> {
  const [budget] = await tx
    .select()
    .from(projectBudgets)
    .where(
      and(eq(projectBudgets.projectId, projectId), eq(projectBudgets.tenantId, INSTANCE_TENANT_ID)),
    )
    .for("share");
  const [category] = await tx
    .select()
    .from(projectBudgetCategory)
    .where(
      and(
        eq(projectBudgetCategory.id, categoryId),
        eq(projectBudgetCategory.tenantId, INSTANCE_TENANT_ID),
      ),
    )
    .for("share");
  if (!budget || !category || category.projectBudgetId !== budget.id)
    throw new Error("PROJECT_BUDGET_CATEGORY_NOT_FOUND");
  const [expense] = await tx
    .select()
    .from(expenseCategory)
    .where(
      and(
        eq(expenseCategory.id, category.expenseCategoryId),
        eq(expenseCategory.tenantId, INSTANCE_TENANT_ID),
      ),
    )
    .for("share");
  if (!expense || !(expense.code === "TUKANG" || expense.code === "SUBCON"))
    throw new Error("CATEGORY_PLAN_ONLY_ALLOWED_FOR_TUKANG_OR_SUBCON");
  return { ...category, code: expense.code };
}
async function checkVendor(tx: FinanceTransaction, id: string | null | undefined): Promise<void> {
  if (!id) return;
  const [record] = await tx
    .select()
    .from(vendor)
    .where(and(eq(vendor.id, id), eq(vendor.tenantId, INSTANCE_TENANT_ID)))
    .for("share");
  if (!record?.isActive) throw new Error("VENDOR_NOT_FOUND");
}
function values(input: CreateProjectCategoryPlanItemInput): {
  quantity: string;
  estimatedUnitCost: string;
  estimatedTotalCost: string;
} {
  const cost = calculateRapMaterialCost({
    requiredQuantity: input.quantity,
    bufferQuantity: 0,
    estimatedUnitCost: input.estimatedUnitCost,
  });
  return {
    quantity: cost.requiredQuantity,
    estimatedUnitCost: cost.estimatedUnitCost,
    estimatedTotalCost: cost.estimatedTotalCost,
  };
}
async function audit(
  tx: FinanceTransaction,
  actor: Actor,
  action: string,
  row: Item,
  before?: Item,
): Promise<void> {
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action,
    targetTable: "project_category_plan_item",
    targetId: row.id,
    originalState: before ? JSON.stringify(before) : null,
    newState: JSON.stringify(row),
  });
}
export async function createPackageTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: CreateProjectCategoryPlanItemInput,
  source?: { readonly libraryId: string; readonly clientUnitPrice: string },
  id?: string,
): Promise<Item> {
  const rap = await lockPackageProjectTx(tx, actor, input.projectId);
  const category = await resolvePackageCategoryTx(
    tx,
    input.projectId,
    input.projectBudgetCategoryId,
  );
  if (rap && (category.code === "TUKANG" ? rap.tukangScopeSkipped : rap.subconScopeSkipped))
    throw new Error(
      "FORBIDDEN: Scope kategori tidak digunakan. Buka kembali scope sebelum menambahkan paket.",
    );
  await checkVendor(tx, input.vendorId);
  const [row] = await tx
    .insert(projectCategoryPlanItem)
    .values({
      ...input,
      id,
      ...values(input),
      tenantId: INSTANCE_TENANT_ID,
      projectBudgetId: category.projectBudgetId,
      expenseCategoryId: category.expenseCategoryId,
      vendorId: input.vendorId ?? null,
      scopeDescription: input.scopeDescription ?? null,
      internalNote: input.internalNote ?? null,
      sourceLibraryItemId: source?.libraryId ?? null,
      suggestedClientUnitPrice: source?.clientUnitPrice ?? "0.00",
      status: "DRAFT",
      displayOrder: input.displayOrder ?? 0,
    })
    .returning();
  await audit(
    tx,
    actor,
    source ? "COPY_PRICING_TEMPLATE_TO_CATEGORY_PLAN" : "CREATE_CATEGORY_PLAN_DRAFT",
    row,
  );
  return row;
}
async function lockItem(
  tx: FinanceTransaction,
  actor: Actor,
  id: string,
  requiredStatus: string,
): Promise<Item> {
  const found = await tx.query.projectCategoryPlanItem.findFirst({
    where: and(
      eq(projectCategoryPlanItem.id, id),
      eq(projectCategoryPlanItem.tenantId, INSTANCE_TENANT_ID),
    ),
  });
  if (!found) throw new Error("CATEGORY_PLAN_ITEM_NOT_FOUND");
  await lockPackageProjectTx(tx, actor, found.projectId);
  const [row] = await tx
    .select()
    .from(projectCategoryPlanItem)
    .where(eq(projectCategoryPlanItem.id, id))
    .for("update");
  if (!row || row.status !== requiredStatus)
    throw new Error(
      "Paket berubah atau tidak berada pada kondisi yang dapat diedit. Periksa kembali paket.",
    );
  const revision = await tx.query.projectCategoryPlanItem.findFirst({
    where: and(
      eq(projectCategoryPlanItem.supersedesProjectCategoryPlanItemId, id),
      ne(projectCategoryPlanItem.status, "CANCELLED"),
    ),
  });
  if (revision) throw new Error("Paket sudah memiliki revisi yang lebih baru.");
  return row;
}
export async function updatePackageTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: UpdateProjectCategoryPlanItemInput,
): Promise<Item> {
  const existing = await lockItem(tx, actor, input.projectCategoryPlanItemId, "DRAFT");
  if (existing.projectId !== input.projectId)
    throw new Error("CATEGORY_PLAN_ITEM_PROJECT_MISMATCH");
  const category = await resolvePackageCategoryTx(
    tx,
    input.projectId,
    input.projectBudgetCategoryId,
  );
  const rap = await lockPackageProjectTx(tx, actor, input.projectId);
  if (rap && (category.code === "TUKANG" ? rap.tukangScopeSkipped : rap.subconScopeSkipped))
    throw new Error("FORBIDDEN: Scope kategori tidak digunakan.");
  await checkVendor(tx, input.vendorId);
  const [row] = await tx
    .update(projectCategoryPlanItem)
    .set({
      projectBudgetId: category.projectBudgetId,
      projectBudgetCategoryId: category.id,
      expenseCategoryId: category.expenseCategoryId,
      name: input.name,
      scopeDescription: input.scopeDescription ?? null,
      area: input.area,
      unit: input.unit,
      ...values(input),
      vendorId: input.vendorId ?? null,
      internalNote: input.internalNote ?? null,
      status: input.status ?? existing.status,
      displayOrder: input.displayOrder ?? existing.displayOrder,
      updatedAt: new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1)),
    })
    .where(eq(projectCategoryPlanItem.id, existing.id))
    .returning();
  await audit(tx, actor, "UPDATE_CATEGORY_PLAN_DRAFT", row, existing);
  return row;
}
export async function changePackageStatusTx(
  tx: FinanceTransaction,
  actor: Actor,
  id: string,
  status: "DRAFT" | "ACTIVE",
): Promise<Item> {
  const existing = await lockItem(tx, actor, id, status === "DRAFT" ? "ACTIVE" : "DRAFT");
  if (status === "ACTIVE") {
    const category = await resolvePackageCategoryTx(
      tx,
      existing.projectId,
      existing.projectBudgetCategoryId,
    );
    const rap = await lockPackageProjectTx(tx, actor, existing.projectId);
    if (rap && (category.code === "TUKANG" ? rap.tukangScopeSkipped : rap.subconScopeSkipped))
      throw new Error("Buka kembali scope sebelum menyiapkan paket.");
  }
  const [row] = await tx
    .update(projectCategoryPlanItem)
    .set({ status, updatedAt: new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1)) })
    .where(eq(projectCategoryPlanItem.id, id))
    .returning();
  await audit(
    tx,
    actor,
    status === "DRAFT" ? "REOPEN_CATEGORY_PLAN_PACKAGE" : "MARK_CATEGORY_PLAN_PACKAGE_READY",
    row,
    existing,
  );
  return row;
}
export async function deletePackageTx(
  tx: FinanceTransaction,
  actor: Actor,
  id: string,
): Promise<void> {
  const existing = await lockItem(tx, actor, id, "DRAFT");
  await tx.delete(projectCategoryPlanItem).where(eq(projectCategoryPlanItem.id, id));
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "DELETE_CATEGORY_PLAN_DRAFT",
    targetTable: "project_category_plan_item",
    targetId: id,
    originalState: JSON.stringify(existing),
  });
}
export async function copyPackageTemplateTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: z.infer<typeof copyTemplateToCategoryPlanSchema>,
  id?: string,
): Promise<Item> {
  await lockPackageProjectTx(tx, actor, input.projectId);
  const category = await resolvePackageCategoryTx(
    tx,
    input.projectId,
    input.projectBudgetCategoryId,
  );
  const [template] = await tx
    .select()
    .from(itemPriceLibrary)
    .where(
      and(
        eq(itemPriceLibrary.id, input.itemPriceLibraryId),
        eq(itemPriceLibrary.tenantId, INSTANCE_TENANT_ID),
      ),
    )
    .for("share");
  if (
    !template?.isActive ||
    template.expenseCategoryId !== category.expenseCategoryId ||
    template.itemType !== (category.code === "TUKANG" ? "WORK_PACKAGE" : "SUBCON_PACKAGE")
  )
    throw new Error("ITEM_PRICE_LIBRARY_NOT_FOUND");
  return createPackageTx(
    tx,
    actor,
    {
      projectId: input.projectId,
      projectBudgetCategoryId: category.id,
      name: template.name,
      scopeDescription: template.description,
      area: input.area,
      quantity: input.quantity,
      unit: template.unit,
      estimatedUnitCost: input.overrideUnitCost ?? Number(template.defaultInternalCost),
      vendorId: template.defaultVendorId,
      internalNote: input.overrideReason ?? `Snapshot template ${template.code ?? template.name}.`,
    },
    { libraryId: template.id, clientUnitPrice: template.defaultClientPrice },
    id,
  );
}
