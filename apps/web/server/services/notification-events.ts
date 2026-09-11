import "server-only";
import { scheduleNotificationPush } from "./notification-service";
import { enqueueNotificationDeliveries } from "./notification-delivery";
import { db } from "@/db";
import { notification, project, role, rolePermission, tenantMember, user } from "@/db/schema";
import { INSTANCE_TENANT_ID } from "@/db/schema/tenant-constants";
import { ROLE_PERMISSIONS, getRoleDataScope } from "@atria/core/auth/permissions";
import { and, eq, like, ne, or } from "drizzle-orm";
import { notificationDestination } from "@atria/core/notifications/types";
import type { NotificationEvent } from "@atria/core/notifications/events";
export type NotificationTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type NotificationAudience = {
  users: (typeof user.$inferSelect)[];
  roles: (typeof role.$inferSelect & { permissions: (typeof rolePermission.$inferSelect)[] })[];
};
const audiences = new WeakMap<NotificationTransaction, Promise<NotificationAudience>>();
function getAudience(tx: NotificationTransaction): Promise<NotificationAudience> {
  const cached = audiences.get(tx);
  if (cached) return cached;
  const loaded = (async () => {
    const [memberRows, activeUsers, roles] = await Promise.all([
      tx
        .select({ memberRoleId: tenantMember.roleId, user })
        .from(tenantMember)
        .innerJoin(user, eq(user.id, tenantMember.userId))
        .where(
          and(
            eq(tenantMember.tenantId, INSTANCE_TENANT_ID),
            eq(tenantMember.isActive, true),
            eq(user.isActive, true),
          ),
        ),
      tx.query.user.findMany({
        where: eq(user.isActive, true),
      }),
      tx.query.role.findMany({ with: { permissions: true } }),
    ]);

    const userMap = new Map<string, typeof user.$inferSelect>();
    for (const u of activeUsers) {
      userMap.set(u.id, u);
    }
    for (const row of memberRows) {
      userMap.set(row.user.id, { ...row.user, roleId: row.memberRoleId });
    }

    return {
      users: Array.from(userMap.values()),
      roles,
    };
  })();
  audiences.set(tx, loaded);
  return loaded;
}

/** Invoked before committing the domain mutation. A failed insert rolls back together. */
export async function recordNotificationEvent(
  tx: NotificationTransaction,
  event: NotificationEvent,
): Promise<void> {
  const family = `${event.referenceType}:${event.referenceId}:${event.rule ?? "lifecycle"}:`;
  const eventKey = `${family}${event.stage}`;
  const projectRecord = event.projectId
    ? await tx.query.project.findFirst({
        where: and(eq(project.id, event.projectId), eq(project.tenantId, INSTANCE_TENANT_ID)),
      })
    : null;
  if (event.projectId && !projectRecord) return;
  const { users, roles } = await getAudience(tx);
  const selected = event.recipients ? new Set(event.recipients) : null;
  const candidates = selected ? users.filter((candidate) => selected.has(candidate.id)) : users;
  const recipients: typeof candidates = [];
  for (const candidate of candidates) {
    const role = roles.find((entry) => entry.id === candidate.roleId);
    const access = role
      ? {
          permissions: role.permissions.length
            ? role.permissions.map((entry) => entry.permissionKey)
            : (ROLE_PERMISSIONS[role.name.toUpperCase()] ?? []),
          dataScope: role.dataScope ?? getRoleDataScope(role.name),
        }
      : null;
    if (!access || (event.permission && !access.permissions.includes(event.permission))) continue;
    if (
      event.projectId &&
      access.dataScope !== "GLOBAL" &&
      !(access.dataScope === "ASSIGNED" && projectRecord?.projectManagerId === candidate.id)
    )
      continue;
    if (!event.actionRequired && candidate.id === event.actorId) continue;
    if (
      !event.actionRequired &&
      !event.recipients &&
      access.permissions.includes("decide:all_approvals")
    )
      continue;
    const delegatedPermission =
      event.permission &&
      ["verify:cost", "pay:cost", "pay:vendor_bill", "reconcile:client_invoice"].includes(
        event.permission,
      );
    if (
      delegatedPermission &&
      access.permissions.includes("decide:all_approvals") &&
      roles.some((entry) => {
        const permissions = entry.permissions.length
          ? entry.permissions.map((permission) => permission.permissionKey)
          : (ROLE_PERMISSIONS[entry.name.toUpperCase()] ?? []);
        return (
          permissions.includes(event.permission ?? "") &&
          !permissions.includes("decide:all_approvals") &&
          candidates.some(
            (person) =>
              person.roleId === entry.id &&
              (!event.projectId ||
                entry.dataScope === "GLOBAL" ||
                (entry.dataScope === "ASSIGNED" && projectRecord?.projectManagerId === person.id)),
          )
        );
      })
    )
      continue;
    recipients.push(candidate);
  }
  // All old stage actions are closed for everyone, even when their permissions changed.
  await tx
    .update(notification)
    .set({
      isResolved: true,
      resolvedAt: new Date(),
      resolvedById: event.actorId ?? null,
      read: true,
      readAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(notification.tenantId, INSTANCE_TENANT_ID),
        eq(notification.referenceType, event.referenceType),
        eq(notification.referenceId, event.referenceId),
        eq(notification.category, "ACTION_REQUIRED"),
        or(
          like(notification.eventKey, `${family}%`),
          event.rule
            ? undefined
            : like(notification.eventKey, `${event.referenceType}:${event.referenceId}:recovery:%`),
        ),
        ne(notification.eventKey, eventKey),
        eq(notification.isResolved, false),
      ),
    );
  if (!recipients.length) return;
  const inserted = await tx
    .insert(notification)
    .values(
      recipients.map((recipient) => ({
        tenantId: INSTANCE_TENANT_ID,
        userId: recipient.id,
        projectId: event.projectId ?? null,
        referenceType: event.referenceType,
        referenceId: event.referenceId,
        eventKey,
        title: event.title,
        message: event.message,
        category: event.actionRequired ? "ACTION_REQUIRED" : "INFORMATIONAL",
        severity: event.severity ?? "INFO",
        requiredPermission: event.permission ?? null,
        actionUrl: notificationDestination(event),
      })),
    )
    .onConflictDoNothing({
      target: [notification.tenantId, notification.userId, notification.eventKey],
    })
    .returning({ id: notification.id, userId: notification.userId });
  await enqueueNotificationDeliveries(tx, inserted);
  scheduleNotificationPush(inserted.map((row) => row.id));
}
