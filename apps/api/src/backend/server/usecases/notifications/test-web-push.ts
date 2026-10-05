import { and, eq } from "drizzle-orm";
import { db } from "@backend/db";
import { userPushSubscription } from "@backend/db/schema";
import { INSTANCE_TENANT_ID } from "@backend/db/schema/tenant-constants";
import { checkRateLimit } from "@backend/lib/ai/rate-limit";
import type { Actor } from "@backend/server/actor";
import {
  getWebPushConfiguration,
  isExpiredWebPushError,
  sendWebPushMessage,
} from "@backend/server/services/web-push";

export type WebPushTestResult =
  "accepted" | "unconfigured" | "not-registered" | "expired" | "rate-limited";

/** Only the authenticated session's saved endpoint can receive this explicit test. */
export async function testWebPush(actor: Actor, endpoint: string): Promise<WebPushTestResult> {
  if (!actor.isActive || !actor.sessionId) return "not-registered";
  if (!getWebPushConfiguration()) return "unconfigured";
  const subscription = await db.query.userPushSubscription.findFirst({
    where: and(
      eq(userPushSubscription.tenantId, INSTANCE_TENANT_ID),
      eq(userPushSubscription.userId, actor.userId),
      eq(userPushSubscription.sessionId, actor.sessionId),
      eq(userPushSubscription.platform, "WEB"),
      eq(userPushSubscription.endpoint, endpoint),
    ),
  });
  if (!subscription?.endpoint || !subscription.p256dh || !subscription.auth)
    return "not-registered";
  if (!checkRateLimit(`web-push-test:${actor.userId}`).allowed) return "rate-limited";
  try {
    await sendWebPushMessage(
      { endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth },
      {
        title: "Notifikasi Atria siap",
        body: "Notifikasi percobaan diterima. Ketuk untuk membuka Atria.",
        url: "/notifications",
        notificationId: crypto.randomUUID(),
      },
      "high",
    );
    return "accepted";
  } catch (error: unknown) {
    if (!isExpiredWebPushError(error)) throw error;
    await db
      .update(userPushSubscription)
      .set({ endpoint: null, p256dh: null, auth: null, updatedAt: new Date() })
      .where(
        and(
          eq(userPushSubscription.id, subscription.id),
          eq(userPushSubscription.userId, actor.userId),
          eq(userPushSubscription.sessionId, actor.sessionId),
          eq(userPushSubscription.endpoint, endpoint),
        ),
      );
    return "expired";
  }
}
