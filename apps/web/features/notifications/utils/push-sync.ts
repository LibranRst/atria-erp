import type { PushEnvironment, PushPermission, PushSignals } from "./push-state";

/**
 * Identitas langganan yang dikirim ke server. `PushSubscription` milik DOM
 * dipetakan ke bentuk ini di batas komponen supaya logika di bawah bisa diuji
 * tanpa peramban.
 */
export type WebPushRegistration = {
  readonly endpoint: string;
  readonly p256dh?: string;
  readonly auth?: string;
};

export type WebPushDeps = {
  readonly readEnvironment: () => PushEnvironment;
  readonly readPermission: () => PushPermission;
  readonly readSubscription: () => Promise<WebPushRegistration | null>;
  /** Mencatat langganan ke server; `true` berarti catatan server sudah benar. */
  readonly register: (subscription: WebPushRegistration) => Promise<boolean>;
};

/**
 * Membaca sinyal push pada saat ini, dan merekonsiliasi catatan server ketika
 * perangkat sudah memberi izin serta langganannya masih hidup.
 *
 * Rekonsiliasi ini hanya menulis ulang langganan yang sudah ada: tidak ada
 * permintaan izin dan tidak ada langganan baru. Tanpa langganan, tidak ada
 * panggilan server sama sekali — perangkat yang memang belum berlangganan tidak
 * boleh tiba-tiba tercatat di server.
 */
export async function inspectWebPush(deps: WebPushDeps): Promise<PushSignals> {
  const environment = deps.readEnvironment();
  if (
    !environment.secureContext ||
    !environment.pushApiSupported ||
    !environment.serverKeyConfigured
  ) {
    return {
      environment,
      permission: "unsupported",
      serverRegistration: "unknown",
      subscribed: false,
    };
  }
  const permission = deps.readPermission();
  const subscription = await deps.readSubscription();
  if (!subscription) {
    return { environment, permission, serverRegistration: "unknown", subscribed: false };
  }
  if (permission !== "granted") {
    return { environment, permission, serverRegistration: "unknown", subscribed: true };
  }
  const registered = await deps.register(subscription).catch(() => false);
  return {
    environment,
    permission,
    serverRegistration: registered ? "confirmed" : "failed",
    subscribed: true,
  };
}
