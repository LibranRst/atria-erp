import { resolveActor } from "@backend/server/actor";
import {
  registerPushSubscription,
  unregisterPushSubscription,
} from "@backend/server/usecases/notifications/notification-queries";
import {
  registerPushTokenSchema,
  unregisterPushTokenSchema,
} from "@atria/core/notifications/types";
import type { ActionResponse } from "@atria/core/types/action-response";
import { z } from "zod";
import {
  testWebPush,
  type WebPushTestResult,
} from "@backend/server/usecases/notifications/test-web-push";

const testWebPushSchema = z.object({
  endpoint: z.string().trim().max(2048).url().startsWith("https://"),
});

export async function testWebPushAction(
  rawInput: unknown,
): Promise<ActionResponse<{ accepted: true }>> {
  const actor = await resolveActor();
  if (!actor)
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi telah berakhir. Masuk kembali." },
    };
  const parsed = testWebPushSchema.safeParse(rawInput);
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Langganan perangkat tidak valid." },
    };
  try {
    const result = await testWebPush(actor, parsed.data.endpoint);
    if (result === "accepted") return { success: true, data: { accepted: true } };
    const messages: Record<Exclude<WebPushTestResult, "accepted">, string> = {
      unconfigured: "Pengiriman notifikasi belum disiapkan. Hubungi admin Atria.",
      "not-registered": "Perangkat belum tersambung ke akun ini. Sambungkan ulang notifikasi.",
      expired: "Langganan perangkat telah berakhir. Matikan lalu aktifkan kembali notifikasi.",
      "rate-limited": "Terlalu banyak percobaan. Tunggu satu menit lalu coba lagi.",
    };
    return {
      success: false,
      error: {
        code: result === "unconfigured" ? "INTERNAL_SERVER_ERROR" : "CONFLICT",
        message: messages[result],
      },
    };
  } catch (error: unknown) {
    console.error("Web Push test failed", error instanceof Error ? error.name : "UnknownError");
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Notifikasi percobaan belum terkirim. Periksa koneksi lalu coba lagi.",
      },
    };
  }
}

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
