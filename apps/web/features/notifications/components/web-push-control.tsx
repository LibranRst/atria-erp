"use client";

import React from "react";
import { toast } from "sonner";

import {
  registerPushTokenAction,
  unregisterPushTokenAction,
} from "@/app/actions/notifications/push-token";
import { AppIcon, Button, GroupedSurface, StatusBadge } from "@/components/ui";

type PushState = "checking" | "unsupported" | "unconfigured" | "denied" | "enabled" | "disabled";

function applicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const decoded = atob((value + padding).replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

async function registration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/notification-sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

export function WebPushControl({ publicKey }: { readonly publicKey: string }): React.JSX.Element {
  const [state, setState] = React.useState<PushState>("checking");
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    let active = true;
    async function inspect(): Promise<void> {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (active) setState("unsupported");
        return;
      }
      if (!publicKey) {
        if (active) setState("unconfigured");
        return;
      }
      if (Notification.permission === "denied") {
        if (active) setState("denied");
        return;
      }
      try {
        const subscription = await (await registration()).pushManager.getSubscription();
        if (active) setState(subscription ? "enabled" : "disabled");
      } catch {
        if (active) setState("unsupported");
      }
    }
    void inspect();
    return () => {
      active = false;
    };
  }, [publicKey]);

  function enable(): void {
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "disabled");
          return;
        }
        const worker = await registration();
        const existing = await worker.pushManager.getSubscription();
        const subscription =
          existing ??
          (await worker.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey(publicKey),
          }));
        const json = subscription.toJSON();
        const result = await registerPushTokenAction({
          platform: "WEB",
          endpoint: subscription.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
          userAgent: navigator.userAgent,
        });
        if (!result.success) {
          if (!existing) await subscription.unsubscribe();
          throw new Error(result.error.message);
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
        const subscription = await (await registration()).pushManager.getSubscription();
        if (subscription) {
          const result = await unregisterPushTokenAction({
            platform: "WEB",
            endpoint: subscription.endpoint,
          });
          if (!result.success) throw new Error(result.error.message);
          await subscription.unsubscribe();
        }
        setState("disabled");
        toast.success("Push browser dimatikan.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Push browser belum dapat dimatikan.");
      }
    });
  }

  const description =
    state === "enabled"
      ? "Pembaruan penting dapat muncul saat Atria tidak sedang dibuka."
      : state === "denied"
        ? "Izin diblokir oleh browser. Ubah izin notifikasi pada pengaturan situs."
        : state === "unsupported"
          ? "Browser ini belum mendukung push notification."
          : state === "unconfigured"
            ? "VAPID key belum tersedia pada environment server."
            : "Aktifkan untuk menerima pembaruan penting di perangkat ini.";

  return (
    <GroupedSurface className="flex items-center gap-3 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-primary/8 text-primary">
        <AppIcon name="bell_ringing" className="icon-md" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-support font-bold text-on-surface">Push browser</p>
          <StatusBadge
            tone={state === "enabled" ? "healthy" : state === "denied" ? "critical" : "neutral"}
            label={state === "enabled" ? "Aktif" : state === "checking" ? "Memeriksa" : "Nonaktif"}
          />
        </div>
        <p className="mt-0.5 text-meta leading-4 text-on-surface-variant">{description}</p>
      </div>
      {state === "enabled" ? (
        <Button size="mini" variant="secondary" pending={pending} onClick={disable}>
          Matikan
        </Button>
      ) : state === "disabled" ? (
        <Button size="mini" pending={pending} onClick={enable}>
          Aktifkan
        </Button>
      ) : null}
    </GroupedSurface>
  );
}
