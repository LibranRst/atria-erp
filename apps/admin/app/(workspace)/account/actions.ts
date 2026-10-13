"use server";

import { updateOwnProfileSchema } from "@atria/core/validations/profile";
import { callBackendAction } from "@/lib/api/backend";
import { requireAdminActor } from "@/lib/auth/server";

export type UpdateAccountResult =
  { readonly success: true } | { readonly success: false; readonly error: string };

export async function updateAccount(input: unknown): Promise<UpdateAccountResult> {
  await requireAdminActor();
  const parsed = updateOwnProfileSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Periksa nama Anda." };
  const result = await callBackendAction(
    "app/actions/profile/update-own-profile.updateOwnProfile",
    [parsed.data],
    { allowCookieWrites: true },
  );
  return result.success ? { success: true } : { success: false, error: result.error.message };
}
