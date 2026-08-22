"use server";

import { loadAiPreference, upsertAiPreference, deleteAiPreference } from "@/lib/ai/user-preference";
import { assertPermission, resolveRoleName } from "@/lib/auth/permissions";
import { getServerSession } from "@/lib/server/session";
import {
  aiPreferenceInputSchema,
  DEFAULT_AI_PREFERENCE,
  type AiPreferenceInput,
} from "@atria/core/validations/ai-preference";
import type { ActionResponse } from "@atria/core/types/action-response";

async function currentUserId(): Promise<string | null> {
  const session = await getServerSession();
  if (!session) return null;
  const roleName = await resolveRoleName(session.user.roleId);
  try {
    await assertPermission({ id: session.user.id, role: roleName }, "use:ai_chat");
    return session.user.id;
  } catch {
    return null;
  }
}

export async function getAiPreference(): Promise<ActionResponse<AiPreferenceInput>> {
  const userId = await currentUserId();
  if (!userId) return { success: false, error: { code: "FORBIDDEN", message: "Akses ditolak." } };
  return { success: true, data: await loadAiPreference(userId) };
}

export async function saveAiPreference(input: unknown): Promise<ActionResponse<AiPreferenceInput>> {
  const userId = await currentUserId();
  if (!userId) return { success: false, error: { code: "FORBIDDEN", message: "Akses ditolak." } };
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
  return { success: true, data: await upsertAiPreference(userId, parsed.data) };
}

export async function resetAiPreference(): Promise<ActionResponse<AiPreferenceInput>> {
  const userId = await currentUserId();
  if (!userId) return { success: false, error: { code: "FORBIDDEN", message: "Akses ditolak." } };
  await deleteAiPreference(userId);
  return { success: true, data: DEFAULT_AI_PREFERENCE };
}
