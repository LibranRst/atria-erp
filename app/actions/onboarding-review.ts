"use server";

import { eq } from "drizzle-orm";

import { getInventoryOpeningBatches, type InventoryOpeningBatchView } from "@/app/actions/material/opening-inventory";
import { db } from "@/db";
import { appConfig, inventoryOpeningBatch } from "@/db/schema";
import { assertPermission, resolveRoleName } from "@/lib/auth/permissions";
import { OWNER_ONBOARDING_CONFIG_KEY, parseOwnerOnboardingState } from "@/lib/onboarding/owner-onboarding";
import { requireServerSession } from "@/lib/server/session";
import type { ActionResponse } from "@/lib/types/action-response";

export type OnboardingReviewState = {
  readonly onboardingCompleted: boolean;
  readonly pendingBatches: readonly InventoryOpeningBatchView[];
};

export async function hasPendingOnboardingSetupApproval(): Promise<boolean> {
  const [stateRow, pending] = await Promise.all([
    db.query.appConfig.findFirst({ where: eq(appConfig.key, OWNER_ONBOARDING_CONFIG_KEY), columns: { value: true } }),
    db.query.inventoryOpeningBatch.findFirst({ where: eq(inventoryOpeningBatch.status, "PENDING_APPROVAL"), columns: { id: true } }),
  ]);
  return parseOwnerOnboardingState(stateRow?.value)?.status !== "COMPLETED" && Boolean(pending);
}

export async function getOnboardingReviewState(): Promise<ActionResponse<OnboardingReviewState>> {
  const session = await requireServerSession();
  const roleName = await resolveRoleName(session.user.roleId);
  if (roleName !== "FINANCE_ADMIN") return { success: false, error: { code: "FORBIDDEN", message: "Onboarding Review hanya tersedia untuk Finance Admin." } };
  try {
    await assertPermission({ id: session.user.id, roleId: session.user.roleId }, "approve:opening_inventory");
    const [stateRow, batches] = await Promise.all([
      db.query.appConfig.findFirst({ where: eq(appConfig.key, OWNER_ONBOARDING_CONFIG_KEY), columns: { value: true } }),
      getInventoryOpeningBatches(),
    ]);
    if (!batches.success) return batches;
    return {
      success: true,
      data: {
        onboardingCompleted: parseOwnerOnboardingState(stateRow?.value)?.status === "COMPLETED",
        pendingBatches: batches.data.filter((batch) => batch.status === "PENDING_APPROVAL"),
      },
    };
  } catch {
    return { success: false, error: { code: "FORBIDDEN", message: "Permission approval saldo awal tidak tersedia." } };
  }
}
