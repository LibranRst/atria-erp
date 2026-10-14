import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@backend/db";
import { initializeSystemRolesTx } from "@backend/db/initialize-system-roles";
import {
  account,
  appConfig,
  auditLog,
  budgetAllocationSetting,
  budgetAllocationSettingCategory,
  expenseCategory,
  tenantMember,
  user,
} from "@backend/db/schema";
import { INSTANCE_TENANT_ID } from "@backend/db/schema/tenant-constants";
import { auth } from "@backend/lib/auth";
import { OWNER_ROLE_ID } from "@atria/core/auth/role-constants";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  EXCEL_BUDGET_CAP_RATIO,
} from "@atria/core/budget/excel-budget";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  bootstrapOwnerSchema,
  type BootstrapOwnerInput,
} from "@atria/core/validations/administration";

const CATEGORY_IDS = [
  "31313131-3131-3131-3131-313131313101",
  "31313131-3131-3131-3131-313131313102",
  "31313131-3131-3131-3131-313131313103",
  "31313131-3131-3131-3131-313131313104",
  "31313131-3131-3131-3131-313131313105",
] as const;
const SETTING_ID = "41414141-4141-4141-4141-414141414101";
const SETTING_CATEGORY_IDS = [
  "42424242-4242-4242-4242-424242424101",
  "42424242-4242-4242-4242-424242424102",
  "42424242-4242-4242-4242-424242424103",
  "42424242-4242-4242-4242-424242424104",
  "42424242-4242-4242-4242-424242424105",
] as const;

function secureEqual(left: string, right: string): boolean {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}
export async function getBootstrapStatus(): Promise<
  ActionResponse<{ readonly required: boolean }>
> {
  const existingOwner = await db.query.user.findFirst({
    where: and(eq(user.roleId, OWNER_ROLE_ID), eq(user.isActive, true)),
    columns: { id: true },
  });
  return { success: true, data: { required: !existingOwner } };
}

export async function bootstrapFirstOwner(
  input: BootstrapOwnerInput,
): Promise<ActionResponse<{ readonly userId: string }>> {
  const validation = bootstrapOwnerSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Setup tidak valid.",
      },
    };
  }
  const configuredSecret = process.env.ATRIA_BOOTSTRAP_SECRET;
  if (!configuredSecret || !secureEqual(validation.data.bootstrapSecret, configuredSecret)) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Bootstrap secret tidak valid." },
    };
  }

  try {
    const passwordHash = await auth.$context.then((context) =>
      context.password.hash(validation.data.password),
    );
    const createdUserId = await db.transaction(async (tx) => {
      await tx
        .insert(appConfig)
        .values({
          key: "production_bootstrap_lock",
          value: "locked",
          description: "Serialization lock for first Owner provisioning.",
        })
        .onConflictDoNothing();
      await tx
        .select({ id: appConfig.id })
        .from(appConfig)
        .where(eq(appConfig.key, "production_bootstrap_lock"))
        .for("update");
      const existingOwner = await tx.query.user.findFirst({
        where: and(eq(user.roleId, OWNER_ROLE_ID), eq(user.isActive, true)),
      });
      if (existingOwner) throw new Error("BOOTSTRAP_ALREADY_COMPLETED");

      await initializeSystemRolesTx(tx);
      const [created] = await tx
        .insert(user)
        .values({
          name: validation.data.name,
          email: validation.data.email,
          emailVerified: true,
          roleId: OWNER_ROLE_ID,
          isActive: true,
          mustChangePassword: false,
        })
        .returning();
      await tx.insert(account).values({
        id: `credential-${created.id}`,
        accountId: created.id,
        providerId: "credential",
        userId: created.id,
        password: passwordHash,
      });
      await tx.insert(tenantMember).values({
        tenantId: INSTANCE_TENANT_ID,
        userId: created.id,
        roleId: created.roleId,
        isActive: created.isActive,
      });

      await tx
        .insert(expenseCategory)
        .values(
          DEFAULT_EXPENSE_CATEGORIES.map((category, index) => ({
            id: CATEGORY_IDS[index],
            code: category.code,
            name: category.name,
            description: category.description,
            defaultRatio: category.defaultRatio.toFixed(6),
            sortOrder: category.sortOrder,
          })),
        )
        .onConflictDoNothing();
      await tx
        .insert(budgetAllocationSetting)
        .values({
          id: SETTING_ID,
          name: "Default Project Budget Allocation",
          status: "ACTIVE",
          budgetCapRatio: EXCEL_BUDGET_CAP_RATIO.toFixed(6),
          notes: "Default budget untuk proyek baru.",
          isActive: true,
          updatedById: created.id,
        })
        .onConflictDoNothing();
      await tx
        .insert(budgetAllocationSettingCategory)
        .values(
          DEFAULT_EXPENSE_CATEGORIES.map((category, index) => ({
            id: SETTING_CATEGORY_IDS[index],
            budgetAllocationSettingId: SETTING_ID,
            expenseCategoryId: CATEGORY_IDS[index],
            ratioPercentage: category.defaultRatio.toFixed(6),
            isEnabled: true,
            sortOrder: category.sortOrder,
          })),
        )
        .onConflictDoNothing();
      await tx
        .insert(appConfig)
        .values({
          key: "production_bootstrap_completed",
          value: new Date().toISOString(),
          description: "First Owner dan canonical settings telah diprovision.",
          updatedById: created.id,
        })
        // Kunci uniknya (tenant_id, key), bukan key saja — satu instance memang
        // hanya melayani satu perusahaan, tapi ON CONFLICT harus menyebut
        // constraint yang benar-benar ada atau Postgres menolak querynya.
        .onConflictDoUpdate({
          target: [appConfig.tenantId, appConfig.key],
          set: { value: new Date().toISOString(), updatedById: created.id, updatedAt: new Date() },
        });
      await tx.insert(auditLog).values({
        userId: created.id,
        action: "BOOTSTRAP_PRODUCTION_FOUNDATION",
        targetTable: "user",
        targetId: created.id,
        newState: JSON.stringify({
          email: created.email,
          roleId: created.roleId,
          canonicalSettingsInitialized: true,
        }),
      });
      return created.id;
    });
    return { success: true, data: { userId: createdUserId } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Setup production gagal.";
    if (message.includes("BOOTSTRAP_ALREADY_COMPLETED")) {
      return {
        success: false,
        error: { code: "CONFLICT", message: "Setup awal sudah pernah diselesaikan." },
      };
    }
    if (message.includes("unique")) {
      return {
        success: false,
        error: { code: "CONFLICT", message: "Email atau pengaturan awal sudah digunakan." },
      };
    }
    return { success: false, error: { code: "INTERNAL_SERVER_ERROR", message } };
  }
}
