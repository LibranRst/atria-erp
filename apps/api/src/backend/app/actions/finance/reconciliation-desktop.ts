import { resolveActor } from "@backend/server/actor";
import {
  getReconciliationDesktopWorkspaceUseCase,
  getReconciliationMatchContextUseCase,
} from "@backend/server/usecases/finance/reconciliation-desktop";
import type {
  ReconciliationDesktopRequest,
  ReconciliationDesktopData,
  ReconciliationMatchContextInput,
  ReconciliationMatchContext,
} from "@atria/core/finance/reconciliation-desktop";
import type { ActionResponse } from "@atria/core/types/action-response";

export async function getReconciliationDesktopWorkspace(
  input: ReconciliationDesktopRequest,
): Promise<ActionResponse<ReconciliationDesktopData>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  return getReconciliationDesktopWorkspaceUseCase(actor, input);
}

export async function getReconciliationMatchContext(
  input: ReconciliationMatchContextInput,
): Promise<ActionResponse<ReconciliationMatchContext>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  return getReconciliationMatchContextUseCase(actor, input);
}
