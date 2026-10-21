import webPush from "web-push";

type WebPushConfiguration = {
  readonly publicKey: string;
  readonly privateKey: string;
  readonly subject: string;
};

export function getWebPushConfiguration(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): WebPushConfiguration | null {
  const publicKey = environment.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = environment.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  const subject = environment.WEB_PUSH_SUBJECT?.trim();
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

export function getWebPushPublicKey(): string {
  return getWebPushConfiguration()?.publicKey ?? "";
}

type WebPushEndpoint = {
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
};

type WebPushMessage = {
  readonly title: string;
  readonly body: string;
  readonly url: string | null;
  readonly notificationId: string;
};

export function isWebPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname;
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      (host === "fcm.googleapis.com" ||
        host.endsWith(".push.apple.com") ||
        host === "updates.push.services.mozilla.com" ||
        host.endsWith(".notify.windows.com"))
    );
  } catch {
    return false;
  }
}

export async function sendWebPushMessage(
  subscription: WebPushEndpoint,
  message: WebPushMessage,
  urgency: "high" | "normal" = "normal",
): Promise<void> {
  const configuration = getWebPushConfiguration();
  if (!configuration) throw new Error("WEB_PUSH_VAPID_NOT_CONFIGURED");
  if (!isWebPushEndpoint(subscription.endpoint)) throw new Error("WEB_PUSH_ENDPOINT_INVALID");
  await webPush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    JSON.stringify(message),
    {
      vapidDetails: configuration,
      TTL: 60 * 60,
      urgency,
      topic: message.notificationId.replaceAll("-", "").slice(0, 32),
      timeout: 10_000,
    },
  );
}

export function isExpiredWebPushError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) return false;
  return error.statusCode === 404 || error.statusCode === 410;
}
