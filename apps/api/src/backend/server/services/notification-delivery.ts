import webPush from "web-push";
import { and, asc, eq, gt, inArray, isNotNull, isNull, lte, or } from "drizzle-orm";

import { db } from "@backend/db";
import {
  notificationDelivery,
  project,
  session,
  tenantMember,
  user,
  userPushSubscription,
} from "@backend/db/schema";
import { INSTANCE_TENANT_ID } from "@backend/db/schema/tenant-constants";
import { getRoleAccess } from "@backend/lib/auth/role-access";
import {
  ANDROID_NOTIFICATION_CHANNEL_ID,
  notificationDestination,
} from "@atria/core/notifications/types";

export type NotificationDeliveryTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type NotificationIdentity = {
  readonly id: string;
  readonly userId: string;
};

type ClaimedDelivery = typeof notificationDelivery.$inferSelect & {
  notification: NonNullable<Awaited<ReturnType<typeof db.query.notification.findFirst>>>;
  pushSubscription: NonNullable<
    Awaited<ReturnType<typeof db.query.userPushSubscription.findFirst>>
  >;
};

type ExpoTicket = {
  readonly status?: unknown;
  readonly id?: unknown;
  readonly message?: unknown;
  readonly details?: unknown;
};

type ExpoReceipt = {
  readonly status?: unknown;
  readonly message?: unknown;
  readonly details?: unknown;
};

const DELIVERY_LEASE_MS = 120_000;
const EXPO_RECEIPT_DELAY_MS = 15 * 60_000;
const MAX_SEND_ATTEMPTS = 8;
const MAX_RECEIPT_ATTEMPTS = 8;

function errorMessage(error: unknown): string {
  const value = error instanceof Error ? error.message : "Push delivery failed";
  return value.slice(0, 1000);
}

function providerError(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("error" in value)) return null;
  return typeof value.error === "string" ? value.error : null;
}

function retryAt(now: Date, attempts: number): Date {
  const delay = Math.min(6 * 60 * 60_000, 60_000 * 2 ** Math.max(0, attempts - 1));
  return new Date(now.getTime() + delay);
}

function webPushStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) return null;
  return typeof error.statusCode === "number" ? error.statusCode : null;
}

export async function enqueueNotificationDeliveries(
  tx: NotificationDeliveryTransaction,
  notifications: readonly NotificationIdentity[],
): Promise<number> {
  if (!notifications.length) return 0;
  const subscriptions = await tx.query.userPushSubscription.findMany({
    where: and(
      eq(userPushSubscription.tenantId, INSTANCE_TENANT_ID),
      inArray(
        userPushSubscription.userId,
        Array.from(new Set(notifications.map((row) => row.userId))),
      ),
    ),
  });
  const rows = notifications.flatMap((item) =>
    subscriptions.flatMap((subscription) => {
      if (subscription.userId !== item.userId) return [];
      const channel =
        subscription.platform === "WEB"
          ? subscription.endpoint && subscription.p256dh && subscription.auth
            ? "WEB"
            : null
          : subscription.token
            ? "EXPO"
            : null;
      return channel
        ? [
            {
              notificationId: item.id,
              pushSubscriptionId: subscription.id,
              channel,
            },
          ]
        : [];
    }),
  );
  if (!rows.length) return 0;
  const inserted = await tx
    .insert(notificationDelivery)
    .values(rows)
    .onConflictDoNothing({
      target: [notificationDelivery.notificationId, notificationDelivery.pushSubscriptionId],
    })
    .returning({ id: notificationDelivery.id });
  return inserted.length;
}

async function claimDeliveries(
  now: Date,
  receipts: boolean,
  limit: number,
): Promise<ClaimedDelivery[]> {
  const ids = await db.transaction(async (tx) => {
    const selected = await tx
      .select({ id: notificationDelivery.id })
      .from(notificationDelivery)
      .where(
        and(
          eq(notificationDelivery.tenantId, INSTANCE_TENANT_ID),
          receipts
            ? or(
                and(
                  eq(notificationDelivery.status, "SENT"),
                  lte(notificationDelivery.nextAttemptAt, now),
                  isNotNull(notificationDelivery.providerTicketId),
                ),
                and(
                  eq(notificationDelivery.status, "PROCESSING"),
                  lte(notificationDelivery.leaseExpiresAt, now),
                  isNotNull(notificationDelivery.providerTicketId),
                ),
              )
            : or(
                and(
                  inArray(notificationDelivery.status, ["PENDING", "RETRY"]),
                  lte(notificationDelivery.nextAttemptAt, now),
                  isNull(notificationDelivery.providerTicketId),
                ),
                and(
                  eq(notificationDelivery.status, "PROCESSING"),
                  lte(notificationDelivery.leaseExpiresAt, now),
                  isNull(notificationDelivery.providerTicketId),
                ),
              ),
        ),
      )
      .orderBy(asc(notificationDelivery.nextAttemptAt), asc(notificationDelivery.id))
      .limit(limit)
      .for("update", { skipLocked: true });
    for (const row of selected) {
      const current = await tx.query.notificationDelivery.findFirst({
        where: eq(notificationDelivery.id, row.id),
      });
      if (!current) continue;
      await tx
        .update(notificationDelivery)
        .set({
          status: "PROCESSING",
          attempts: receipts ? current.attempts : current.attempts + 1,
          receiptAttempts: receipts ? current.receiptAttempts + 1 : current.receiptAttempts,
          leaseExpiresAt: new Date(now.getTime() + DELIVERY_LEASE_MS),
          updatedAt: now,
        })
        .where(eq(notificationDelivery.id, row.id));
    }
    return selected.map((row) => row.id);
  });
  if (!ids.length) return [];
  return db.query.notificationDelivery.findMany({
    where: inArray(notificationDelivery.id, ids),
    with: { notification: true, pushSubscription: true },
  }) as Promise<ClaimedDelivery[]>;
}

async function recipientStillEligible(delivery: ClaimedDelivery): Promise<boolean> {
  const [memberRecipient] = await db
    .select({ id: user.id, roleId: tenantMember.roleId })
    .from(tenantMember)
    .innerJoin(user, eq(user.id, tenantMember.userId))
    .where(
      and(
        eq(tenantMember.tenantId, delivery.notification.tenantId),
        eq(tenantMember.userId, delivery.notification.userId),
        eq(tenantMember.isActive, true),
        eq(user.isActive, true),
      ),
    )
    .limit(1);
  let recipient = memberRecipient;
  if (!recipient) {
    const directUser = await db.query.user.findFirst({
      where: and(eq(user.id, delivery.notification.userId), eq(user.isActive, true)),
    });
    if (directUser) {
      recipient = { id: directUser.id, roleId: directUser.roleId };
    }
  }
  if (!recipient) return false;
  if (delivery.pushSubscription.sessionId) {
    const validSession = await db.query.session.findFirst({
      where: and(
        eq(session.id, delivery.pushSubscription.sessionId),
        eq(session.userId, recipient.id),
        gt(session.expiresAt, new Date()),
      ),
    });
    if (!validSession) return false;
  }
  const access = await getRoleAccess(recipient.roleId);
  if (
    !access ||
    (delivery.notification.requiredPermission &&
      !access.permissions.some(
        (permission) => permission === delivery.notification.requiredPermission,
      ))
  )
    return false;
  if (!delivery.notification.projectId) return true;
  const scoped = await db.query.project.findFirst({
    where: and(
      eq(project.id, delivery.notification.projectId),
      eq(project.tenantId, INSTANCE_TENANT_ID),
    ),
  });
  return Boolean(
    scoped &&
    (access.dataScope === "GLOBAL" ||
      (access.dataScope === "ASSIGNED" && scoped.projectManagerId === recipient.id)),
  );
}

async function finish(
  id: string,
  values: Partial<typeof notificationDelivery.$inferInsert>,
): Promise<void> {
  await db
    .update(notificationDelivery)
    .set({ ...values, leaseExpiresAt: null, updatedAt: new Date() })
    .where(eq(notificationDelivery.id, id));
}

async function retireSubscription(
  subscription: ClaimedDelivery["pushSubscription"],
): Promise<void> {
  await db
    .update(userPushSubscription)
    .set({ token: null, endpoint: null, p256dh: null, auth: null, updatedAt: new Date() })
    .where(eq(userPushSubscription.id, subscription.id));
}

async function retryOrFail(delivery: ClaimedDelivery, error: unknown, now: Date): Promise<void> {
  const exhausted = delivery.attempts >= MAX_SEND_ATTEMPTS;
  await finish(delivery.id, {
    status: exhausted ? "DEAD" : "RETRY",
    nextAttemptAt: exhausted ? now : retryAt(now, delivery.attempts),
    lastError: errorMessage(error),
  });
}

async function sendWeb(delivery: ClaimedDelivery, now: Date): Promise<void> {
  const subscription = delivery.pushSubscription;
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    await retryOrFail(delivery, new Error("WEB_PUSH_VAPID_NOT_CONFIGURED"), now);
    return;
  }
  if (!subscription.endpoint || !subscription.p256dh || !subscription.auth) {
    await finish(delivery.id, { status: "DEAD", lastError: "WEB_SUBSCRIPTION_INCOMPLETE" });
    return;
  }
  try {
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify({
        title: delivery.notification.title,
        body: delivery.notification.message,
        url: notificationDestination(delivery.notification),
        notificationId: delivery.notification.id,
      }),
      {
        vapidDetails: { subject, publicKey, privateKey },
        TTL: 60 * 60,
        urgency: delivery.notification.category === "ACTION_REQUIRED" ? "high" : "normal",
        topic: delivery.notification.id.replaceAll("-", "").slice(0, 32),
        timeout: 10_000,
      },
    );
    await finish(delivery.id, {
      status: "DELIVERED",
      sentAt: now,
      deliveredAt: now,
      lastError: null,
    });
  } catch (error) {
    if (webPushStatus(error) === 404 || webPushStatus(error) === 410) {
      await retireSubscription(subscription);
      await finish(delivery.id, { status: "DEAD", lastError: "WEB_SUBSCRIPTION_EXPIRED" });
      return;
    }
    await retryOrFail(delivery, error, now);
  }
}

async function sendExpo(deliveries: readonly ClaimedDelivery[], now: Date): Promise<void> {
  for (let offset = 0; offset < deliveries.length; offset += 100) {
    const batch = deliveries.slice(offset, offset + 100);
    const messages = batch.map((delivery) => ({
      to: delivery.pushSubscription.token,
      title: delivery.notification.title,
      body: delivery.notification.message,
      data: {
        notificationId: delivery.notification.id,
        url: notificationDestination(delivery.notification),
      },
      sound: "default" as const,
      // iOS tidak mengenal `channelId`; hanya kirim untuk perangkat Android.
      ...(delivery.pushSubscription.platform === "EXPO_ANDROID"
        ? { channelId: ANDROID_NOTIFICATION_CHANNEL_ID }
        : {}),
    }));
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages),
      });
      if (!response.ok) throw new Error(`Expo push HTTP ${response.status}`);
      const payload: unknown = await response.json();
      const tickets =
        typeof payload === "object" &&
        payload !== null &&
        "data" in payload &&
        Array.isArray(payload.data)
          ? (payload.data as ExpoTicket[])
          : null;
      if (!tickets || tickets.length !== batch.length)
        throw new Error("EXPO_TICKET_COUNT_MISMATCH");
      for (let index = 0; index < batch.length; index += 1) {
        const delivery = batch[index];
        const ticket = tickets[index];
        const providerCode = providerError(ticket?.details);
        if (ticket?.status === "ok" && typeof ticket.id === "string") {
          await finish(delivery.id, {
            status: "SENT",
            providerTicketId: ticket.id,
            sentAt: now,
            nextAttemptAt: new Date(now.getTime() + EXPO_RECEIPT_DELAY_MS),
            lastError: null,
          });
        } else if (providerCode === "DeviceNotRegistered") {
          await retireSubscription(delivery.pushSubscription);
          await finish(delivery.id, { status: "DEAD", lastError: providerCode });
        } else if (providerCode === "MessageRateExceeded") {
          await retryOrFail(delivery, new Error(providerCode), now);
        } else {
          await finish(delivery.id, {
            status: "DEAD",
            lastError:
              typeof ticket?.message === "string"
                ? ticket.message.slice(0, 1000)
                : "EXPO_TICKET_ERROR",
          });
        }
      }
    } catch (error) {
      await Promise.all(batch.map((delivery) => retryOrFail(delivery, error, now)));
    }
  }
}

async function checkExpoReceipts(deliveries: readonly ClaimedDelivery[], now: Date): Promise<void> {
  for (let offset = 0; offset < deliveries.length; offset += 1000) {
    const batch = deliveries.slice(offset, offset + 1000);
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ids: batch.map((delivery) => delivery.providerTicketId) }),
      });
      if (!response.ok) throw new Error(`Expo receipt HTTP ${response.status}`);
      const payload: unknown = await response.json();
      const receipts =
        typeof payload === "object" &&
        payload !== null &&
        "data" in payload &&
        typeof payload.data === "object" &&
        payload.data !== null
          ? (payload.data as Record<string, ExpoReceipt>)
          : {};
      for (const delivery of batch) {
        const receipt = delivery.providerTicketId ? receipts[delivery.providerTicketId] : undefined;
        const providerCode = providerError(receipt?.details);
        if (receipt?.status === "ok") {
          await finish(delivery.id, {
            status: "DELIVERED",
            deliveredAt: now,
            lastError: null,
          });
        } else if (providerCode === "DeviceNotRegistered") {
          await retireSubscription(delivery.pushSubscription);
          await finish(delivery.id, { status: "DEAD", lastError: providerCode });
        } else if (providerCode === "MessageRateExceeded") {
          await finish(delivery.id, {
            status: "RETRY",
            providerTicketId: null,
            nextAttemptAt: retryAt(now, delivery.attempts),
            lastError: providerCode,
          });
        } else if (!receipt && delivery.receiptAttempts < MAX_RECEIPT_ATTEMPTS) {
          await finish(delivery.id, {
            status: "SENT",
            nextAttemptAt: new Date(now.getTime() + EXPO_RECEIPT_DELAY_MS),
            lastError: "EXPO_RECEIPT_PENDING",
          });
        } else {
          await finish(delivery.id, {
            status: "DEAD",
            lastError:
              providerCode ??
              (typeof receipt?.message === "string"
                ? receipt.message.slice(0, 1000)
                : "EXPO_RECEIPT_UNAVAILABLE"),
          });
        }
      }
    } catch (error) {
      await Promise.all(
        batch.map((delivery) =>
          finish(delivery.id, {
            status: delivery.receiptAttempts >= MAX_RECEIPT_ATTEMPTS ? "DEAD" : "SENT",
            nextAttemptAt: new Date(now.getTime() + EXPO_RECEIPT_DELAY_MS),
            lastError: errorMessage(error),
          }),
        ),
      );
    }
  }
}

export async function processNotificationDeliveries(
  now = new Date(),
  limit = 100,
): Promise<{ claimed: number; delivered: number }> {
  const claimed = await claimDeliveries(now, false, limit);
  const eligible: ClaimedDelivery[] = [];
  for (const delivery of claimed) {
    if (!(await recipientStillEligible(delivery))) {
      await finish(delivery.id, { status: "DEAD", lastError: "RECIPIENT_NOT_ELIGIBLE" });
    } else if (delivery.channel === "EXPO" && !delivery.pushSubscription.token) {
      await finish(delivery.id, { status: "DEAD", lastError: "EXPO_TOKEN_MISSING" });
    } else {
      eligible.push(delivery);
    }
  }
  const web = eligible.filter((delivery) => delivery.channel === "WEB");
  const expo = eligible.filter((delivery) => delivery.channel === "EXPO");
  await Promise.all(web.map((delivery) => sendWeb(delivery, now)));
  if (expo.length) await sendExpo(expo, now);

  const receiptClaims = await claimDeliveries(now, true, limit);
  if (receiptClaims.length) await checkExpoReceipts(receiptClaims, now);
  const processedIds = Array.from(
    new Set([...claimed, ...receiptClaims].map((delivery) => delivery.id)),
  );
  const finalRows = processedIds.length
    ? await db.query.notificationDelivery.findMany({
        where: inArray(notificationDelivery.id, processedIds),
      })
    : [];
  const delivered = finalRows.filter((delivery) => delivery.status === "DELIVERED").length;
  return { claimed: claimed.length + receiptClaims.length, delivered };
}
