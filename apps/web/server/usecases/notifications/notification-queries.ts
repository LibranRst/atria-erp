import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/db";
import {
  notification,
  notificationCondition,
  userPushSubscription,
  project,
  projectCost,
  vendorBill,
  vendorPayment,
  clientInvoice,
  clientPayment,
  projectBudgets,
  projectBudget,
  projectRap,
  rabEstimate,
  goodsReceipt,
  inventoryOpeningBatch,
  materialMaster,
  projectChangeOrder,
  stockCount,
  stockMovement,
} from "@/db/schema";
import { INSTANCE_TENANT_ID } from "@/db/schema/tenant-constants";
import type { Actor } from "@/server/actor";
import { and, or, eq, gte, isNull, desc, asc, lt, inArray, count, type SQL } from "drizzle-orm";
import {
  notificationDestination,
  normalizeNotificationReferenceType,
  type NotificationCategory,
  type NotificationItem,
  type NotificationSummary,
  type NotificationListInput,
  type NotificationPage,
  type RegisterPushTokenInput,
  type UnregisterPushTokenInput,
} from "@atria/core/notifications/types";
import { INFORMATIONAL_READ_RETENTION_MS } from "@atria/core/notifications/retention";

function eligible(actor: Actor): SQL | undefined {
  const cutoff = new Date(Date.now() - INFORMATIONAL_READ_RETENTION_MS);
  const projects = db
    .select({ id: project.id })
    .from(project)
    .where(
      and(
        eq(project.tenantId, INSTANCE_TENANT_ID),
        actor.dataScope === "GLOBAL" ? undefined : eq(project.projectManagerId, actor.userId),
      ),
    );
  return and(
    eq(notification.tenantId, INSTANCE_TENANT_ID),
    eq(notification.userId, actor.userId),
    actor.dataScope === "NONE"
      ? isNull(notification.projectId)
      : or(isNull(notification.projectId), inArray(notification.projectId, projects)),
    or(
      isNull(notification.requiredPermission),
      inArray(notification.requiredPermission, [...actor.permissions]),
    ),
    or(
      and(
        eq(notification.category, "ACTION_REQUIRED"),
        or(
          eq(notification.isResolved, false),
          gte(notification.resolvedAt, cutoff),
          and(isNull(notification.resolvedAt), gte(notification.createdAt, cutoff)),
        ),
      ),
      and(
        eq(notification.category, "INFORMATIONAL"),
        or(
          eq(notification.read, false),
          gte(notification.readAt, cutoff),
          and(isNull(notification.readAt), gte(notification.createdAt, cutoff)),
        ),
      ),
    ),
  );
}
function toItem(row: typeof notification.$inferSelect): NotificationItem {
  return {
    ...row,
    severity:
      row.severity === "CRITICAL" ? "CRITICAL" : row.severity === "WARNING" ? "WARNING" : "INFO",
    category: row.category === "ACTION_REQUIRED" ? "ACTION_REQUIRED" : "INFORMATIONAL",
    referenceType: normalizeNotificationReferenceType(row.referenceType),
    readAt: row.readAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    actionUrl: notificationDestination(row),
  };
}

/**
 * Cheap invalidation cursor for the SSE stream. Every notification mutation
 * advances `updatedAt`; the compound recipient index keeps this lookup bounded.
 */
export async function getNotificationStreamCursor(actor: Actor): Promise<string> {
  const [latestRows, scopedProjects] = await Promise.all([
    db
      .select({ id: notification.id, updatedAt: notification.updatedAt })
      .from(notification)
      .where(eligible(actor))
      .orderBy(desc(notification.updatedAt), desc(notification.id))
      .limit(1),
    actor.dataScope === "ASSIGNED"
      ? db
          .select({ id: project.id })
          .from(project)
          .where(
            and(
              eq(project.tenantId, INSTANCE_TENANT_ID),
              eq(project.projectManagerId, actor.userId),
            ),
          )
          .orderBy(asc(project.id))
      : Promise.resolve([]),
  ]);
  const latest = latestRows[0];
  const scopeSignature = createHash("sha256")
    .update(
      actor.dataScope === "ASSIGNED"
        ? scopedProjects.map((row) => row.id).join(",")
        : actor.dataScope,
    )
    .digest("base64url")
    .slice(0, 16);
  return `${latest ? `${latest.updatedAt.getTime()}.${latest.id}` : "empty"}.${scopeSignature}`;
}

export async function getNotificationSummary(actor: Actor): Promise<NotificationSummary> {
  const groups = await db
    .select({
      category: notification.category,
      read: notification.read,
      resolved: notification.isResolved,
      value: count(),
    })
    .from(notification)
    .where(eligible(actor))
    .groupBy(notification.category, notification.read, notification.isResolved);
  return {
    unreadCount: groups.reduce((total, group) => total + (group.read ? 0 : group.value), 0),
    actionRequiredCount: groups.reduce(
      (total, group) =>
        total + (group.category === "ACTION_REQUIRED" && !group.resolved ? group.value : 0),
      0,
    ),
    informationalUnreadCount: groups.reduce(
      (total, group) =>
        total + (group.category === "INFORMATIONAL" && !group.read ? group.value : 0),
      0,
    ),
    items: [],
  };
}
export async function getNotificationPage(
  actor: Actor,
  input: NotificationListInput,
): Promise<NotificationPage> {
  const cursor = input.cursor;
  const after = cursor
    ? or(
        cursor.resolved ? undefined : eq(notification.isResolved, true),
        and(
          eq(notification.isResolved, cursor.resolved),
          or(
            lt(notification.createdAt, new Date(cursor.createdAt)),
            and(
              eq(notification.createdAt, new Date(cursor.createdAt)),
              lt(notification.id, cursor.id),
            ),
          ),
        ),
      )
    : undefined;
  const rows = await db
    .select()
    .from(notification)
    .where(and(eligible(actor), eq(notification.category, input.category), after))
    .orderBy(asc(notification.isResolved), desc(notification.createdAt), desc(notification.id))
    .limit(21);
  const hasMore = rows.length > 20;
  const page = rows.slice(0, 20);
  const last = page.at(-1);
  return {
    items: page.map(toItem),
    hasMore,
    nextCursor:
      hasMore && last
        ? { id: last.id, createdAt: last.createdAt.toISOString(), resolved: last.isResolved }
        : null,
  };
}
export async function markNotificationAsRead(
  id: string,
  actor: Actor,
): Promise<{ success: boolean }> {
  await db
    .update(notification)
    .set({ read: true, readAt: new Date(), updatedAt: new Date() })
    .where(and(eligible(actor), eq(notification.id, id), eq(notification.read, false)));
  return { success: true };
}
export async function markAllNotificationsAsRead(
  actor: Actor,
  category?: NotificationCategory,
): Promise<{ success: boolean }> {
  await db
    .update(notification)
    .set({ read: true, readAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eligible(actor),
        eq(notification.read, false),
        category ? eq(notification.category, category) : undefined,
      ),
    );
  return { success: true };
}

export async function registerPushSubscription(
  input: RegisterPushTokenInput,
  userId: string,
  sessionId?: string,
  tenantId?: string,
): Promise<{ success: boolean }> {
  const credential = input.platform === "WEB" ? input.endpoint : input.token;
  if (!credential) throw new Error("PUSH_CREDENTIAL_REQUIRED");
  const scope = tenantId ?? INSTANCE_TENANT_ID;
  const key = `push-registration:${createHash("sha256").update(credential).digest("hex")}`;
  await db.transaction(async (tx) => {
    await tx.insert(notificationCondition).values({ tenantId: scope, key }).onConflictDoNothing();
    await tx
      .select({ id: notificationCondition.id })
      .from(notificationCondition)
      .where(and(eq(notificationCondition.tenantId, scope), eq(notificationCondition.key, key)))
      .for("update");
    const match = and(
      eq(userPushSubscription.tenantId, scope),
      input.platform === "WEB"
        ? eq(userPushSubscription.endpoint, credential)
        : eq(userPushSubscription.token, credential),
    );
    const existing = await tx.query.userPushSubscription.findMany({
      where: match,
      orderBy: [desc(userPushSubscription.updatedAt)],
    });
    const values = {
      tenantId: scope,
      userId,
      sessionId: sessionId || null,
      platform: input.platform,
      token: input.platform === "WEB" ? null : credential,
      endpoint: input.platform === "WEB" ? credential : null,
      p256dh: input.p256dh ?? null,
      auth: input.auth ?? null,
      userAgent: input.userAgent ?? null,
      updatedAt: new Date(),
    };
    // A shared device belongs to the currently authenticated registrant. Retire duplicate
    // credentials without deleting history or leaving the previous account subscribed.
    for (const stale of existing.slice(1))
      await tx
        .update(userPushSubscription)
        .set({ token: null, endpoint: null, p256dh: null, auth: null, updatedAt: new Date() })
        .where(eq(userPushSubscription.id, stale.id));
    if (existing[0])
      await tx
        .update(userPushSubscription)
        .set(values)
        .where(eq(userPushSubscription.id, existing[0].id));
    else await tx.insert(userPushSubscription).values(values);
  });
  return { success: true };
}

export async function unregisterPushSubscription(
  input: UnregisterPushTokenInput,
  userId: string,
): Promise<{ success: boolean }> {
  const credential = input.platform === "WEB" ? input.endpoint : input.token;
  if (!credential) return { success: true };
  await db
    .update(userPushSubscription)
    .set({ token: null, endpoint: null, p256dh: null, auth: null, updatedAt: new Date() })
    .where(
      and(
        eq(userPushSubscription.tenantId, INSTANCE_TENANT_ID),
        eq(userPushSubscription.userId, userId),
        eq(userPushSubscription.platform, input.platform),
        input.platform === "WEB"
          ? eq(userPushSubscription.endpoint, credential)
          : eq(userPushSubscription.token, credential),
      ),
    );
  return { success: true };
}

export async function getNotificationDestination(actor: Actor, id: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(notification)
    .where(and(eligible(actor), eq(notification.id, id)))
    .limit(1);
  if (!row) return null;
  const tables = {
    project: project,
    project_cost: projectCost,
    vendor_bill: vendorBill,
    vendor_payment: vendorPayment,
    client_invoice: clientInvoice,
    client_payment: clientPayment,
    rap: projectRap,
    rab: rabEstimate,
    goods_receipt: goodsReceipt,
    inventory_opening: inventoryOpeningBatch,
    goods_receipt_reversal: goodsReceipt,
    material: materialMaster,
    change_order: projectChangeOrder,
    stock_count: stockCount,
    stock_movement: stockMovement,
  };
  // System notifications are already scoped to the authenticated recipient and
  // tenant by `eligible()`. They intentionally navigate to a safe internal
  // workspace without requiring a separate business-entity row.
  if (row.referenceType === "system") return notificationDestination(row);
  if (row.referenceType === "project_budget" && row.referenceId) {
    const canonical = await db
      .select({ id: projectBudgets.id })
      .from(projectBudgets)
      .where(
        and(
          eq(projectBudgets.id, row.referenceId),
          eq(projectBudgets.tenantId, INSTANCE_TENANT_ID),
        ),
      )
      .limit(1);
    if (canonical.length) return notificationDestination(row);
    const legacy = await db
      .select({ id: projectBudget.id })
      .from(projectBudget)
      .where(
        and(eq(projectBudget.id, row.referenceId), eq(projectBudget.tenantId, INSTANCE_TENANT_ID)),
      )
      .limit(1);
    return legacy.length ? notificationDestination(row) : null;
  }
  const entry = Object.entries(tables).find(([key]) => key === row.referenceType);
  if (!entry || !row.referenceId) return null;
  const table = entry[1];
  const found = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, row.referenceId), eq(table.tenantId, INSTANCE_TENANT_ID)))
    .limit(1);
  return found.length ? notificationDestination(row) : null;
}
