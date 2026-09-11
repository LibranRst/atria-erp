"use server";

import { actorHasPermission } from "@atria/core/auth/permissions";
import { eq, inArray } from "drizzle-orm";

import {
  getInventoryOpeningBatches,
  type InventoryOpeningBatchView,
} from "@/app/actions/material/opening-inventory";
import { db } from "@/db";
import { appConfig, inventoryOpeningBatch } from "@/db/schema";
import { assertPermission, resolveRoleName } from "@/lib/auth/permissions";
import {
  OWNER_ONBOARDING_V2_CONFIG_KEY,
  parseOwnerQuickStartState,
} from "@atria/core/onboarding/organization-setup";
import {
  OWNER_ONBOARDING_CONFIG_KEY,
  parseOwnerOnboardingState,
} from "@atria/core/onboarding/owner-onboarding";
import { requireServerSession } from "@/lib/server/session";
import type { ActionResponse } from "@atria/core/types/action-response";

export type OnboardingReviewState = {
  readonly onboardingCompleted: boolean;
  readonly pendingBatches: readonly InventoryOpeningBatchView[];
};

export async function hasPendingOnboardingSetupApproval(): Promise<boolean> {
  const pending = await db.query.inventoryOpeningBatch.findFirst({
    where: eq(inventoryOpeningBatch.status, "PENDING_APPROVAL"),
    columns: { id: true },
  });
  return Boolean(pending);
}

export async function getOnboardingReviewState(): Promise<ActionResponse<OnboardingReviewState>> {
  const session = await requireServerSession();
  const roleName = await resolveRoleName(session.user.roleId);
  if (!actorHasPermission(roleName, "review:onboarding"))
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Onboarding Review hanya tersedia untuk Finance Admin.",
      },
    };
  try {
    await assertPermission(
      { id: session.user.id, roleId: session.user.roleId },
      "approve:opening_inventory",
    );
    const [stateRows, batches] = await Promise.all([
      db.query.appConfig.findMany({
        where: inArray(appConfig.key, [
          OWNER_ONBOARDING_V2_CONFIG_KEY,
          OWNER_ONBOARDING_CONFIG_KEY,
        ]),
        columns: { key: true, value: true },
      }),
      getInventoryOpeningBatches(),
    ]);
    if (!batches.success) return batches;
    const v2 = parseOwnerQuickStartState(
      stateRows.find((row) => row.key === OWNER_ONBOARDING_V2_CONFIG_KEY)?.value,
    );
    const legacy = parseOwnerOnboardingState(
      stateRows.find((row) => row.key === OWNER_ONBOARDING_CONFIG_KEY)?.value,
    );
    return {
      success: true,
      data: {
        onboardingCompleted: v2?.status === "COMPLETED" || legacy?.status === "COMPLETED",
        pendingBatches: batches.data.filter((batch) => batch.status === "PENDING_APPROVAL"),
      },
    };
  } catch {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Permission approval saldo awal tidak tersedia." },
    };
  }
}
