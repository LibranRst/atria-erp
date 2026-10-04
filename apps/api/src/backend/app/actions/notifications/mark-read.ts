import { resolveActor } from "@backend/server/actor";
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@backend/server/usecases/notifications/notification-queries";
import {
  markAllNotificationsReadSchema,
  markNotificationReadSchema,
} from "@atria/core/notifications/types";
import type { ActionResponse } from "@atria/core/types/action-response";

export async function markNotificationReadAction(
  rawInput: unknown,
): Promise<ActionResponse<{ success: boolean }>> {
  const actor = await resolveActor();
  if (!actor) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid atau telah berakhir." },
    };
  }

  const parsed = markNotificationReadSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "ID notifikasi tidak valid." },
    };
  }

  try {
    const result = await markNotificationAsRead(parsed.data.id, actor);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Gagal menandai notifikasi dibaca:", error);
    return {
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Gagal memperbarui status notifikasi." },
    };
  }
}

export async function markAllNotificationsReadAction(
  rawInput?: unknown,
): Promise<ActionResponse<{ success: boolean }>> {
  const actor = await resolveActor();
  if (!actor) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid atau telah berakhir." },
    };
  }

  const parsed = markAllNotificationsReadSchema.safeParse(rawInput ?? {});
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Kategori notifikasi tidak valid." },
    };
  const category = parsed.data.category;

  try {
    const result = await markAllNotificationsAsRead(actor, category);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Gagal menandai semua notifikasi dibaca:", error);
    return {
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Gagal memperbarui status notifikasi." },
    };
  }
}
