"use server";

import { revalidatePath } from "next/cache";

import { resolveActor } from "@/server/actor";
import {
  getApprovalThresholdSettingsUseCase,
  updateApprovalThresholdsUseCase,
  type ApprovalThresholdSettings,
} from "@/server/usecases/settings/approval-thresholds";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { UpdateApprovalThresholdsInput } from "@atria/core/validations/settings";

export async function getApprovalThresholdSettings(): Promise<
  ActionResponse<ApprovalThresholdSettings>
> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  return getApprovalThresholdSettingsUseCase(actor);
}

export async function updateApprovalThresholds(
  input: UpdateApprovalThresholdsInput,
): Promise<ActionResponse<{ readonly updated: boolean }>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };

  const result = await updateApprovalThresholdsUseCase(actor, input);
  if (result.success && result.data.updated) {
    // Ambang menyentuh keputusan di seluruh alur pengeluaran, bukan satu halaman.
    revalidatePath("/settings");
    revalidatePath("/expenses");
    revalidatePath("/ledger");
  }
  return result;
}
