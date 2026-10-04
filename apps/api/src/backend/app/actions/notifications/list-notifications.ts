import { resolveActor } from "@backend/server/actor";
import { getNotificationPage } from "@backend/server/usecases/notifications/notification-queries";
import { notificationListSchema, type NotificationPage } from "@atria/core/notifications/types";
import type { ActionResponse } from "@atria/core/types/action-response";
export async function listNotificationsAction(
  input: unknown,
): Promise<ActionResponse<NotificationPage>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi telah berakhir." } };
  const parsed = notificationListSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Filter notifikasi tidak valid." },
    };
  try {
    return { success: true, data: await getNotificationPage(actor, parsed.data) };
  } catch (error) {
    console.error("Notification list failed", error);
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Notifikasi belum berhasil dimuat. Coba lagi.",
      },
    };
  }
}
