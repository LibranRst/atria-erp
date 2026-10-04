import {
  loadAiPreference,
  upsertAiPreference,
  deleteAiPreference,
} from "@backend/lib/ai/user-preference";
import { assertPermission, resolveRoleName } from "@backend/lib/auth/permissions";
import { getRolePermissions } from "@backend/lib/auth/role-access";
import { getServerSession } from "@backend/lib/server/session";
import {
  aiPreferenceInputSchema,
  DEFAULT_AI_PREFERENCE,
  sanitizePrimaryFocus,
  type AiPreferenceInput,
} from "@atria/core/validations/ai-preference";
import type { ActionResponse } from "@atria/core/types/action-response";

type CurrentUserContext = {
  readonly id: string;
  readonly roleId: string;
};

async function currentUser(): Promise<CurrentUserContext | null> {
  const session = await getServerSession();
  if (!session) return null;
  const roleName = await resolveRoleName(session.user.roleId);
  try {
    await assertPermission({ id: session.user.id, role: roleName }, "use:ai_chat");
    return { id: session.user.id, roleId: session.user.roleId };
  } catch {
    return null;
  }
}

export async function getAiPreference(): Promise<ActionResponse<AiPreferenceInput>> {
  const user = await currentUser();
  if (!user) return { success: false, error: { code: "FORBIDDEN", message: "Akses ditolak." } };
  return { success: true, data: await loadAiPreference(user.id) };
}

export async function saveAiPreference(input: unknown): Promise<ActionResponse<AiPreferenceInput>> {
  const user = await currentUser();
  if (!user) return { success: false, error: { code: "FORBIDDEN", message: "Akses ditolak." } };
  const parsed = aiPreferenceInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Preferensi tidak valid.",
      },
    };
  }

  const permissions = await getRolePermissions(user.roleId);
  const sanitizedFocus = sanitizePrimaryFocus(parsed.data.primaryFocus, (permission) =>
    permissions.includes(permission),
  );

  const payload: AiPreferenceInput = {
    ...parsed.data,
    primaryFocus: sanitizedFocus,
  };

  return { success: true, data: await upsertAiPreference(user.id, payload) };
}

export async function resetAiPreference(): Promise<ActionResponse<AiPreferenceInput>> {
  const user = await currentUser();
  if (!user) return { success: false, error: { code: "FORBIDDEN", message: "Akses ditolak." } };
  await deleteAiPreference(user.id);
  return { success: true, data: DEFAULT_AI_PREFERENCE };
}
