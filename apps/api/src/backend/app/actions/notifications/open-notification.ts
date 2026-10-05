import { resolveActor } from "@backend/server/actor";
import { getNotificationDestination } from "@backend/server/usecases/notifications/notification-queries";
import { markNotificationReadSchema } from "@atria/core/notifications/types";
import type { ActionResponse } from "@atria/core/types/action-response";
export async function openNotificationAction(
  input: unknown,
): Promise<ActionResponse<{ url: string }>> {
  const actor = await resolveActor();
  const parsed = markNotificationReadSchema.safeParse(input);
  if (!actor || !parsed.success)
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Notifikasi tidak tersedia." },
    };
  try {
    const url = await getNotificationDestination(actor, parsed.data.id);
    if (!url)
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Data sudah tidak tersedia atau akses Anda berubah." },
      };
    return { success: true, data: { url } };
  } catch {
    return {
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Tujuan belum dapat dibuka. Coba lagi." },
    };
  }
}
