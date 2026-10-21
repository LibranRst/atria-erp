import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@backend/db";
import {
  appConfig,
  auditLog,
  tenant,
  expenseCategory,
  budgetAllocationSetting,
  budgetAllocationSettingCategory,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { actorCan } from "@backend/lib/auth/permissions";
import type { Actor } from "@backend/server/actor";
import type { FinanceTransaction } from "../finance/mutation-access";
import {
  APPROVAL_THRESHOLD_CONFIG_KEYS,
  DEFAULT_APPROVAL_THRESHOLDS,
  parseThresholdCents,
} from "@atria/core/finance/approval-thresholds";
import {
  approvalThresholdPatchSchema,
  expenseCategoryPatchSchema,
  isCoreExpenseCode,
  type ApprovalThresholdPatch,
  type ExpenseCategoryPatch,
} from "@atria/core/ai/operational-settings";
import { updateApprovalThresholdsSchema } from "@atria/core/validations/settings";
import { writeBudgetDefaultsTx } from "./budget-defaults-writer";

type Reader = Pick<FinanceTransaction, "query" | "select">;
type SettingsActor = Pick<Actor, "permissions">;
export type ExpenseCategorySettingsContext = {
  readonly category: typeof expenseCategory.$inferSelect;
  readonly defaults:
    | (typeof budgetAllocationSetting.$inferSelect & {
        categories: (typeof budgetAllocationSettingCategory.$inferSelect)[];
      })
    | null;
  readonly allocation: typeof budgetAllocationSettingCategory.$inferSelect | null;
};
export class OperationalSettingsError extends Error {
  constructor(
    readonly code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR",
    message: string,
  ) {
    super(message);
  }
}
export function assertOperationalSettingsReadRights(actor: SettingsActor): void {
  if (!actorCan(actor, "view:settings"))
    throw new OperationalSettingsError("FORBIDDEN", "Akses pengaturan perusahaan tidak tersedia.");
}
export function assertOperationalSettingsRights(
  actor: SettingsActor,
  kind: "thresholds" | "categories",
): void {
  if (
    !actorCan(actor, "view:settings") ||
    !actorCan(
      actor,
      kind === "thresholds" ? "manage:approval_settings" : "manage:expense_categories",
    )
  )
    throw new OperationalSettingsError(
      "FORBIDDEN",
      "Izin mengelola pengaturan ini tidak tersedia atau telah berubah.",
    );
}
export async function readOperationalThresholds(
  actor: SettingsActor,
  reader: Reader = db,
  allowInvalid = false,
): Promise<{
  readonly values: { readonly fieldCostCents: number; readonly vendorPaymentCents: number };
  readonly rows: (typeof appConfig.$inferSelect)[];
}> {
  assertOperationalSettingsReadRights(actor);
  const rows = await reader.query.appConfig.findMany({
    where: and(
      eq(appConfig.tenantId, INSTANCE_TENANT_ID),
      inArray(appConfig.key, Object.values(APPROVAL_THRESHOLD_CONFIG_KEYS)),
    ),
    orderBy: [asc(appConfig.key)],
  });
  function value(key: string, fallback: bigint): number {
    const row = rows.find((item) => item.key === key);
    if (!row) return Number(fallback);
    const cents = parseThresholdCents(row.value);
    if ((cents === null || cents > 100_000_000_000n) && allowInvalid) return Number(fallback);
    if (cents === null || cents > 100_000_000_000n)
      throw new OperationalSettingsError(
        "CONFLICT",
        "Konfigurasi ambang tidak valid. Perbaiki sumber pengaturan sebelum membuat usulan.",
      );
    return Number(cents);
  }
  return {
    values: {
      fieldCostCents: value(
        APPROVAL_THRESHOLD_CONFIG_KEYS.fieldCost,
        DEFAULT_APPROVAL_THRESHOLDS.fieldCostCents,
      ),
      vendorPaymentCents: value(
        APPROVAL_THRESHOLD_CONFIG_KEYS.vendorPayment,
        DEFAULT_APPROVAL_THRESHOLDS.vendorPaymentCents,
      ),
    },
    rows,
  };
}
export async function lockApprovalThresholdsTx(
  tx: FinanceTransaction,
  actor: SettingsActor,
): Promise<void> {
  assertOperationalSettingsRights(actor, "thresholds");
  const [company] = await tx
    .select({ id: tenant.id })
    .from(tenant)
    .where(eq(tenant.id, INSTANCE_TENANT_ID))
    .for("update");
  if (!company)
    throw new OperationalSettingsError("NOT_FOUND", "Pengaturan perusahaan tidak ditemukan.");
  await tx
    .select({ id: appConfig.id })
    .from(appConfig)
    .where(
      and(
        eq(appConfig.tenantId, INSTANCE_TENANT_ID),
        inArray(appConfig.key, Object.values(APPROVAL_THRESHOLD_CONFIG_KEYS)),
      ),
    )
    .orderBy(asc(appConfig.key))
    .for("update");
}
export async function writeApprovalThresholdsTx(
  tx: FinanceTransaction,
  actor: Actor,
  raw: ApprovalThresholdPatch,
  reason: string | null = null,
): Promise<{ readonly id: string; readonly updated: boolean }> {
  const patch = approvalThresholdPatchSchema.parse(raw);
  await lockApprovalThresholdsTx(tx, actor);
  const before = await readOperationalThresholds(actor, tx, reason === null);
  const next = updateApprovalThresholdsSchema.parse({
    fieldCostCents:
      patch.fieldCostAmount === undefined
        ? before.values.fieldCostCents
        : Math.round(patch.fieldCostAmount * 100),
    vendorPaymentCents:
      patch.vendorPaymentAmount === undefined
        ? before.values.vendorPaymentCents
        : Math.round(patch.vendorPaymentAmount * 100),
  });
  const changes = [
    {
      key: APPROVAL_THRESHOLD_CONFIG_KEYS.fieldCost,
      before: before.values.fieldCostCents,
      after: next.fieldCostCents,
      description: "Ambang persetujuan Owner untuk pengeluaran lapangan, dalam sen.",
    },
    {
      key: APPROVAL_THRESHOLD_CONFIG_KEYS.vendorPayment,
      before: before.values.vendorPaymentCents,
      after: next.vendorPaymentCents,
      description: "Ambang persetujuan Owner untuk pembayaran vendor, dalam sen.",
    },
  ].filter((row) => {
    const source = before.rows.find((item) => item.key === row.key);
    const parsed = source ? parseThresholdCents(source.value) : null;
    return (
      row.before !== row.after ||
      (source !== undefined && (parsed === null || parsed > 100_000_000_000n))
    );
  });
  if (!changes.length) return { id: INSTANCE_TENANT_ID, updated: false };
  for (const row of changes) {
    await tx
      .insert(appConfig)
      .values({
        tenantId: INSTANCE_TENANT_ID,
        key: row.key,
        value: String(row.after),
        description: row.description,
        updatedById: actor.userId,
      })
      .onConflictDoUpdate({
        target: [appConfig.tenantId, appConfig.key],
        set: { value: String(row.after), updatedAt: new Date(), updatedById: actor.userId },
      });
  }
  await tx.insert(auditLog).values({
    tenantId: INSTANCE_TENANT_ID,
    userId: actor.userId,
    action: "UPDATE_APPROVAL_THRESHOLDS",
    targetTable: "app_config",
    targetId: INSTANCE_TENANT_ID,
    originalState: JSON.stringify({
      ...before.values,
      source: before.rows.map((row) => ({ key: row.key, value: row.value })),
    }),
    newState: JSON.stringify({ ...next, reason }),
  });
  return { id: INSTANCE_TENANT_ID, updated: true };
}
export async function readExpenseCategorySettings(
  actor: SettingsActor,
  id: string,
  reader: Reader = db,
): Promise<ExpenseCategorySettingsContext> {
  assertOperationalSettingsReadRights(actor);
  const category = await reader.query.expenseCategory.findFirst({
    where: and(eq(expenseCategory.id, id), eq(expenseCategory.tenantId, INSTANCE_TENANT_ID)),
  });
  if (!category)
    throw new OperationalSettingsError(
      "NOT_FOUND",
      "Kategori pengeluaran tidak ditemukan dalam perusahaan Anda.",
    );
  const defaults = await reader.query.budgetAllocationSetting.findFirst({
    where: and(
      eq(budgetAllocationSetting.tenantId, INSTANCE_TENANT_ID),
      eq(budgetAllocationSetting.isActive, true),
    ),
    orderBy: [asc(budgetAllocationSetting.id)],
    with: { categories: { orderBy: [asc(budgetAllocationSettingCategory.id)] } },
  });
  const allocation = defaults?.categories.find((row) => row.expenseCategoryId === category.id);
  return {
    category,
    defaults: defaults && allocation ? defaults : null,
    allocation: allocation ?? null,
  };
}
export async function lockExpenseCategorySettingsTx(
  tx: FinanceTransaction,
  actor: SettingsActor,
  id: string,
): Promise<void> {
  assertOperationalSettingsRights(actor, "categories");
  const context = await readExpenseCategorySettings(actor, id, tx);
  // Match the existing budget-default writer's lock order: setting, allocation rows, category.
  if (context.defaults) {
    await tx
      .select({ id: budgetAllocationSetting.id })
      .from(budgetAllocationSetting)
      .where(eq(budgetAllocationSetting.id, context.defaults.id))
      .for("update");
    await tx
      .select({ id: budgetAllocationSettingCategory.id })
      .from(budgetAllocationSettingCategory)
      .where(eq(budgetAllocationSettingCategory.budgetAllocationSettingId, context.defaults.id))
      .orderBy(asc(budgetAllocationSettingCategory.id))
      .for("update");
  }
  await tx
    .select({ id: expenseCategory.id })
    .from(expenseCategory)
    .where(and(eq(expenseCategory.id, id), eq(expenseCategory.tenantId, INSTANCE_TENANT_ID)))
    .for("update");
}
export async function validateExpenseCategoryPatch(
  actor: SettingsActor,
  id: string,
  raw: ExpenseCategoryPatch,
  reader: Reader = db,
): Promise<
  ExpenseCategorySettingsContext & {
    readonly patch: ExpenseCategoryPatch;
    readonly ratioChanged: boolean;
  }
> {
  assertOperationalSettingsRights(actor, "categories");
  const patch = expenseCategoryPatchSchema.parse(raw);
  const current = await readExpenseCategorySettings(actor, id, reader);
  if (patch.isActive === false && isCoreExpenseCode(current.category.code))
    throw new OperationalSettingsError(
      "VALIDATION_ERROR",
      "Lima kategori budget inti tetap aktif. Ubah penggunaan alokasi melalui default budget perusahaan.",
    );
  const ratioChanged =
    patch.defaultRatio !== undefined &&
    (Number(current.category.defaultRatio) !== patch.defaultRatio ||
      (current.allocation !== null &&
        Number(current.allocation.ratioPercentage) !== patch.defaultRatio));
  if (ratioChanged) {
    if (!actorCan(actor, "manage:budget_settings"))
      throw new OperationalSettingsError(
        "FORBIDDEN",
        "Perubahan alokasi memerlukan izin default budget perusahaan.",
      );
    if (isCoreExpenseCode(current.category.code) && (!current.defaults || !current.allocation))
      throw new OperationalSettingsError(
        "CONFLICT",
        "Default budget aktif belum lengkap. Periksa pengaturan sebelum mengubah alokasi.",
      );
    if (current.defaults && current.allocation) {
      const total = current.defaults.categories.reduce(
        (sum, row) =>
          sum +
          (row.isEnabled
            ? row.id === current.allocation?.id
              ? (patch.defaultRatio ?? 0)
              : Number(row.ratioPercentage)
            : 0),
        0,
      );
      if (total > 1.000001)
        throw new OperationalSettingsError(
          "VALIDATION_ERROR",
          "Total alokasi aktif melebihi 100%. Gunakan koreksi default budget lengkap untuk menyeimbangkan kategori.",
        );
    }
  }
  return { ...current, patch, ratioChanged };
}
export async function writeExpenseCategorySettingsTx(
  tx: FinanceTransaction,
  actor: Actor,
  id: string,
  raw: ExpenseCategoryPatch,
  reason: string | null = null,
  detailsOnly = false,
): Promise<typeof expenseCategory.$inferSelect> {
  await lockExpenseCategorySettingsTx(tx, actor, id);
  const current = await validateExpenseCategoryPatch(actor, id, raw, tx);
  if (detailsOnly && !isCoreExpenseCode(current.category.code))
    throw new OperationalSettingsError("NOT_FOUND", "Kategori budget tidak ditemukan.");
  if (current.ratioChanged && current.defaults && current.allocation) {
    await writeBudgetDefaultsTx(tx, actor, {
      budgetAllocationSettingId: current.defaults.id,
      name: current.defaults.name,
      budgetCapRatio: Number(current.defaults.budgetCapRatio),
      notes: current.defaults.notes,
      categories: current.defaults.categories.map((row) => ({
        budgetAllocationSettingCategoryId: row.id,
        ratioPercentage:
          row.id === current.allocation?.id
            ? (current.patch.defaultRatio ?? Number(row.ratioPercentage))
            : Number(row.ratioPercentage),
        isEnabled: row.isEnabled,
      })),
    });
  }
  const [updated] = await tx
    .update(expenseCategory)
    .set({
      name: current.patch.name ?? current.category.name,
      description:
        current.patch.description === undefined
          ? current.category.description
          : current.patch.description?.trim() || null,
      defaultRatio:
        current.patch.defaultRatio === undefined
          ? current.category.defaultRatio
          : current.patch.defaultRatio.toFixed(6),
      isActive: current.patch.isActive ?? current.category.isActive,
      updatedAt: new Date(),
    })
    .where(and(eq(expenseCategory.id, id), eq(expenseCategory.tenantId, INSTANCE_TENANT_ID)))
    .returning();
  if (!updated)
    throw new OperationalSettingsError("CONFLICT", "Kategori berubah sebelum tersimpan.");
  await tx.insert(auditLog).values({
    tenantId: INSTANCE_TENANT_ID,
    userId: actor.userId,
    action: detailsOnly ? "UPDATE_EXPENSE_CATEGORY_DETAILS" : "UPDATE_EXPENSE_CATEGORY_SETTING",
    targetTable: "expense_category",
    targetId: id,
    originalState: JSON.stringify(current.category),
    newState: JSON.stringify({ ...updated, reason }),
  });
  return updated;
}
