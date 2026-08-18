import "server-only";

import { eq } from "drizzle-orm";

import {
  readPersistedOnboardingState,
  uniqueOnboardingSteps,
} from "@/app/actions/onboarding-action-utils";
import type { OnboardingActor } from "@/app/actions/onboarding-types";
import { db } from "@/db";
import {
  bankAccount,
  budgetAllocationSetting,
  expenseCategory,
  inventoryLocation,
  inventoryOpeningBatch,
  itemPriceLibrary,
  materialMaster,
  user,
  vendor,
} from "@/db/schema";
import { assertPermission, resolveRoleName } from "@/lib/auth/permissions";
import { OWNER_ROLE_ID, SYSTEM_ROLES } from "@atria/core/auth/role-constants";
import { DEFAULT_EXPENSE_CATEGORIES } from "@atria/core/budget/excel-budget";
import {
  DEFAULT_OWNER_ONBOARDING_STATE,
  deriveOwnerOnboardingGates,
  type OnboardingStepId,
  type OnboardingStepStatus,
  type OwnerOnboardingOverview,
  type OwnerOnboardingReadiness,
  type OwnerOnboardingState,
} from "@atria/core/onboarding/owner-onboarding";
import type { ActionResponse } from "@atria/core/types/action-response";

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

/**
 * Ringkasan onboarding organisasi untuk Owner.
 *
 * Menerima `OnboardingActor` eksplisit alih-alih membaca sesi sendiri. Itu yang
 * membuatnya bisa dipanggil dari loader layar yang dipakai tRPC — versi lama
 * memanggil `requireServerSession()` yang melakukan `redirect()`, dan
 * control-flow throw itu tidak bisa menyeberang ke prosedur tRPC.
 */
export async function getOwnerOnboardingOverviewUseCase(
  current: OnboardingActor,
): Promise<ActionResponse<OwnerOnboardingOverview>> {
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
    readPersistedOnboardingState(),
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

  const rawState = persisted.state ?? DEFAULT_OWNER_ONBOARDING_STATE;
  const roleIds = new Set(users.map((row) => row.roleId));
  const teamReady = SYSTEM_ROLES.slice(1, 4).every((role) => roleIds.has(role.id));
  const categoryCodes = new Set(categories.map((row) => row.code));
  const financeReady =
    Boolean(budget) &&
    DEFAULT_EXPENSE_CATEGORIES.every((category) => categoryCodes.has(category.code));
  const materialReady = locations.length > 0 && materials.length > 0;
  const initialStockNotApplicable =
    rawState.initialStockDecision === "NO_LEGACY_STOCK" &&
    pendingBatches.length === 0 &&
    postedBatches.length === 0 &&
    rejectedBatches.length === 0;
  const initialStockReady = postedBatches.length > 0 || initialStockNotApplicable;

  const preReadinessMap: Record<OnboardingStepId, boolean> = {
    welcome: rawState.reviewedSteps.includes("welcome"),
    financial_defaults: financeReady,
    team_vendors: teamReady,
    bank_accounts: accounts.length > 0,
    material_foundation: materialReady,
    item_library: libraryItems.length > 0,
    initial_stock: initialStockReady,
    summary: rawState.status === "COMPLETED",
  };
  const setupStepIds: readonly OnboardingStepId[] = [
    "financial_defaults",
    "team_vendors",
    "bank_accounts",
    "material_foundation",
    "item_library",
    "initial_stock",
  ];
  const firstUnreadySetupStepId = setupStepIds.find((id) => !preReadinessMap[id]);
  const isCurrentStepReady = preReadinessMap[rawState.currentStep];
  const effectiveCurrentStep: OnboardingStepId = (() => {
    if (rawState.status === "COMPLETED") return "summary";
    if (
      isCurrentStepReady ||
      (rawState.currentStep === "welcome" &&
        firstUnreadySetupStepId &&
        firstUnreadySetupStepId !== "welcome")
    ) {
      return firstUnreadySetupStepId ?? "summary";
    }
    return rawState.currentStep;
  })();
  const state: OwnerOnboardingState = {
    ...rawState,
    currentStep: effectiveCurrentStep,
    reviewedSteps: uniqueOnboardingSteps(
      effectiveCurrentStep !== "welcome" && !rawState.reviewedSteps.includes("welcome")
        ? [...rawState.reviewedSteps, "welcome"]
        : rawState.reviewedSteps,
    ),
  };

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
      detail: "Budget default dan kategori biaya utama tersedia.",
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
      detail: "Tinjau hal yang masih perlu dilengkapi sebelum membuat proyek pertama.",
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
