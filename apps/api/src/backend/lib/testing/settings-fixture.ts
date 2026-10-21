import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@backend/db";
import {
  expenseCategory,
  budgetAllocationSetting,
  budgetAllocationSettingCategory,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { CORE_EXPENSE_CODES } from "@atria/core/ai/operational-settings";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
/** Complete the Settings-only fixture in an explicitly disposable integration database. */
export async function ensureSettingsTestFixture(): Promise<void> {
  if (!process.env.ATRIA_TEST_DATABASE_URL)
    throw new Error("Explicit integration database required.");
  const target = new URL(process.env.ATRIA_TEST_DATABASE_URL);
  if (
    !["127.0.0.1", "localhost"].includes(target.hostname) ||
    !/^\/atria_audit_[a-z0-9_]+$/.test(target.pathname)
  )
    throw new Error("Disposable loopback Settings fixture only.");
  await db
    .insert(expenseCategory)
    .values(
      CORE_EXPENSE_CODES.map((code, index) => ({
        code,
        name: formatBusinessLabel(code),
        defaultRatio: "0.100000",
        sortOrder: index,
      })),
    )
    .onConflictDoNothing();
  const current = await db.query.budgetAllocationSetting.findFirst({
    where: and(
      eq(budgetAllocationSetting.tenantId, INSTANCE_TENANT_ID),
      eq(budgetAllocationSetting.isActive, true),
    ),
  });
  if (current) return;
  const categories = await db.query.expenseCategory.findMany({
    where: and(
      eq(expenseCategory.tenantId, INSTANCE_TENANT_ID),
      inArray(expenseCategory.code, [...CORE_EXPENSE_CODES]),
    ),
    orderBy: [asc(expenseCategory.sortOrder)],
  });
  const [setting] = await db
    .insert(budgetAllocationSetting)
    .values({ name: "Default budget QA · sintetis", budgetCapRatio: "0.900000", isActive: true })
    .returning();
  await db.insert(budgetAllocationSettingCategory).values(
    categories.map((row, index) => ({
      budgetAllocationSettingId: setting.id,
      expenseCategoryId: row.id,
      ratioPercentage: "0.100000",
      isEnabled: true,
      sortOrder: index,
    })),
  );
}
