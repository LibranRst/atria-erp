import { and, eq } from "drizzle-orm";
import {
  budgetAllocationSetting,
  budgetAllocationSettingCategory,
  expenseCategory,
  auditLog,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { actorCan } from "@backend/lib/auth/permissions";
import type { Actor } from "@backend/server/actor";
import type { FinanceTransaction } from "../finance/mutation-access";
import {
  updateBudgetAllocationDefaultsSchema,
  type UpdateBudgetAllocationDefaultsInput,
} from "@atria/core/validations/settings";

export function assertBudgetDefaultsRights(actor: Pick<Actor, "permissions" | "dataScope">): void {
  if (!actorCan(actor, "manage:budget_settings"))
    throw new Error("FORBIDDEN: Perubahan default budget memerlukan izin pengaturan perusahaan.");
}
export async function lockBudgetDefaultsTx(
  tx: FinanceTransaction,
  actor: Actor,
  id: string,
): Promise<void> {
  assertBudgetDefaultsRights(actor);
  const [record] = await tx
    .select({ id: budgetAllocationSetting.id })
    .from(budgetAllocationSetting)
    .where(
      and(
        eq(budgetAllocationSetting.id, id),
        eq(budgetAllocationSetting.tenantId, INSTANCE_TENANT_ID),
      ),
    )
    .for("update");
  if (!record) throw new Error("Setting budget tidak ditemukan.");
  await tx
    .select({ id: budgetAllocationSettingCategory.id })
    .from(budgetAllocationSettingCategory)
    .where(eq(budgetAllocationSettingCategory.budgetAllocationSettingId, id))
    .for("update");
}
export async function writeBudgetDefaultsTx(
  tx: FinanceTransaction,
  actor: Actor,
  raw: UpdateBudgetAllocationDefaultsInput,
): Promise<string> {
  const input = updateBudgetAllocationDefaultsSchema.parse(raw);
  await lockBudgetDefaultsTx(tx, actor, input.budgetAllocationSettingId);
  const before = await tx.query.budgetAllocationSetting.findFirst({
    where: eq(budgetAllocationSetting.id, input.budgetAllocationSettingId),
    with: { categories: { with: { expenseCategory: true } } },
  });
  if (!before) throw new Error("Setting budget tidak ditemukan.");
  const ids = new Set(before.categories.map((row) => row.id));
  if (
    input.categories.length !== ids.size ||
    new Set(input.categories.map((row) => row.budgetAllocationSettingCategoryId)).size !==
      ids.size ||
    input.categories.some((row) => !ids.has(row.budgetAllocationSettingCategoryId))
  )
    throw new Error("Daftar kategori budget tidak lengkap atau tidak sesuai.");
  const [setting] = await tx
    .update(budgetAllocationSetting)
    .set({
      name: input.name.trim(),
      budgetCapRatio: input.budgetCapRatio.toFixed(6),
      notes: input.notes?.trim() || null,
      updatedById: actor.userId,
      updatedAt: new Date(),
    })
    .where(eq(budgetAllocationSetting.id, before.id))
    .returning();
  for (const row of input.categories) {
    const current = before.categories.find((c) => c.id === row.budgetAllocationSettingCategoryId);
    if (!current) throw new Error("Kategori budget berubah.");
    const [updated] = await tx
      .update(budgetAllocationSettingCategory)
      .set({
        ratioPercentage: row.ratioPercentage.toFixed(6),
        isEnabled: row.isEnabled,
        updatedAt: new Date(),
      })
      .where(eq(budgetAllocationSettingCategory.id, current.id))
      .returning();
    await tx
      .update(expenseCategory)
      .set({ defaultRatio: row.ratioPercentage.toFixed(6), updatedAt: new Date() })
      .where(eq(expenseCategory.id, current.expenseCategoryId));
    await tx.insert(auditLog).values({
      userId: actor.userId,
      action: "UPDATE_BUDGET_ALLOCATION_CATEGORY",
      targetTable: "budget_allocation_setting_category",
      targetId: updated.id,
      originalState: JSON.stringify(current),
      newState: JSON.stringify(updated),
    });
  }
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "UPDATE_BUDGET_ALLOCATION_DEFAULTS",
    targetTable: "budget_allocation_setting",
    targetId: setting.id,
    originalState: JSON.stringify(before),
    newState: JSON.stringify(input),
  });
  return setting.id;
}
