"use server";

import { resolveActor } from "@/server/actor";
import { getNotificationSummary } from "@/server/usecases/notifications/notification-queries";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { NotificationSummary } from "@atria/core/notifications/types";

export async function getNotificationsAction(): Promise<ActionResponse<NotificationSummary>> {
  const actor = await resolveActor();
  if (!actor) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid atau telah berakhir." },
    };
  }

  try {
    const data = await getNotificationSummary(actor);
    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("Gagal mengambil daftar notifikasi:", error);
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Gagal memuat notifikasi. Silakan coba lagi.",
      },
    };
  }
}
