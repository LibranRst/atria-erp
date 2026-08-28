"use server";

import { resolveActor } from "@/server/actor";
import { changeOwnPasswordUseCase } from "@/server/usecases/profile/change-own-password";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { ChangeOwnPasswordInput } from "@atria/core/validations/profile";

/**
 * Pembungkus tipis di atas `changeOwnPasswordUseCase`. Tidak ada
 * `revalidatePath`: tidak ada satu pun tampilan yang merender kata sandi.
 */
export async function changeOwnPassword(
  input: ChangeOwnPasswordInput,
): Promise<ActionResponse<{ readonly changed: true }>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  return changeOwnPasswordUseCase(actor, input);
}
