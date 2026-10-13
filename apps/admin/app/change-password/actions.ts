"use server";

import { changeOwnPasswordSchema } from "@atria/core/validations/profile";
import { changeTemporaryPasswordSchema } from "@atria/core/validations/administration";
import { callBackendAction } from "@/lib/api/backend";
import { requireAdminActor } from "@/lib/auth/server";

export type ChangePasswordResult =
  | { readonly success: true; readonly requiresLogin: boolean }
  | { readonly success: false; readonly error: string };

export async function changePassword(input: unknown): Promise<ChangePasswordResult> {
  const actor = await requireAdminActor({ allowPasswordChange: true, allowOnboarding: true });
  const temporary = actor.mustChangePassword && !actor.developerActorUserId;
  const parsed = (temporary ? changeTemporaryPasswordSchema : changeOwnPasswordSchema).safeParse(
    input,
  );
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Periksa kata sandi Anda." };
  const result = temporary
    ? await callBackendAction(
        "app/actions/administration-staff.changeTemporaryPassword",
        [parsed.data],
        { allowCookieWrites: true },
      )
    : await callBackendAction(
        "app/actions/profile/change-own-password.changeOwnPassword",
        [parsed.data],
        { allowCookieWrites: true },
      );
  return result.success
    ? { success: true, requiresLogin: temporary }
    : { success: false, error: result.error.message };
}
