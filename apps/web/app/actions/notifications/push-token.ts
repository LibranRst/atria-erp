"use server";

import { resolveActor } from "@/server/actor";
import {
  registerPushSubscription,
  unregisterPushSubscription,
} from "@/server/usecases/notifications/notification-queries";
import {
  registerPushTokenSchema,
  unregisterPushTokenSchema,
} from "@atria/core/notifications/types";
import type { ActionResponse } from "@atria/core/types/action-response";

export async function registerPushTokenAction(
  rawInput: unknown,
): Promise<ActionResponse<{ success: boolean }>> {
  const actor = await resolveActor();
  if (!actor) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid atau telah berakhir." },
    };
  }

  const parsed = registerPushTokenSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Data token push tidak valid." },
    };
  }

  try {
    const result = await registerPushSubscription(parsed.data, actor.userId, actor.sessionId);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Gagal mendaftarkan push token:", error);
    return {
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Gagal menyimpan langganan push." },
    };
  }
}

export async function unregisterPushTokenAction(
  rawInput: unknown,
): Promise<ActionResponse<{ success: boolean }>> {
  const actor = await resolveActor();
  if (!actor) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid atau telah berakhir." },
    };
  }
  const parsed = unregisterPushTokenSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Data langganan push tidak valid." },
    };
  }
  try {
    return {
      success: true,
      data: await unregisterPushSubscription(parsed.data, actor.userId),
    };
  } catch (error) {
    console.error("Gagal menonaktifkan push token:", error);
    return {
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Gagal menonaktifkan push." },
    };
  }
}
