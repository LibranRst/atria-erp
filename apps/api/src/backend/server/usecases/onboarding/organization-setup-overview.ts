import { and, eq, inArray } from "drizzle-orm";

import { db } from "@backend/db";
import {
  appConfig,
  bankAccount,
  budgetAllocationSetting,
  expenseCategory,
  inventoryLocation,
  inventoryOpeningBatch,
  itemPriceLibrary,
  materialMaster,
  user,
  vendor,
  tenantMember,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import { OWNER_ROLE_ID, SYSTEM_ROLES } from "@atria/core/auth/role-constants";
import { DEFAULT_EXPENSE_CATEGORIES } from "@atria/core/budget/excel-budget";
import {
  getQuickStartProgress,
  mapLegacyOwnerOnboardingState,
  OWNER_ONBOARDING_V2_CONFIG_KEY,
  parseOwnerQuickStartState,
  type OperationalReadinessItem,
  type OrganizationSetupOverview,
  type SetupAction,
} from "@atria/core/onboarding/organization-setup";
import {
  OWNER_ONBOARDING_CONFIG_KEY,
  parseOwnerOnboardingState,
} from "@atria/core/onboarding/owner-onboarding";
import type { ActionResponse } from "@atria/core/types/action-response";

function can(actor: Actor, permission: Actor["permissions"][number]): boolean {
  return actor.permissions.includes(permission);
}

function action(allowed: boolean, href: string, label: string): SetupAction | null {
  return allowed ? { href, label } : null;
}

export async function getOrganizationSetupOverviewUseCase(
  actor: Actor,
): Promise<ActionResponse<OrganizationSetupOverview>> {
  if (!can(actor, "view:settings") && !can(actor, "manage:onboarding")) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Kesiapan organisasi tidak tersedia untuk peran ini." },
    };
  }

  try {
    const [
      configRows,
      activeUsers,
      activeVendor,
      activeAccount,
      activeLocation,
      activeMaterial,
      activeLibraryItem,
      activeCategories,
      activeBudget,
      pendingOpening,
      postedOpening,
      rejectedOpening,
      firstProject,
    ] = await Promise.all([
      db.query.appConfig.findMany({
        where: and(
          eq(appConfig.tenantId, INSTANCE_TENANT_ID),
          inArray(appConfig.key, [OWNER_ONBOARDING_V2_CONFIG_KEY, OWNER_ONBOARDING_CONFIG_KEY]),
        ),
        columns: { key: true, value: true },
      }),
      db.query.user.findMany({
        where: and(
          eq(user.isActive, true),
          inArray(
            user.id,
            db
              .select({ id: tenantMember.userId })
              .from(tenantMember)
              .where(
                and(eq(tenantMember.tenantId, INSTANCE_TENANT_ID), eq(tenantMember.isActive, true)),
              ),
          ),
        ),
        columns: { id: true, roleId: true },
      }),
      db.query.vendor.findFirst({
        where: and(eq(vendor.tenantId, INSTANCE_TENANT_ID), eq(vendor.isActive, true)),
        columns: { id: true },
      }),
      db.query.bankAccount.findFirst({
        where: and(eq(bankAccount.tenantId, INSTANCE_TENANT_ID), eq(bankAccount.isActive, true)),
        columns: { id: true },
      }),
      db.query.inventoryLocation.findFirst({
        where: and(
          eq(inventoryLocation.tenantId, INSTANCE_TENANT_ID),
          eq(inventoryLocation.isActive, true),
        ),
        columns: { id: true },
      }),
      db.query.materialMaster.findFirst({
        where: and(
          eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
          eq(materialMaster.isActive, true),
        ),
        columns: { id: true },
      }),
      db.query.itemPriceLibrary.findFirst({
        where: and(
          eq(itemPriceLibrary.tenantId, INSTANCE_TENANT_ID),
          eq(itemPriceLibrary.isActive, true),
        ),
        columns: { id: true },
      }),
      db.query.expenseCategory.findMany({
        where: and(
          eq(expenseCategory.tenantId, INSTANCE_TENANT_ID),
          eq(expenseCategory.isActive, true),
        ),
        columns: { code: true },
      }),
      db.query.budgetAllocationSetting.findFirst({
        where: and(
          eq(budgetAllocationSetting.tenantId, INSTANCE_TENANT_ID),
          eq(budgetAllocationSetting.isActive, true),
        ),
        columns: { id: true },
      }),
      db.query.inventoryOpeningBatch.findFirst({
        where: and(
          eq(inventoryOpeningBatch.tenantId, INSTANCE_TENANT_ID),
          eq(inventoryOpeningBatch.status, "PENDING_APPROVAL"),
        ),
        columns: { id: true },
      }),
      db.query.inventoryOpeningBatch.findFirst({
        where: and(
          eq(inventoryOpeningBatch.tenantId, INSTANCE_TENANT_ID),
          eq(inventoryOpeningBatch.status, "POSTED"),
        ),
        columns: { id: true },
      }),
      db.query.inventoryOpeningBatch.findFirst({
        where: and(
          eq(inventoryOpeningBatch.tenantId, INSTANCE_TENANT_ID),
          eq(inventoryOpeningBatch.status, "REJECTED"),
        ),
        columns: { id: true },
      }),
      db.query.project.findFirst({
        where: (table, { eq }) => eq(table.tenantId, INSTANCE_TENANT_ID),
        columns: { id: true },
        orderBy: (table, { asc }) => [asc(table.createdAt)],
      }),
    ]);

    const v2Row = configRows.find((row) => row.key === OWNER_ONBOARDING_V2_CONFIG_KEY);
    const legacyRow = configRows.find((row) => row.key === OWNER_ONBOARDING_CONFIG_KEY);
    const persistedV2 = parseOwnerQuickStartState(v2Row?.value);
    if (v2Row && !persistedV2) throw new Error("QUICK_START_STATE_INVALID");
    const legacy = parseOwnerOnboardingState(legacyRow?.value);
    const roleIds = new Set(activeUsers.map((row) => row.roleId));
    const categoryCodes = new Set(activeCategories.map((row) => row.code));
    const financeDefaultsReady =
      Boolean(activeBudget) &&
      DEFAULT_EXPENSE_CATEGORIES.every((category) => categoryCodes.has(category.code));
    const freshInstall =
      activeUsers.length === 1 &&
      roleIds.has(OWNER_ROLE_ID) &&
      !activeVendor &&
      !activeAccount &&
      !activeLocation &&
      !activeMaterial &&
      !firstProject;
    const existingInstall = !v2Row && !legacyRow && !freshInstall;
    const state =
      persistedV2 ??
      mapLegacyOwnerOnboardingState(legacy, {
        financeDefaultsReady,
        hasProject: Boolean(firstProject),
        firstProjectId: firstProject?.id ?? null,
        existingInstall,
      });

    const teamReady = SYSTEM_ROLES.slice(1, 4).every((role) => roleIds.has(role.id));
    const materialReady = Boolean(activeLocation && activeMaterial);
    const initialStockNotApplicable =
      state.initialStockDecision === "NO_LEGACY_STOCK" &&
      !pendingOpening &&
      !postedOpening &&
      !rejectedOpening;
    const initialStockReady = Boolean(postedOpening) || initialStockNotApplicable;

    const requiredReadiness: readonly OperationalReadinessItem[] = [
      {
        id: "core_team",
        label: "Tim inti",
        detail: teamReady
          ? "Finance Admin, Project Manager, dan Purchasing aktif."
          : "Lengkapi Finance Admin, Project Manager, dan Purchasing.",
        ready: teamReady,
        status: teamReady ? "READY" : "INCOMPLETE",
        action: action(can(actor, "manage:users"), "/settings?tab=organization", "Kelola tim"),
      },
      {
        id: "bank_account",
        label: "Rekening perusahaan",
        detail: activeAccount
          ? "Minimal satu rekening aktif tersedia."
          : "Rekening diperlukan sebelum arus kas dicatat.",
        ready: Boolean(activeAccount),
        status: activeAccount ? "READY" : "INCOMPLETE",
        action: action(
          can(actor, "create:bank_account"),
          "/ledger?tab=accounts",
          "Tambah rekening",
        ),
      },
      {
        id: "material_foundation",
        label: "Lokasi & Material Master",
        detail: materialReady
          ? "Lokasi dan Material Master aktif tersedia."
          : "Buat lokasi dan minimal satu Material Master aktif.",
        ready: materialReady,
        status: materialReady ? "READY" : "INCOMPLETE",
        action: action(
          can(actor, "manage:material_settings"),
          "/settings?tab=catalog",
          "Siapkan material",
        ),
      },
      {
        id: "initial_stock",
        label: "Keputusan saldo awal stok",
        detail: postedOpening
          ? "Saldo awal stok sudah diposting."
          : pendingOpening
            ? "Pengajuan saldo awal menunggu keputusan Finance."
            : initialStockNotApplicable
              ? "Tidak ada stok lama yang perlu dicatat."
              : "Nyatakan tidak ada stok lama atau ajukan saldo awal fisik.",
        ready: initialStockReady,
        status: pendingOpening
          ? "PENDING_APPROVAL"
          : initialStockNotApplicable
            ? "NOT_APPLICABLE"
            : initialStockReady
              ? "READY"
              : "INCOMPLETE",
        action: action(
          can(actor, "create:opening_inventory") || can(actor, "review:onboarding"),
          pendingOpening && can(actor, "review:onboarding")
            ? "/onboarding/review"
            : "/settings?tab=readiness&flow=initial-stock",
          pendingOpening && can(actor, "review:onboarding")
            ? "Tinjau pengajuan"
            : "Tentukan saldo awal",
        ),
      },
    ];

    const recommendedReadiness: readonly OperationalReadinessItem[] = [
      {
        id: "vendor",
        label: "Vendor",
        detail: activeVendor
          ? "Vendor aktif tersedia untuk pembelian."
          : "Opsional sekarang; diperlukan saat transaksi memilih vendor.",
        ready: Boolean(activeVendor),
        status: activeVendor ? "READY" : "INCOMPLETE",
        action: action(
          can(actor, "manage:vendors"),
          "/settings?tab=organization&admin=vendor",
          "Kelola vendor",
        ),
      },
      {
        id: "item_library",
        label: "Library Item & Harga",
        detail: activeLibraryItem
          ? "Template biaya aktif tersedia."
          : "Opsional untuk mempercepat penyusunan RAP dan RAB.",
        ready: Boolean(activeLibraryItem),
        status: activeLibraryItem ? "READY" : "INCOMPLETE",
        action: action(
          can(actor, "manage:item_library"),
          "/settings?tab=catalog&section=library",
          "Kelola library",
        ),
      },
    ];
    const requiredReadyCount = requiredReadiness.filter((item) => item.ready).length;
    const canManageQuickStart = can(actor, "manage:onboarding");

    return {
      success: true,
      data: {
        canManageQuickStart,
        hasPersistedState: Boolean(v2Row || legacyRow),
        freshInstall,
        shouldAutoOpen: canManageQuickStart && !v2Row && !legacyRow && freshInstall,
        quickStart: { state, progress: getQuickStartProgress(state.currentStep) },
        requiredReadiness,
        recommendedReadiness,
        requiredReadyCount,
        requiredTotal: requiredReadiness.length,
        allRequiredReady: requiredReadyCount === requiredReadiness.length,
      },
    };
  } catch {
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Kesiapan organisasi belum dapat dimuat. Coba lagi.",
      },
    };
  }
}
