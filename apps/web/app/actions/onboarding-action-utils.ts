import { actorHasPermission } from "@atria/core/auth/permissions";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { appConfig, auditLog } from "@/db/schema";
import { resolveRoleName } from "@/lib/auth/permissions";
import {
  OWNER_ONBOARDING_CONFIG_KEY,
  type OwnerOnboardingState,
  parseOwnerOnboardingState,
} from "@atria/core/onboarding/owner-onboarding";
import { requireServerSession } from "@/lib/server/session";
import type { OnboardingActor } from "@/app/actions/onboarding-types";

export async function getOnboardingActor(): Promise<OnboardingActor> {
  const session = await requireServerSession();
  return { id: session.user.id, roleId: session.user.roleId };
}

export async function requireOnboardingOwner(): Promise<OnboardingActor> {
  const current = await getOnboardingActor();
  if (!actorHasPermission(await resolveRoleName(current.roleId), "manage:onboarding")) {
    throw new Error("FORBIDDEN");
  }
  return current;
}

export function uniqueOnboardingSteps<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

export async function readPersistedOnboardingState(): Promise<{
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

export async function saveOnboardingState(
  current: OnboardingActor,
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
    await tx.insert(auditLog).values({
      userId: current.id,
      action,
      targetTable: "app_config",
      targetId: saved.id,
      originalState: existing?.value ?? null,
      newState: value,
    });
  });
  revalidateOnboardingPaths();
}

export function revalidateOnboardingPaths(): void {
  revalidatePath("/");
  revalidatePath("/onboarding");
  revalidatePath("/settings");
}
