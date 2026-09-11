import "server-only";
import { and, eq, like } from "drizzle-orm";
import { notification, notificationCondition } from "@/db/schema";
import { INSTANCE_TENANT_ID } from "@/db/schema/tenant-constants";
import { recordNotificationEvent, type NotificationTransaction } from "./notification-events";
import type { NotificationEvent } from "@atria/core/notifications/events";

/** Row lock serializes recovery/re-entry and prevents concurrent scans duplicating events. */
export async function reconcileNotificationCondition(
  tx: NotificationTransaction,
  event: NotificationEvent,
  stage: string | null,
): Promise<boolean> {
  const key = `${event.referenceType}:${event.referenceId}:${event.rule ?? "condition"}`;
  await tx.insert(notificationCondition).values({ key }).onConflictDoNothing();
  const [previous] = await tx
    .select()
    .from(notificationCondition)
    .where(
      and(
        eq(notificationCondition.tenantId, INSTANCE_TENANT_ID),
        eq(notificationCondition.key, key),
      ),
    )
    .for("update");
  if (!previous || previous.stage === (stage ?? "")) return false;
  const revision = previous.revision + 1;
  await tx
    .update(notificationCondition)
    .set({ stage: stage ?? "", revision, updatedAt: new Date() })
    .where(eq(notificationCondition.id, previous.id));
  if (!stage) {
    await tx
      .update(notification)
      .set({
        isResolved: true,
        resolvedAt: new Date(),
        read: true,
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(notification.tenantId, INSTANCE_TENANT_ID),
          like(notification.eventKey, `${key}:%`),
          eq(notification.isResolved, false),
        ),
      );
  } else {
    await recordNotificationEvent(tx, {
      ...event,
      rule: event.rule ?? "condition",
      stage: `${revision}:${stage}`,
      actionRequired: true,
    });
  }
  return true;
}
