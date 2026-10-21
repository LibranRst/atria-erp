import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";

import {
  advanceQuickStartUseCase,
  createFirstProjectQuickStartUseCase,
  pauseQuickStartUseCase,
  recordQuickStartInteractionUseCase,
  setInitialStockDecisionUseCase,
} from "@backend/server/usecases/onboarding/quick-start-mutations";
import { resolveActor } from "@backend/server/actor";
import type {
  CreateFirstProjectQuickStartInput,
  OwnerQuickStartState,
} from "@atria/core/onboarding/organization-setup";
import type { ActionResponse } from "@atria/core/types/action-response";

async function actorOrUnauthorized(): Promise<ReturnType<typeof resolveActor>> {
  return resolveActor();
}

function revalidateSetupPaths(): void {
  revalidatePath("/");
  revalidatePath("/onboarding");
  revalidatePath("/ledger");
  revalidatePath("/projects");
  revalidatePath("/settings");
}

export async function advanceQuickStart(
  input: unknown,
): Promise<ActionResponse<OwnerQuickStartState>> {
  const actor = await actorOrUnauthorized();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  const result = await advanceQuickStartUseCase(actor, input);
  if (result.success) revalidateSetupPaths();
  return result;
}

export async function pauseQuickStart(
  input: unknown,
): Promise<ActionResponse<OwnerQuickStartState>> {
  const actor = await actorOrUnauthorized();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  const result = await pauseQuickStartUseCase(actor, input);
  if (result.success) revalidateSetupPaths();
  return result;
}

export async function createFirstProjectQuickStart(
  input: CreateFirstProjectQuickStartInput,
): Promise<ActionResponse<{ readonly projectId: string; readonly alreadyCompleted: boolean }>> {
  const actor = await actorOrUnauthorized();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  const result = await createFirstProjectQuickStartUseCase(actor, input);
  if (result.success) revalidateSetupPaths();
  return result;
}

export async function setInitialStockReadinessDecision(
  input: unknown,
): Promise<ActionResponse<OwnerQuickStartState>> {
  const actor = await actorOrUnauthorized();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  const result = await setInitialStockDecisionUseCase(actor, input);
  if (result.success) revalidateSetupPaths();
  return result;
}

export async function recordQuickStartRetry(
  input: unknown,
): Promise<ActionResponse<{ readonly recorded: true }>> {
  const actor = await actorOrUnauthorized();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  return recordQuickStartInteractionUseCase(actor, input);
}
