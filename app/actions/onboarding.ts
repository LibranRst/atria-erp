"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  appConfig,
  auditLog,
  bankAccount,
  budgetAllocationSetting,
  cashTransaction,
  expenseCategory,
  inventoryLocation,
  inventoryOpeningBatch,
  itemPriceLibrary,
  materialMaster,
  user,
  vendor,
} from "@/db/schema";
import { OWNER_ROLE_ID, SYSTEM_ROLES } from "@/lib/auth/role-constants";
import { assertPermission, resolveRoleName } from "@/lib/auth/permissions";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/budget/excel-budget";
import {
  advanceOwnerOnboardingStepSchema,
  DEFAULT_OWNER_ONBOARDING_STATE,
  deriveOwnerOnboardingGates,
  nextOnboardingStep,
  OWNER_ONBOARDING_CONFIG_KEY,
  type OnboardingStepId,
  type OnboardingStepStatus,
  type OwnerOnboardingOverview,
  type OwnerOnboardingReadiness,
  type OwnerOnboardingState,
  parseOwnerOnboardingState,
  pauseOwnerOnboardingSchema,
} from "@/lib/onboarding/owner-onboarding";
import { requireServerSession } from "@/lib/server/session";
import type { ActionResponse } from "@/lib/types/action-response";

type Actor = { readonly id: string; readonly roleId: string };

export type OwnerOnboardingBankAccount = {
  readonly id: string;
  readonly name: string;
  readonly bankName: string;
  readonly accountNumber: string;
  readonly holderName: string;
  readonly balance: number;
  readonly cardColorFrom: string;
  readonly cardColorTo: string;
  readonly cardTextColor: "light" | "dark";
  readonly isActive: boolean;
  readonly recentTransactions: readonly {
    readonly id: string;
    readonly bankAccountId: string;
    readonly type: string;
    readonly category: string;
    readonly amount: number;
    readonly description: string;
    readonly reconciled: boolean;
    readonly createdAt: Date;
  }[];
  readonly openingBalanceTransaction?: {
    readonly id: string;
    readonly amount: number;
    readonly description: string;
    readonly referenceId: string | null;
  } | null;
};

async function actor(): Promise<Actor> {
  const session = await requireServerSession();
  return { id: session.user.id, roleId: session.user.roleId };
}

async function requireOwner(): Promise<Actor> {
  const current = await actor();
  if ((await resolveRoleName(current.roleId)) !== "OWNER") {
    throw new Error("FORBIDDEN");
  }
  return current;
}

function uniqueSteps(values: readonly OnboardingStepId[]): OnboardingStepId[] {
  return [...new Set(values)];
}

async function readPersistedState(): Promise<{
  readonly rowId: string | null;
  readonly state: OwnerOnboardingState | null;
}> {
  const row = await db.query.appConfig.findFirst({
    where: eq(appConfig.key, OWNER_ONBOARDING_CONFIG_KEY),
    columns: { id: true, value: true },
  });
  return {
    rowId: row?.id ?? null,
    state: parseOwnerOnboardingState(row?.value),
  };
}

async function saveState(
  current: Actor,
  next: OwnerOnboardingState,
  action: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const existing = await tx.query.appConfig.findFirst({
      where: eq(appConfig.key, OWNER_ONBOARDING_CONFIG_KEY),
    });
    const value = JSON.stringify(next);
    const [saved] = existing
      ? await tx
          .update(appConfig)
          .set({
            value,
            updatedAt: new Date(),
            updatedById: current.id,
          })
          .where(eq(appConfig.id, existing.id))
          .returning()
      : await tx
          .insert(appConfig)
          .values({
            key: OWNER_ONBOARDING_CONFIG_KEY,
            value,
            description: "Progress onboarding Owner untuk fondasi operasional Atria.",
            updatedById: current.id,
          })
          .returning();
    await tx.insert(auditLog).values({
      userId: current.id,
      action,
      targetTable: "app_config",
      targetId: saved.id,
      originalState: existing?.value ?? null,
      newState: value,
    });
  });
  revalidatePath("/");
  revalidatePath("/onboarding");
  revalidatePath("/settings");
}

function statusFor(
  id: OnboardingStepId,
  ready: boolean,
  state: OwnerOnboardingState,
  pending = false,
  notApplicable = false,
): OnboardingStepStatus {
  if (notApplicable) return "NOT_APPLICABLE";
  if (ready) return "READY";
  if (pending) return "PENDING_APPROVAL";
  if (state.skippedSteps.includes(id)) return "SKIPPED";
  if (state.reviewedSteps.includes(id)) return "REVIEWED";
  return "INCOMPLETE";
}

export async function getOwnerOnboardingOverview(): Promise<
  ActionResponse<OwnerOnboardingOverview>
> {
  const current = await actor();
  try {
    await assertPermission(current, "view:settings");
  } catch {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Onboarding organisasi hanya tersedia untuk Owner.",
      },
    };
  }
  const roleName = await resolveRoleName(current.roleId);

  const [
    persisted,
    users,
    vendors,
    accounts,
    locations,
    materials,
    libraryItems,
    categories,
    budget,
    pendingBatches,
    postedBatches,
    rejectedBatches,
  ] = await Promise.all([
    readPersistedState(),
    db.query.user.findMany({
      where: eq(user.isActive, true),
      columns: { roleId: true },
    }),
    db.query.vendor.findMany({
      where: eq(vendor.isActive, true),
      columns: { id: true },
    }),
    db.query.bankAccount.findMany({
      where: eq(bankAccount.isActive, true),
      columns: { id: true },
    }),
    db.query.inventoryLocation.findMany({
      where: eq(inventoryLocation.isActive, true),
      columns: { id: true },
    }),
    db.query.materialMaster.findMany({
      where: eq(materialMaster.isActive, true),
      columns: { id: true },
    }),
    db.query.itemPriceLibrary.findMany({
      where: eq(itemPriceLibrary.isActive, true),
      columns: { id: true },
    }),
    db.query.expenseCategory.findMany({
      where: eq(expenseCategory.isActive, true),
      columns: { code: true },
    }),
    db.query.budgetAllocationSetting.findFirst({
      where: eq(budgetAllocationSetting.isActive, true),
      columns: { id: true },
    }),
    db.query.inventoryOpeningBatch.findMany({
      where: eq(inventoryOpeningBatch.status, "PENDING_APPROVAL"),
      columns: { id: true },
    }),
    db.query.inventoryOpeningBatch.findMany({
      where: eq(inventoryOpeningBatch.status, "POSTED"),
      columns: { id: true },
    }),
    db.query.inventoryOpeningBatch.findMany({
      where: eq(inventoryOpeningBatch.status, "REJECTED"),
      columns: { id: true },
    }),
  ]);

  const state = persisted.state ?? DEFAULT_OWNER_ONBOARDING_STATE;
  const roleIds = new Set(users.map((row) => row.roleId));
  const teamReady = SYSTEM_ROLES.slice(1, 4).every((role) => roleIds.has(role.id));
  const categoryCodes = new Set(categories.map((row) => row.code));
  const financeReady =
    Boolean(budget) &&
    DEFAULT_EXPENSE_CATEGORIES.every((category) => categoryCodes.has(category.code));
  const materialReady = locations.length > 0 && materials.length > 0;
  const initialStockNotApplicable =
    state.initialStockDecision === "NO_LEGACY_STOCK" &&
    pendingBatches.length === 0 &&
    postedBatches.length === 0 &&
    rejectedBatches.length === 0;
  const initialStockReady = postedBatches.length > 0 || initialStockNotApplicable;
  const gates = deriveOwnerOnboardingGates({
    financeDefaultsReady: financeReady,
    teamReady,
    bankReady: accounts.length > 0,
    materialFoundationReady: materialReady,
    postedInitialStockBatches: postedBatches.length,
    pendingInitialStockBatches: pendingBatches.length,
    rejectedInitialStockBatches: rejectedBatches.length,
    noLegacyStockConfirmed: initialStockNotApplicable,
    vendorReady: vendors.length > 0,
    itemLibraryReady: libraryItems.length > 0,
    initialStockSkipped: state.skippedSteps.includes("initial_stock"),
  });
  const freshInstall =
    users.length === 1 &&
    roleIds.has(OWNER_ROLE_ID) &&
    vendors.length === 0 &&
    accounts.length === 0 &&
    locations.length === 0 &&
    materials.length === 0;
  const readiness: readonly OwnerOnboardingReadiness[] = [
    {
      id: "welcome",
      label: "Pengenalan setup",
      detail: "Tujuan dan dampak setup sudah dipahami.",
      ready: state.reviewedSteps.includes("welcome"),
      status: statusFor("welcome", state.reviewedSteps.includes("welcome"), state),
      href: "/onboarding?step=welcome",
    },
    {
      id: "financial_defaults",
      label: "Default finansial",
      detail: "Budget default dan kategori biaya canonical tersedia.",
      ready: financeReady,
      status: statusFor("financial_defaults", financeReady, state),
      href: "/onboarding?step=financial_defaults",
    },
    {
      id: "team_vendors",
      label: "Tim & Vendor",
      detail: teamReady
        ? vendors.length > 0
          ? "Tiga role inti dan vendor aktif tersedia."
          : "Tiga role inti siap; vendor dapat ditambahkan nanti."
        : "Lengkapi akun aktif Finance, PM, dan Purchasing.",
      ready: teamReady,
      status: statusFor("team_vendors", teamReady, state),
      href: "/onboarding?step=team_vendors",
    },
    {
      id: "bank_accounts",
      label: "Rekening perusahaan",
      detail:
        accounts.length > 0
          ? "Minimal satu rekening kas aktif tersedia."
          : "Rekening dibutuhkan untuk cash-in dan cash-out.",
      ready: accounts.length > 0,
      status: statusFor("bank_accounts", accounts.length > 0, state),
      href: "/onboarding?step=bank_accounts",
    },
    {
      id: "material_foundation",
      label: "Lokasi & Material Master",
      detail: materialReady
        ? "Lokasi dan Material Master aktif tersedia."
        : "Buat lokasi sebelum Material Master pertama.",
      ready: materialReady,
      status: statusFor("material_foundation", materialReady, state),
      href: "/onboarding?step=material_foundation",
    },
    {
      id: "item_library",
      label: "Library Item & Harga",
      detail:
        libraryItems.length > 0
          ? "Template biaya aktif tersedia."
          : "Opsional untuk mempercepat RAP dan RAB.",
      ready: libraryItems.length > 0,
      status: statusFor("item_library", libraryItems.length > 0, state),
      href: "/onboarding?step=item_library",
    },
    {
      id: "initial_stock",
      label: "Saldo awal stok",
      detail:
        postedBatches.length > 0
          ? "Saldo awal sudah diposting."
          : pendingBatches.length > 0
            ? "Batch menunggu persetujuan."
            : initialStockNotApplicable
              ? "Owner menyatakan tidak ada stok lama."
              : "Tentukan apakah ada stok fisik lama.",
      ready: initialStockReady,
      status: statusFor(
        "initial_stock",
        initialStockReady,
        state,
        pendingBatches.length > 0,
        initialStockNotApplicable,
      ),
      href: "/onboarding?step=initial_stock",
    },
    {
      id: "summary",
      label: "Ringkasan kesiapan",
      detail: "Tinjau gap sebelum membuat proyek pertama.",
      ready: state.status === "COMPLETED",
      status: statusFor("summary", state.status === "COMPLETED", state),
      href: "/onboarding?step=summary",
    },
  ];

  return {
    success: true,
    data: {
      canManageOnboarding: roleName === "OWNER",
      state,
      hasPersistedState: Boolean(persisted.state),
      freshInstall,
      shouldAutoOpen: roleName === "OWNER" && !persisted.state && freshInstall,
      readiness,
      blockers: gates.blockers,
      warnings: gates.warnings,
      canComplete: gates.canComplete,
      counts: {
        activeUsers: users.length,
        activeVendors: vendors.length,
        activeBankAccounts: accounts.length,
        activeLocations: locations.length,
        activeMaterials: materials.length,
        activeLibraryItems: libraryItems.length,
        pendingInitialStockBatches: pendingBatches.length,
        postedInitialStockBatches: postedBatches.length,
      },
    },
  };
}

export async function getOwnerOnboardingBankAccounts(): Promise<
  ActionResponse<readonly OwnerOnboardingBankAccount[]>
> {
  const current = await actor();
  try {
    await assertPermission(current, "view:bank_account");
    const rows = await db.query.bankAccount.findMany({
      with: {
        cashTransactions: {
          where: eq(cashTransaction.referenceType, "opening_balance"),
          columns: {
            id: true,
            bankAccountId: true,
            type: true,
            category: true,
            amount: true,
            description: true,
            reconciled: true,
            referenceId: true,
            createdAt: true,
          },
          orderBy: (table, { desc }) => [desc(table.createdAt)],
        },
      },
      orderBy: [asc(bankAccount.name)],
    });
    return {
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        bankName: row.bankName,
        accountNumber: row.accountNumber,
        holderName: row.holderName,
        balance: Number(row.balance),
        cardColorFrom: row.cardColorFrom,
        cardColorTo: row.cardColorTo,
        cardTextColor: row.cardTextColor === "dark" ? "dark" : "light",
        isActive: row.isActive,
        recentTransactions: row.cashTransactions.map((transaction) => ({
          ...transaction,
          amount: Number(transaction.amount),
        })),
        openingBalanceTransaction: row.cashTransactions[0]
          ? {
              id: row.cashTransactions[0].id,
              amount: Number(row.cashTransactions[0].amount),
              description: row.cashTransactions[0].description,
              referenceId: row.cashTransactions[0].referenceId,
            }
          : null,
      })),
    };
  } catch {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Daftar rekening tidak dapat dimuat untuk onboarding.",
      },
    };
  }
}

export async function advanceOwnerOnboardingStep(input: unknown): Promise<
  ActionResponse<{
    readonly state: OwnerOnboardingState;
    readonly nextStep: OnboardingStepId;
  }>
> {
  const validation = advanceOwnerOnboardingStepSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Step onboarding tidak valid.",
      },
    };
  try {
    const current = await requireOwner();
    const destination = nextOnboardingStep(validation.data.stepId);
    const next = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(appConfig)
        .where(eq(appConfig.key, OWNER_ONBOARDING_CONFIG_KEY))
        .for("update");
      const base = parseOwnerOnboardingState(existing?.value) ?? DEFAULT_OWNER_ONBOARDING_STATE;
      const reviewed =
        validation.data.disposition === "REVIEWED"
          ? uniqueSteps([...base.reviewedSteps, validation.data.stepId])
          : base.reviewedSteps.filter((step) => step !== validation.data.stepId);
      const skipped =
        validation.data.disposition === "SKIPPED"
          ? uniqueSteps([...base.skippedSteps, validation.data.stepId])
          : base.skippedSteps.filter((step) => step !== validation.data.stepId);
      const state: OwnerOnboardingState = {
        ...base,
        status: "IN_PROGRESS",
        currentStep: destination,
        reviewedSteps: reviewed,
        skippedSteps: skipped,
        completedAt: null,
        initialStockDecision:
          validation.data.stepId === "initial_stock"
            ? (validation.data.initialStockDecision ?? base.initialStockDecision)
            : base.initialStockDecision,
      };
      const value = JSON.stringify(state);
      const [saved] = existing
        ? await tx
            .update(appConfig)
            .set({ value, updatedAt: new Date(), updatedById: current.id })
            .where(eq(appConfig.id, existing.id))
            .returning()
        : await tx
            .insert(appConfig)
            .values({
              key: OWNER_ONBOARDING_CONFIG_KEY,
              value,
              description: "Progress onboarding Owner untuk fondasi operasional Atria.",
              updatedById: current.id,
            })
            .returning();
      await tx
        .insert(auditLog)
        .values({
          userId: current.id,
          action: "ADVANCE_OWNER_ONBOARDING_STEP",
          targetTable: "app_config",
          targetId: saved.id,
          originalState: existing?.value ?? null,
          newState: JSON.stringify({
            state,
            disposition: validation.data.disposition,
            sourceStep: validation.data.stepId,
            destination,
          }),
        });
      return state;
    });
    revalidatePath("/");
    revalidatePath("/onboarding");
    revalidatePath("/settings");
    return { success: true, data: { state: next, nextStep: destination } };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message:
          error instanceof Error && error.message === "FORBIDDEN"
            ? "Hanya Owner yang dapat mengubah onboarding."
            : "Progress onboarding gagal disimpan.",
      },
    };
  }
}

export async function pauseOwnerOnboarding(
  input: unknown,
): Promise<ActionResponse<OwnerOnboardingState>> {
  const validation = pauseOwnerOnboardingSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Step onboarding tidak valid.",
      },
    };
  try {
    const current = await requireOwner();
    const persisted = await readPersistedState();
    const next: OwnerOnboardingState = {
      ...(persisted.state ?? DEFAULT_OWNER_ONBOARDING_STATE),
      status: "PAUSED",
      currentStep: validation.data.currentStep,
    };
    await saveState(current, next, "PAUSE_OWNER_ONBOARDING");
    return { success: true, data: next };
  } catch {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Onboarding tidak dapat dijeda." },
    };
  }
}

export async function completeOwnerOnboarding(): Promise<ActionResponse<OwnerOnboardingState>> {
  try {
    const current = await requireOwner();
    const overview = await getOwnerOnboardingOverview();
    if (!overview.success || !overview.data.canComplete) {
      return {
        success: false,
        error: {
          code: "CONFLICT",
          message: overview.success
            ? `Onboarding belum dapat diselesaikan: ${overview.data.blockers[0]?.detail ?? "masih ada fondasi wajib yang belum siap."}`
            : "Readiness onboarding belum dapat diverifikasi.",
        },
      };
    }
    const persisted = await readPersistedState();
    const next: OwnerOnboardingState = {
      ...(persisted.state ?? DEFAULT_OWNER_ONBOARDING_STATE),
      status: "COMPLETED",
      currentStep: "summary",
      completedAt: new Date().toISOString(),
    };
    await saveState(current, next, "COMPLETE_OWNER_ONBOARDING");
    return { success: true, data: next };
  } catch {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Onboarding tidak dapat diselesaikan.",
      },
    };
  }
}
