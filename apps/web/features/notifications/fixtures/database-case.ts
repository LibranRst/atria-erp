import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { generateDrizzleJson, generateMigration, type DrizzleSnapshotJSON } from "drizzle-kit/api";
import { mock, expect } from "bun:test";
import * as schema from "@/db/schema";
import { ANDROID_NOTIFICATION_CHANNEL_ID } from "@atria/core/notifications/types";
import { eq } from "drizzle-orm";
const client = new PGlite();
const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema));
await client.exec(statements.join(";\n"));
const database = drizzle(client, { schema });
mock.module("@/db", () => ({ db: database }));
mock.module("@/server/services/notification-service", () => ({
  scheduleNotificationPush: () => undefined,
}));
let webPushMode: "success" | "expired" = "success";
let webPushCalls = 0;
const sendWebPush = async (): Promise<void> => {
  webPushCalls += 1;
  if (webPushMode === "expired") {
    throw Object.assign(new Error("expired"), { statusCode: 410 });
  }
};
mock.module("web-push", () => ({
  default: { sendNotification: sendWebPush },
  sendNotification: sendWebPush,
}));
const {
  registerPushSubscription,
  getNotificationSummary,
  getNotificationPage,
  getNotificationDestination,
  getNotificationStreamCursor,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = await import("@/server/usecases/notifications/notification-queries");
const { recordNotificationEvent } = await import("@/server/services/notification-events");
const { reconcileNotificationCondition } =
  await import("@/server/services/notification-conditions");
const tenantId = schema.INSTANCE_TENANT_ID;
const ownerId = crypto.randomUUID();
const otherId = crypto.randomUUID();
const roleId = crypto.randomUUID();
await database.insert(schema.tenant).values({ id: tenantId, name: "Test", slug: "test" });
await database.insert(schema.role).values({ id: roleId, name: "OWNER", dataScope: "GLOBAL" });
await database.insert(schema.rolePermission).values(
  ["verify:cost", "decide:all_approvals", "approve:opening_inventory"].map((permissionKey) => ({
    roleId,
    permissionKey,
  })),
);
await database.insert(schema.user).values([
  { id: ownerId, name: "Owner test", email: "owner@test.local", roleId },
  { id: otherId, name: "Other test", email: "other@test.local", roleId },
]);
await database.insert(schema.tenantMember).values([
  { tenantId, userId: ownerId, roleId },
  { tenantId, userId: otherId, roleId },
]);
const actor = {
  userId: ownerId,
  roleId,
  roleName: "OWNER",
  name: "Test",
  email: "owner@test.local",
  isActive: true,
  mustChangePassword: false,
  sessionId: "test",
  permissions: [
    "view:budget",
    "verify:cost",
    "decide:all_approvals",
    "approve:opening_inventory",
  ] as const,
  dataScope: "GLOBAL" as const,
  developerActorUserId: null,
};
const date = new Date();
await database.insert(schema.notification).values(
  Array.from({ length: 125 }, () => ({
    userId: ownerId,
    title: "Test",
    message: "Test",
    category: "ACTION_REQUIRED",
    createdAt: date,
  })),
);
expect((await getNotificationSummary(actor)).unreadCount).toBe(125);
let page = await getNotificationPage(actor, { category: "ACTION_REQUIRED" });
const ids = new Set(page.items.map((item) => item.id));
while (page.nextCursor) {
  page = await getNotificationPage(actor, { category: "ACTION_REQUIRED", cursor: page.nextCursor });
  page.items.forEach((item) => {
    expect(ids.has(item.id)).toBe(false);
    ids.add(item.id);
  });
}
expect(ids.size).toBe(125);
const id = [...ids][0];
await markNotificationAsRead(id, { ...actor, userId: otherId });
expect((await getNotificationSummary(actor)).unreadCount).toBe(125);
const cursorBeforeRead = await getNotificationStreamCursor(actor);
await new Promise((resolve) => setTimeout(resolve, 2));
await markNotificationAsRead(id, actor);
const cursorAfterRead = await getNotificationStreamCursor(actor);
expect(cursorAfterRead).not.toBe(cursorBeforeRead);
expect((await getNotificationSummary(actor)).unreadCount).toBe(124);
expect((await getNotificationSummary(actor)).actionRequiredCount).toBe(125);
await markAllNotificationsAsRead(actor, "ACTION_REQUIRED");
expect((await getNotificationSummary(actor)).unreadCount).toBe(0);
expect((await getNotificationSummary(actor)).actionRequiredCount).toBe(125);
const openingId = crypto.randomUUID();
const openingNotificationId = crypto.randomUUID();
const systemNotificationId = crypto.randomUUID();
await database.insert(schema.inventoryOpeningBatch).values({
  id: openingId,
  batchNumber: "OPEN-NAV-1",
  cutoverDate: new Date(),
  note: "Navigation regression fixture",
  requestedById: otherId,
});
await database.insert(schema.notification).values([
  {
    id: openingNotificationId,
    userId: ownerId,
    title: "Opening",
    message: "Review",
    category: "ACTION_REQUIRED",
    referenceType: "inventory_opening",
    referenceId: openingId,
    requiredPermission: "approve:opening_inventory",
    actionUrl: "/approvals",
  },
  {
    id: systemNotificationId,
    userId: ownerId,
    title: "System",
    message: "Ledger ready",
    category: "INFORMATIONAL",
    referenceType: "system",
    referenceId: tenantId,
    actionUrl: "/ledger",
  },
]);
expect(await getNotificationDestination(actor, openingNotificationId)).toBe("/approvals");
expect(await getNotificationDestination(actor, systemNotificationId)).toBe("/ledger");
mock.module("@/server/actor", () => ({ resolveActorFromHeaders: async () => actor }));
const { GET: openNotificationStream } = await import("@/app/api/notifications/stream/route");
const streamResponse = await openNotificationStream(
  new Request("http://localhost/api/notifications/stream"),
);
expect(streamResponse.status).toBe(200);
expect(streamResponse.headers.get("content-type")).toContain("text/event-stream");
const streamReader = streamResponse.body?.getReader();
expect(streamReader).toBeDefined();
const streamDecoder = new TextDecoder();
let streamed = "";
while (!streamed.includes("event: invalidate")) {
  const chunk = await streamReader?.read();
  if (!chunk || chunk.done) break;
  streamed += streamDecoder.decode(chunk.value, { stream: true });
}
await streamReader?.cancel();
expect(streamed).toContain("retry: 1500");
expect(streamed).toContain("event: session");
expect(streamed).toContain("event: invalidate");
expect(streamed).toContain("id: ");
// Driver conversion is confined to this third-party integration boundary.
type Tx = Parameters<typeof recordNotificationEvent>[0];
const referenceId = crypto.randomUUID();
const event = {
  referenceType: "project_cost" as const,
  referenceId,
  stage: "SUBMITTED",
  title: "Verify",
  message: "Test",
  permission: "verify:cost" as const,
  actionRequired: true,
  actionUrl: "/approvals",
};
await database.transaction(async (tx) => {
  await recordNotificationEvent(tx as unknown as Tx, event);
  await recordNotificationEvent(tx as unknown as Tx, event);
});
let rows = await database
  .select()
  .from(schema.notification)
  .where(eq(schema.notification.referenceId, referenceId));
expect(rows.length).toBe(2);
expect(rows.every((row) => !row.isResolved)).toBe(true);
await database.transaction(async (tx) => {
  await recordNotificationEvent(tx as unknown as Tx, {
    ...event,
    stage: "VERIFIED",
    permission: "decide:all_approvals",
  });
});
rows = await database
  .select()
  .from(schema.notification)
  .where(eq(schema.notification.referenceId, referenceId));
expect(rows.filter((row) => !row.isResolved).length).toBe(2);
// Revoke-all harus menghentikan audience berbasis izin, termasuk role bawaan.
await database.delete(schema.rolePermission).where(eq(schema.rolePermission.roleId, roleId));
const revokedReferenceId = crypto.randomUUID();
await database.transaction(async (tx) => {
  await recordNotificationEvent(tx as unknown as Tx, { ...event, referenceId: revokedReferenceId });
});
expect(
  await database
    .select()
    .from(schema.notification)
    .where(eq(schema.notification.referenceId, revokedReferenceId)),
).toEqual([]);
await database.insert(schema.rolePermission).values(
  ["verify:cost", "decide:all_approvals", "approve:opening_inventory"].map((permissionKey) => ({
    roleId,
    permissionKey,
  })),
);
const rollbackId = crypto.randomUUID();
try {
  await database.transaction(async (tx) => {
    await recordNotificationEvent(tx as unknown as Tx, { ...event, referenceId: rollbackId });
    throw new Error("rollback");
  });
} catch {
  /* expected */
}
expect(
  (
    await database
      .select()
      .from(schema.notification)
      .where(eq(schema.notification.referenceId, rollbackId))
  ).length,
).toBe(0);
const condition = { ...event, referenceId: crypto.randomUUID(), rule: "due" };
for (const stage of ["UPCOMING", "UPCOMING", "DUE", null, "UPCOMING"])
  await database.transaction(async (tx) => {
    await reconcileNotificationCondition(tx as unknown as Tx, condition, stage);
  });
rows = await database
  .select()
  .from(schema.notification)
  .where(eq(schema.notification.referenceId, condition.referenceId));
expect(rows.length).toBe(6);
expect(rows.filter((row) => !row.isResolved).length).toBe(2);
const clientId = crypto.randomUUID();
await database
  .insert(schema.client)
  .values({ id: clientId, name: "Client", email: "client@test.local", phone: "000" });
const assignedProjectId = crypto.randomUUID();
const hiddenProjectId = crypto.randomUUID();
await database.insert(schema.project).values([
  {
    id: assignedProjectId,
    name: "Assigned",
    clientId,
    projectManagerId: ownerId,
    status: "ACTIVE",
    totalContractValue: "100",
  },
  {
    id: hiddenProjectId,
    name: "Hidden",
    clientId,
    projectManagerId: otherId,
    status: "ACTIVE",
    totalContractValue: "100",
  },
]);
const scopedIds = [crypto.randomUUID(), crypto.randomUUID()];
await database.insert(schema.notification).values(
  scopedIds.map((id, index) => ({
    id,
    userId: ownerId,
    title: "Private",
    message: "Budget",
    category: "INFORMATIONAL",
    projectId: index === 0 ? assignedProjectId : hiddenProjectId,
    requiredPermission: "view:budget",
  })),
);
const assignedActor = { ...actor, dataScope: "ASSIGNED" as const };
const assignedPage = await getNotificationPage(assignedActor, { category: "INFORMATIONAL" });
expect(assignedPage.items.some((row) => row.id === scopedIds[0])).toBe(true);
expect(assignedPage.items.some((row) => row.id === scopedIds[1])).toBe(false);
expect(
  (
    await getNotificationPage({ ...assignedActor, permissions: [] }, { category: "INFORMATIONAL" })
  ).items.some((row) => scopedIds.includes(row.id)),
).toBe(false);
const scopeCursorBefore = await getNotificationStreamCursor(assignedActor);
await database
  .update(schema.project)
  .set({ projectManagerId: otherId })
  .where(eq(schema.project.id, assignedProjectId));
const scopeCursorAfter = await getNotificationStreamCursor(assignedActor);
expect(scopeCursorAfter).not.toBe(scopeCursorBefore);
expect(
  (await getNotificationPage(assignedActor, { category: "INFORMATIONAL" })).items.some((row) =>
    scopedIds.includes(row.id),
  ),
).toBe(false);
const { runNotificationJob } = await import("@/server/services/notification-job");
const vendorId = crypto.randomUUID();
const budgetId = crypto.randomUUID();
const categoryId = crypto.randomUUID();
const expenseCategoryId = crypto.randomUUID();
await database.insert(schema.vendor).values({ id: vendorId, name: "Supplier", phone: "000" });
await database
  .insert(schema.expenseCategory)
  .values({ id: expenseCategoryId, code: "MATERIAL", name: "Material" });
await database.insert(schema.projectBudgets).values({
  id: budgetId,
  projectId: assignedProjectId,
  contractValue: "1000",
  internalBudget: "900",
  status: "APPROVED",
});
await database
  .insert(schema.projectBudgetCategory)
  .values({ id: categoryId, projectBudgetId: budgetId, expenseCategoryId });
const billId = crypto.randomUUID();
const invoiceId = crypto.randomUUID();
const due = new Date("2026-09-08T00:00:00+07:00");
await database.insert(schema.vendorBill).values({
  id: billId,
  vendorId,
  projectId: assignedProjectId,
  projectBudgetCategoryId: categoryId,
  billNumber: "TEST-1",
  amount: "100",
  status: "UNPAID",
  dueDate: due,
});
await database.insert(schema.clientInvoice).values({
  id: invoiceId,
  projectId: assignedProjectId,
  invoiceNumber: "TEST-1",
  amount: "100",
  status: "UNPAID",
  stage: "DP",
  dueDate: due,
});
await database.insert(schema.notificationCondition).values({ key: "scheduler" });
await runNotificationJob(new Date("2026-09-05T00:00:00+07:00"));
const firstRun = await database.select().from(schema.notification);
await runNotificationJob(new Date("2026-09-05T12:00:00+07:00"));
expect((await database.select().from(schema.notification)).length).toBe(firstRun.length);
await runNotificationJob(new Date("2026-09-09T00:00:00+07:00"));
expect(
  (
    await database
      .select()
      .from(schema.notification)
      .where(eq(schema.notification.referenceId, invoiceId))
  )
    .filter((row) => !row.isResolved)
    .every((row) => row.severity === "CRITICAL"),
).toBe(true);
await database
  .update(schema.vendorBill)
  .set({ status: "PAID" })
  .where(eq(schema.vendorBill.id, billId));
await database
  .update(schema.clientInvoice)
  .set({ status: "PAID" })
  .where(eq(schema.clientInvoice.id, invoiceId));
await runNotificationJob(new Date("2026-09-10T00:00:00+07:00"));
expect(
  (
    await database
      .select()
      .from(schema.notification)
      .where(eq(schema.notification.referenceId, invoiceId))
  ).every((row) => row.isResolved),
).toBe(true);
expect(
  (
    await database
      .select()
      .from(schema.notification)
      .where(eq(schema.notification.referenceId, billId))
  ).every((row) => row.isResolved),
).toBe(true);
const ownerPushSessionId = "owner-push-session";
const otherPushSessionId = "other-push-session";
await database.insert(schema.session).values([
  {
    id: ownerPushSessionId,
    token: "owner-push-session-token",
    userId: ownerId,
    expiresAt: new Date("2027-01-01T00:00:00Z"),
  },
  {
    id: otherPushSessionId,
    token: "other-push-session-token",
    userId: otherId,
    expiresAt: new Date("2027-01-01T00:00:00Z"),
  },
]);
await registerPushSubscription(
  { platform: "EXPO_IOS", token: "ExpoPushToken[testdevice]" },
  ownerId,
  ownerPushSessionId,
);
await registerPushSubscription(
  { platform: "EXPO_IOS", token: "ExpoPushToken[testdevice]" },
  otherId,
  otherPushSessionId,
);
const subscriptions = await database
  .select()
  .from(schema.userPushSubscription)
  .where(eq(schema.userPushSubscription.token, "ExpoPushToken[testdevice]"));
expect(subscriptions.length).toBe(1);
expect(subscriptions[0].userId).toBe(otherId);
// Klien web mendaftarkan ulang langganan yang sudah ada setiap kali halaman
// notifikasi dibuka (rekonsiliasi). Pendaftaran harus tetap satu baris dan
// memperbarui kredensial yang berubah, bukan menumpuk baris baru.
const reconciledEndpoint = "https://push.example.test/reconciled";
await registerPushSubscription(
  { platform: "WEB", endpoint: reconciledEndpoint, p256dh: "old-key", auth: "old-auth" },
  ownerId,
  ownerPushSessionId,
);
await registerPushSubscription(
  { platform: "WEB", endpoint: reconciledEndpoint, p256dh: "new-key", auth: "new-auth" },
  ownerId,
  ownerPushSessionId,
);
const reconciledRows = await database
  .select()
  .from(schema.userPushSubscription)
  .where(eq(schema.userPushSubscription.endpoint, reconciledEndpoint));
expect(reconciledRows.length).toBe(1);
expect(reconciledRows[0].p256dh).toBe("new-key");
expect(reconciledRows[0].userId).toBe(ownerId);
// Baris uji di atas dipensiunkan lagi supaya jumlah pengiriman pada skenario
// berikutnya tetap sama seperti sebelumnya.
await database
  .update(schema.userPushSubscription)
  .set({ token: null, endpoint: null, p256dh: null, auth: null })
  .where(eq(schema.userPushSubscription.id, reconciledRows[0].id));
const pushReferenceId = crypto.randomUUID();
await database.transaction(async (tx) => {
  await recordNotificationEvent(tx as unknown as Tx, {
    referenceType: "system",
    referenceId: pushReferenceId,
    stage: "PUSH_TEST",
    title: "Push test",
    message: "Delivery outbox",
    recipients: [otherId],
    actionRequired: true,
    actionUrl: "/notifications",
  });
});
let deliveries = await database.select().from(schema.notificationDelivery);
expect(deliveries).toHaveLength(1);
expect(deliveries[0].status).toBe("PENDING");
const originalFetch = globalThis.fetch;
let expoPushBody: unknown = null;
type ExpoPushMessage = {
  readonly to: string;
  readonly title: string;
  readonly body: string;
  readonly data: { readonly notificationId: string; readonly url: string | null };
  readonly sound: string;
  readonly channelId?: string;
};
let expoPushMessages: readonly ExpoPushMessage[] = [];
globalThis.fetch = (async (
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.endsWith("/push/send")) {
    const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : [];
    expoPushMessages = Array.isArray(body) ? (body as ExpoPushMessage[]) : [];
    expoPushBody = body;
    // Expo mengembalikan satu tiket per pesan; jumlah yang berbeda membuat
    // pengiriman dianggap gagal, jadi balasannya mengikuti panjang batch.
    return Response.json({
      data: expoPushMessages.map((_, index) => ({ status: "ok", id: `expo-ticket-${index}` })),
    });
  }
  if (url.endsWith("/push/getReceipts")) {
    const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : {};
    const ids = typeof body === "object" && body !== null && "ids" in body ? body.ids : [];
    const data: Record<string, { status: string }> = {};
    if (Array.isArray(ids)) for (const id of ids) data[String(id)] = { status: "ok" };
    return Response.json({ data });
  }
  return originalFetch(input, init);
}) as typeof fetch;
const { processNotificationDeliveries } = await import("@/server/services/notification-delivery");
const pushSentAt = new Date(deliveries[0].nextAttemptAt.getTime() + 60_000);
await processNotificationDeliveries(pushSentAt);
deliveries = await database.select().from(schema.notificationDelivery);
expect(deliveries[0].status).toBe("SENT");
expect(deliveries[0].providerTicketId).toBe("expo-ticket-0");
// iOS tidak mengenal `channelId`; payload-nya harus tetap seperti semula.
expect(expoPushBody).toEqual([
  {
    to: "ExpoPushToken[testdevice]",
    title: "Push test",
    body: "Delivery outbox",
    data: { notificationId: deliveries[0].notificationId, url: "/notifications" },
    sound: "default",
  },
]);
await processNotificationDeliveries(new Date(pushSentAt.getTime() + 15 * 60_000));
deliveries = await database.select().from(schema.notificationDelivery);
expect(deliveries[0].status).toBe("DELIVERED");
expect(deliveries[0].deliveredAt).toBeInstanceOf(Date);
// Perangkat Android harus menerima `channelId`; tanpa itu Android 8+ memakai
// kanal cadangan library dan banner kehilangan nama serta prioritasnya.
await registerPushSubscription(
  { platform: "EXPO_ANDROID", token: "ExpoPushToken[androiddevice]" },
  otherId,
  otherPushSessionId,
);
const androidNotificationId = crypto.randomUUID();
await database.transaction(async (tx) => {
  await recordNotificationEvent(tx as unknown as Tx, {
    referenceType: "system",
    referenceId: androidNotificationId,
    stage: "ANDROID_CHANNEL_TEST",
    title: "Push android",
    message: "Kanal operasional",
    recipients: [otherId],
    actionRequired: true,
    actionUrl: "/approvals",
  });
});
expoPushBody = null;
await processNotificationDeliveries(new Date(pushSentAt.getTime() + 16 * 60_000));
const androidMessage = expoPushMessages.find(
  (message) => message.to === "ExpoPushToken[androiddevice]",
);
expect(androidMessage).toEqual({
  to: "ExpoPushToken[androiddevice]",
  title: "Push android",
  body: "Kanal operasional",
  data: { notificationId: expect.any(String), url: "/approvals" },
  sound: "default",
  channelId: ANDROID_NOTIFICATION_CHANNEL_ID,
});
globalThis.fetch = originalFetch;
const previousWebPushPublicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
const previousWebPushPrivateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
const previousWebPushSubject = process.env.WEB_PUSH_SUBJECT;
process.env.WEB_PUSH_VAPID_PUBLIC_KEY = "test-public";
process.env.WEB_PUSH_VAPID_PRIVATE_KEY = "test-private";
process.env.WEB_PUSH_SUBJECT = "mailto:test@example.test";
await registerPushSubscription(
  {
    platform: "WEB",
    endpoint: "https://push.example.test/active",
    p256dh: "p256dh",
    auth: "auth",
  },
  ownerId,
  ownerPushSessionId,
);
await database.transaction(async (tx) => {
  await recordNotificationEvent(tx as unknown as Tx, {
    referenceType: "system",
    referenceId: crypto.randomUUID(),
    stage: "WEB_PUSH_TEST",
    title: "Web push",
    message: "Active endpoint",
    recipients: [ownerId],
    actionRequired: true,
    actionUrl: "/notifications",
  });
});
await processNotificationDeliveries(new Date(pushSentAt.getTime() + 20 * 60_000));
let webDeliveries = await database
  .select()
  .from(schema.notificationDelivery)
  .where(eq(schema.notificationDelivery.channel, "WEB"));
expect(webPushCalls).toBe(1);
expect(webDeliveries[0].status).toBe("DELIVERED");
webPushMode = "expired";
await database.transaction(async (tx) => {
  await recordNotificationEvent(tx as unknown as Tx, {
    referenceType: "system",
    referenceId: crypto.randomUUID(),
    stage: "WEB_PUSH_EXPIRED_TEST",
    title: "Web push",
    message: "Expired endpoint",
    recipients: [ownerId],
    actionRequired: true,
    actionUrl: "/notifications",
  });
});
await processNotificationDeliveries(new Date(pushSentAt.getTime() + 21 * 60_000));
webDeliveries = await database
  .select()
  .from(schema.notificationDelivery)
  .where(eq(schema.notificationDelivery.channel, "WEB"));
expect(webDeliveries.some((row) => row.status === "DEAD")).toBe(true);
expect(
  (
    await database
      .select()
      .from(schema.userPushSubscription)
      .where(eq(schema.userPushSubscription.platform, "WEB"))
  )[0].endpoint,
).toBeNull();
await database.delete(schema.session).where(eq(schema.session.id, ownerPushSessionId));
expect(
  await database
    .select()
    .from(schema.userPushSubscription)
    .where(eq(schema.userPushSubscription.sessionId, ownerPushSessionId)),
).toEqual([]);
if (previousWebPushPublicKey) process.env.WEB_PUSH_VAPID_PUBLIC_KEY = previousWebPushPublicKey;
else delete process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
if (previousWebPushPrivateKey) process.env.WEB_PUSH_VAPID_PRIVATE_KEY = previousWebPushPrivateKey;
else delete process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
if (previousWebPushSubject) process.env.WEB_PUSH_SUBJECT = previousWebPushSubject;
else delete process.env.WEB_PUSH_SUBJECT;
const previousCronSecret = process.env.CRON_SECRET;
process.env.CRON_SECRET = "notification-cron-test-secret";
const notificationWorkerRoute = await import("@/app/api/internal/notifications/route");
expect(
  (
    await notificationWorkerRoute.GET(
      new Request("http://localhost/api/internal/notifications?task=unknown", {
        headers: { authorization: "Bearer notification-cron-test-secret" },
      }),
    )
  ).status,
).toBe(400);
expect(
  (
    await notificationWorkerRoute.GET(
      new Request("http://localhost/api/internal/notifications?task=deliveries", {
        headers: { authorization: "Bearer notification-cron-test-secret" },
      }),
    )
  ).status,
).toBe(200);
expect(
  (
    await notificationWorkerRoute.POST(
      new Request("http://localhost/api/internal/notifications", {
        headers: { authorization: "Bearer wrong" },
      }),
    )
  ).status,
).toBe(401);
if (previousCronSecret) process.env.CRON_SECRET = previousCronSecret;
else delete process.env.CRON_SECRET;
await client.close();
// Apply the actual additive migration against its preceding schema snapshot.
const previousSnapshot = JSON.parse(
  await Bun.file(new URL("../../../drizzle/meta/0037_snapshot.json", import.meta.url)).text(),
) as DrizzleSnapshotJSON;
const migrationClient = new PGlite();
await migrationClient.exec(
  (await generateMigration(generateDrizzleJson({}), previousSnapshot)).join(";\n"),
);
const oldDatabase = drizzle(migrationClient, { schema });
await oldDatabase.insert(schema.tenant).values({ id: tenantId, name: "Test", slug: "test" });
await oldDatabase.insert(schema.role).values({ id: roleId, name: "OWNER", dataScope: "GLOBAL" });
await oldDatabase
  .insert(schema.user)
  .values({ id: ownerId, name: "Test", email: "test@test.local", roleId });
const legacyTime = "2026-01-01T00:00:00Z";
await migrationClient.query(
  "INSERT INTO notification(user_id,title,message,read,category,created_at) VALUES($1,$2,$3,true,'INFORMATIONAL',$4)",
  [ownerId, "Legacy", "Test", legacyTime],
);
await migrationClient.exec(
  await Bun.file(
    new URL("../../../drizzle/0038_notification_hardening.sql", import.meta.url),
  ).text(),
);
await migrationClient.exec(
  await Bun.file(
    new URL("../../../drizzle/0039_notification_sse_cursor.sql", import.meta.url),
  ).text(),
);
await migrationClient.exec(
  await Bun.file(
    new URL("../../../drizzle/0040_notification_delivery_outbox.sql", import.meta.url),
  ).text(),
);
const migrated = await oldDatabase.select().from(schema.notification);
expect(migrated[0].readAt?.toISOString()).toBe(new Date(legacyTime).toISOString());
expect(migrated[0].updatedAt).toBeInstanceOf(Date);
expect(await oldDatabase.select().from(schema.notificationDelivery)).toEqual([]);
await migrationClient.close();
console.log("Notification database checks passed");
