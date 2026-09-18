"use client";

import React from "react";
import { toast } from "sonner";

import {
  registerPushTokenAction,
  unregisterPushTokenAction,
} from "@/app/actions/notifications/push-token";
import { AppIcon, Button, GroupedSurface, StatusBadge } from "@/components/ui";
import { readInstallEnvironment } from "@/lib/pwa/install";
import {
  applicationServerKey,
  getExistingPushSubscription,
  registerServiceWorker,
} from "@/lib/pwa/service-worker";
import {
  PUSH_STATE_COPY,
  resolvePushState,
  type PushEnvironment,
  type PushPermission,
  type PushState,
} from "../utils/push-state";
import { inspectWebPush, type WebPushRegistration } from "../utils/push-sync";

function readPushPermission(): PushPermission {
  return "Notification" in window ? Notification.permission : "unsupported";
}

/** Lingkungan yang bisa diamati tanpa menyentuh layanan push sama sekali. */
function readPushEnvironment(serverKeyConfigured: boolean): PushEnvironment {
  const install = readInstallEnvironment(false);
  return {
    install,
    // Service worker wajib ada untuk push; `install.pushSupported` hanya
    // memeriksa API `PushManager` dan `Notification`.
    pushApiSupported: install.pushSupported && "serviceWorker" in navigator,
    serverKeyConfigured,
  };
}

function toRegistration(subscription: PushSubscription): WebPushRegistration {
  const keys = subscription.toJSON().keys;
  return {
    endpoint: subscription.endpoint,
    p256dh: keys?.p256dh,
    auth: keys?.auth,
  };
}

/**
 * Mencatat langganan ke server.
 *
 * Saat dipanggil untuk langganan yang sudah hidup, ini bukan langganan baru:
 * tidak ada permintaan izin dan tidak ada `pushManager.subscribe`. Yang
 * diperbaiki adalah catatan server, yang bisa hilang karena reset basis data,
 * perpindahan tenant, atau POST yang gagal.
 */
function registerSubscription(registration: WebPushRegistration): Promise<boolean> {
  return registerPushTokenAction({
    platform: "WEB",
    endpoint: registration.endpoint,
    p256dh: registration.p256dh,
    auth: registration.auth,
    userAgent: navigator.userAgent,
  }).then((result) => result.success);
}

function pushDeps(serverKeyConfigured: boolean): Parameters<typeof inspectWebPush>[0] {
  return {
    readEnvironment: () => readPushEnvironment(serverKeyConfigured),
    readPermission: readPushPermission,
    readSubscription: async (): Promise<WebPushRegistration | null> => {
      const subscription = await getExistingPushSubscription();
      return subscription ? toRegistration(subscription) : null;
    },
    register: registerSubscription,
  };
}

export function WebPushControl({
  publicKey,
  embedded = false,
}: {
  readonly publicKey: string;
  readonly embedded?: boolean;
}): React.JSX.Element {
  const [state, setState] = React.useState<PushState>("checking");
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    let active = true;
    void inspectWebPush(pushDeps(Boolean(publicKey)))
      .then((signals) => {
        if (active) setState(resolvePushState(signals));
      })
      .catch(() => {
        if (active)
          setState(
            resolvePushState({
              environment: readPushEnvironment(Boolean(publicKey)),
              permission: "unsupported",
              serverRegistration: "unknown",
              subscribed: false,
            }),
          );
      });
    return () => {
      active = false;
    };
  }, [publicKey]);

  function activate(): void {
    startTransition(async () => {
      try {
        let permission = readPushPermission();
        if (permission !== "granted") {
          // Izin hanya diminta dari gestur pengguna ini, tidak pernah otomatis.
          permission = await Notification.requestPermission();
        }
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "disabled");
          return;
        }
        const worker = await registerServiceWorker();
        if (!worker) throw new Error("Service worker belum siap di perangkat ini.");
        // Langganan yang sudah ada dipakai ulang: perangkat yang pernah
        // berlangganan tetapi gagal dicatat hanya perlu disinkronkan.
        const existing = await worker.pushManager.getSubscription();
        const subscription =
          existing ??
          (await worker.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey(publicKey),
          }));
        const registered = await registerSubscription(toRegistration(subscription));
        if (!registered) {
          // Hanya langganan baru yang dibatalkan; langganan lama dibiarkan agar
          // satu kegagalan jaringan tidak mencabut langganan yang sudah ada.
          if (!existing) await subscription.unsubscribe();
          throw new Error("Gagal menyimpan langganan push di server.");
        }
        setState("enabled");
        toast.success("Push browser aktif.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Push browser belum dapat diaktifkan.",
        );
      }
    });
  }

  function disable(): void {
    startTransition(async () => {
      try {
        const worker = await registerServiceWorker();
        const subscription = await worker?.pushManager.getSubscription();
        if (!subscription) {
          setState("disabled");
          return;
        }
        const result = await unregisterPushTokenAction({
          platform: "WEB",
          endpoint: subscription.endpoint,
        });
        // Server lebih dulu: bila penghapusan gagal, langganan perangkat tetap
        // hidup supaya catatan server dan perangkat tidak berbeda.
        if (!result.success) throw new Error(result.error.message);
        await subscription.unsubscribe();
        setState("disabled");
        toast.success("Push browser dimatikan.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Push browser belum dapat dimatikan.");
      }
    });
  }

  const copy = PUSH_STATE_COPY[state];

  const content = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-primary/8 text-primary">
        <AppIcon name="bell_ringing" className="icon-md" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-support font-bold text-on-surface">Push browser</p>
          <StatusBadge tone={copy.badgeTone} label={copy.badge} />
        </div>
        <p className="mt-0.5 text-meta leading-4 text-on-surface-variant">{copy.description}</p>
      </div>
      {copy.action === "disable" ? (
        <Button size="mini" variant="secondary" pending={pending} onClick={disable}>
          Matikan
        </Button>
      ) : copy.action === "enable" ? (
        <Button size="mini" pending={pending} onClick={activate}>
          Aktifkan
        </Button>
      ) : copy.action === "reconnect" ? (
        <Button size="mini" pending={pending} onClick={activate}>
          Sambung ulang
        </Button>
      ) : null}
    </>
  );

  if (embedded) {
    return <div className="flex min-h-16 items-center gap-3 px-3.5 py-3">{content}</div>;
  }

  return <GroupedSurface className="flex items-center gap-3 p-4">{content}</GroupedSurface>;
}
