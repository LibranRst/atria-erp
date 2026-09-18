import { z } from "zod";

export type NotificationSeverity = "INFO" | "WARNING" | "CRITICAL";

export type NotificationCategory = "ACTION_REQUIRED" | "INFORMATIONAL";

export type NotificationReferenceType =
  | "project_cost"
  | "project_budget"
  | "vendor_bill"
  | "client_payment"
  | "client_invoice"
  | "stock_movement"
  | "stock_count"
  | "inventory_opening"
  | "goods_receipt_reversal"
  | "rap"
  | "rab"
  | "project"
  | "system"
  | "vendor_payment"
  | "goods_receipt"
  | "material"
  | "change_order";

/** Daftar runtime yang sepadan dengan union `NotificationReferenceType`. */
export const NOTIFICATION_REFERENCE_TYPES: readonly NotificationReferenceType[] = [
  "project_cost",
  "project_budget",
  "vendor_bill",
  "client_payment",
  "client_invoice",
  "stock_movement",
  "stock_count",
  "inventory_opening",
  "goods_receipt_reversal",
  "rap",
  "rab",
  "project",
  "system",
  "vendor_payment",
  "goods_receipt",
  "material",
  "change_order",
];

export function normalizeNotificationReferenceType(
  value: string | null | undefined,
): NotificationReferenceType | null {
  return value ? (NOTIFICATION_REFERENCE_TYPES.find((type) => type === value) ?? null) : null;
}

export type PushPlatform = "WEB" | "EXPO_IOS" | "EXPO_ANDROID";

/**
 * ID kanal notifikasi Android.
 *
 * Android 8+ hanya menampilkan heads-up banner lewat kanal ber-importance
 * tinggi, dan kanal dibuat oleh aplikasi native (`expo-notifications`). Server
 * mengirim `channelId` ini pada tiap push Expo Android; kalau berbeda dengan
 * yang didaftarkan klien, Android diam-diam memakai kanal cadangan bawaan
 * library sehingga nama dan prioritas yang kita atur hilang.
 */
export const ANDROID_NOTIFICATION_CHANNEL_ID = "operasional";

export type NotificationItem = {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  readAt?: string | null;
  projectId?: string | null;
  severity: NotificationSeverity;
  category: NotificationCategory;
  referenceType?: NotificationReferenceType | null;
  referenceId?: string | null;
  actionUrl?: string | null;
  isResolved: boolean;
  resolvedAt?: string | null;
  resolvedById?: string | null;
  createdAt: string;
};

export type NotificationSummary = {
  unreadCount: number;
  actionRequiredCount: number;
  items: NotificationItem[];
  informationalUnreadCount: number;
};

export const registerPushTokenSchema = z
  .object({
    platform: z.enum(["WEB", "EXPO_IOS", "EXPO_ANDROID"]),
    token: z.string().trim().max(200).optional(),
    endpoint: z.string().trim().max(2048).url().optional(),
    p256dh: z
      .string()
      .trim()
      .max(256)
      .regex(/^[A-Za-z0-9_-]+={0,2}$/)
      .optional(),
    auth: z
      .string()
      .trim()
      .max(128)
      .regex(/^[A-Za-z0-9_-]+={0,2}$/)
      .optional(),
    userAgent: z.string().trim().max(512).optional(),
  })
  .superRefine((input, ctx) => {
    if (input.platform === "WEB") {
      if (input.token)
        ctx.addIssue({ code: "custom", message: "Token Expo tidak berlaku untuk Web Push." });
      if (!input.endpoint?.startsWith("https://") || !input.p256dh || !input.auth) {
        ctx.addIssue({ code: "custom", message: "Langganan Web Push tidak lengkap." });
      }
    } else {
      if (input.endpoint || input.p256dh || input.auth) {
        ctx.addIssue({ code: "custom", message: "Credential Web Push tidak berlaku untuk Expo." });
      }
      if (
        !input.token ||
        !/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(input.token)
      ) {
        ctx.addIssue({ code: "custom", message: "Token Expo tidak valid." });
      }
    }
  });

export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;

export const unregisterPushTokenSchema = z
  .object({
    platform: z.enum(["WEB", "EXPO_IOS", "EXPO_ANDROID"]),
    token: z.string().trim().max(200).optional(),
    endpoint: z.string().trim().max(2048).url().optional(),
  })
  .superRefine((input, ctx) => {
    if (input.platform === "WEB" && !input.endpoint?.startsWith("https://")) {
      ctx.addIssue({ code: "custom", message: "Endpoint Web Push tidak valid." });
    }
    if (
      input.platform !== "WEB" &&
      (!input.token || !/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(input.token))
    ) {
      ctx.addIssue({ code: "custom", message: "Token Expo tidak valid." });
    }
  });

export type UnregisterPushTokenInput = z.infer<typeof unregisterPushTokenSchema>;

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const markNotificationReadSchema = z.object({
  id: z.string().regex(uuidRegex, "ID notifikasi tidak valid."),
});

export const markAllNotificationsReadSchema = z.object({
  category: z.enum(["ACTION_REQUIRED", "INFORMATIONAL"]).optional(),
});

export const notificationListSchema = z.object({
  category: z.enum(["ACTION_REQUIRED", "INFORMATIONAL"]),
  cursor: z
    .object({ createdAt: z.string().datetime(), id: z.string().uuid(), resolved: z.boolean() })
    .optional(),
});
export type NotificationListInput = z.infer<typeof notificationListSchema>;
export type NotificationPage = {
  items: NotificationItem[];
  nextCursor: NotificationListInput["cursor"] | null;
  hasMore: boolean;
};

/** Accept only application-relative paths, never protocol-relative or executable URLs. */
export function safeNotificationUrl(value: string | null | undefined): string | null {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    Array.from(value).some((character) => character.charCodeAt(0) <= 32)
  )
    return null;
  try {
    const url = new URL(value, "https://atria.invalid");
    return /^\/(approvals|projects|materials|expenses|ledger|notifications|reconciliation)([/?#]|$)/.test(
      url.pathname,
    )
      ? `${url.pathname}${url.search}${url.hash}`
      : null;
  } catch {
    return null;
  }
}

/** Legacy notification links predate the current project tab names. Normalize at the boundary. */
export function notificationDestination(item: {
  readonly referenceType?: string | null;
  readonly projectId?: string | null;
  readonly actionUrl?: string | null;
}): string | null {
  const safe = safeNotificationUrl(item.actionUrl);
  if (!safe) return null;

  const referenceType = normalizeNotificationReferenceType(item.referenceType);
  if (item.projectId && (referenceType === "change_order" || referenceType === "rab")) {
    return `/projects/${item.projectId}?tab=rab`;
  }

  if (
    safe === "/approvals" ||
    safe.startsWith("/approvals?") ||
    safe === "/expenses" ||
    safe.startsWith("/expenses?") ||
    safe === "/ledger" ||
    safe.startsWith("/ledger?") ||
    safe === "/reconciliation" ||
    safe.startsWith("/reconciliation?") ||
    !item.projectId
  )
    return safe;
  const tab =
    referenceType === "project_cost" ||
    referenceType === "vendor_bill" ||
    referenceType === "vendor_payment"
      ? "expenses"
      : referenceType === "client_invoice" || referenceType === "client_payment"
        ? "payments"
        : referenceType === "goods_receipt" ||
            referenceType === "goods_receipt_reversal" ||
            referenceType === "stock_movement"
          ? "stok"
          : referenceType === "rap"
            ? "rap"
            : referenceType === "rab" || referenceType === "change_order"
              ? "rab"
              : "overview";
  return `/projects/${item.projectId}?tab=${tab}`;
}
