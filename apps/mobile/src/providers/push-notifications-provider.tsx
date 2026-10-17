import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { Alert, Platform } from "react-native";

import { trpcClient } from "@/lib/trpc-client";
import { useAtriaNavigation } from "@/lib/use-atria-navigation";
import { resolveMobileNotificationRoute } from "@/lib/notification-route";
import { writeStoredPushToken } from "@/lib/push-token-storage";
import { useAuth } from "@/providers/auth-provider";
import { getRoleNavItems } from "@atria/core/navigation/role-navigation";
import {
  ANDROID_NOTIFICATION_CHANNEL_ID,
  safeNotificationUrl,
} from "@atria/core/notifications/types";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // Server mengirim `sound: "default"`; handler ini hanya berlaku saat aplikasi
    // sedang terbuka, dan menyenyapkan bunyi di sana membuat pratinjau berbeda
    // dari notifikasi yang benar-benar diterima.
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let channelReady: Promise<void> | null = null;

/**
 * Kanal dibuat sekali per proses dan tidak butuh izin runtime, jadi dipanggil
 * sebelum permintaan izin agar kanal sudah ada saat notifikasi pertama datang.
 */
function ensureNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return Promise.resolve();
  channelReady ??= Notifications.setNotificationChannelAsync(ANDROID_NOTIFICATION_CHANNEL_ID, {
    name: "Pembaruan operasional",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
  }).then(() => undefined);
  return channelReady;
}

function warnPushFailure(context: string, error: unknown): void {
  if (!__DEV__) return;
  console.warn(`[push] ${context}`, error instanceof Error ? error.message : String(error));
}

function easProjectId(): string | null {
  const configured = Constants.easConfig?.projectId;
  if (configured) return configured;
  const extra = Constants.expoConfig?.extra;
  if (typeof extra !== "object" || extra === null || !("eas" in extra)) return null;
  const eas = extra.eas;
  return typeof eas === "object" &&
    eas !== null &&
    "projectId" in eas &&
    typeof eas.projectId === "string"
    ? eas.projectId
    : null;
}

async function registerDevice(projectId: string): Promise<void> {
  await ensureNotificationChannel();
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  const platform = Platform.OS === "ios" ? "EXPO_IOS" : "EXPO_ANDROID";
  await trpcClient.notifications.registerPush.mutate({
    platform,
    token: token.data,
  });
  await writeStoredPushToken({ platform, token: token.data });
}

function notificationUrl(response: Notifications.NotificationResponse): string | null {
  const value = response.notification.request.content.data?.url;
  return typeof value === "string" ? safeNotificationUrl(value) : null;
}

export function PushNotificationsProvider({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const { isAuthenticated, permissions, user } = useAuth();
  const router = useRouter();
  const navigate = useAtriaNavigation();
  const userId = user?.id ?? null;
  /** Rute cadangan mengikuti tab navigasi peran, bukan peta rute terpisah. */
  const fallbackRoute = useMemo<"/ledger" | "/projects" | "/materials" | "/expenses">(
    () => getRoleNavItems(permissions)[0]?.href ?? "/projects",
    [permissions],
  );

  useEffect(() => {
    if (!isAuthenticated || !userId || Platform.OS === "web") return undefined;
    const projectId = easProjectId();
    if (!projectId) {
      // Tanpa projectId EAS, `getExpoPushTokenAsync` tidak bisa dipanggil. Ini
      // yang terjadi pada build tanpa konfigurasi EAS; jangan menawarkan izin
      // yang hasilnya tidak akan pernah terpakai.
      if (__DEV__)
        console.info("[push] projectId EAS belum dikonfigurasi; registrasi token dilewati.");
      return undefined;
    }
    const pushProjectId = projectId;
    let active = true;

    function openNotification(response: Notifications.NotificationResponse): void {
      const destination = notificationUrl(response);
      if (!destination) return;
      const route = resolveMobileNotificationRoute(destination, fallbackRoute);
      if (route.kind === "web") navigate(route.path, true);
      else router.push(route.href);
      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    }

    async function prepare(): Promise<void> {
      await ensureNotificationChannel();
      if (!active) return;
      const permissions = await Notifications.getPermissionsAsync();
      if (!active) return;
      if (permissions.status === "granted") {
        await registerDevice(pushProjectId);
        return;
      }
      if (permissions.status !== "undetermined") return;
      const promptKey = `atria:push-prompt:${userId}`;
      if (await AsyncStorage.getItem(promptKey)) return;
      await AsyncStorage.setItem(promptKey, "shown");
      if (!active) return;
      Alert.alert(
        "Aktifkan notifikasi?",
        "Paduna Build dapat memberi tahu saat approval, pembayaran, atau material perlu tindakan.",
        [
          { text: "Nanti", style: "cancel" },
          {
            text: "Aktifkan",
            onPress: () => {
              void Notifications.requestPermissionsAsync()
                .then((result) => {
                  if (result.status === "granted") return registerDevice(pushProjectId);
                })
                .catch((error: unknown) => warnPushFailure("permintaan izin gagal", error));
            },
          },
        ],
      );
    }

    void prepare().catch((error: unknown) => warnPushFailure("penyiapan push gagal", error));
    const tokenListener = Notifications.addPushTokenListener(() => {
      void registerDevice(pushProjectId).catch((error: unknown) =>
        warnPushFailure("penyegaran token gagal", error),
      );
    });
    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      openNotification(response);
    });
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!active || !response) return;
      openNotification(response);
    });

    return () => {
      active = false;
      tokenListener.remove();
      responseListener.remove();
    };
  }, [fallbackRoute, isAuthenticated, navigate, router, userId]);

  return <>{children}</>;
}
