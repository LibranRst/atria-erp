import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { type Href, useRouter } from "expo-router";
import { useEffect } from "react";
import { Alert, Platform } from "react-native";

import { trpcClient } from "@/lib/trpc-client";
import { writeStoredPushToken } from "@/lib/push-token-storage";
import { useAuth } from "@/providers/auth-provider";
import { safeNotificationUrl } from "@atria/core/notifications/types";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("operasional", {
      name: "Pembaruan operasional",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
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
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!isAuthenticated || !userId || Platform.OS === "web") return undefined;
    const projectId = easProjectId();
    if (!projectId) return undefined;
    const pushProjectId = projectId;
    let active = true;

    function openNotification(response: Notifications.NotificationResponse): void {
      const destination = notificationUrl(response);
      if (!destination) return;
      router.push(destination as Href);
      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    }

    async function prepare(): Promise<void> {
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
        "Atria dapat memberi tahu saat approval, pembayaran, atau material perlu tindakan.",
        [
          { text: "Nanti", style: "cancel" },
          {
            text: "Aktifkan",
            onPress: () => {
              void Notifications.requestPermissionsAsync().then((result) => {
                if (result.status === "granted") return registerDevice(pushProjectId);
              });
            },
          },
        ],
      );
    }

    void prepare().catch(() => undefined);
    const tokenListener = Notifications.addPushTokenListener(() => {
      void registerDevice(pushProjectId).catch(() => undefined);
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
  }, [isAuthenticated, router, userId]);

  return <>{children}</>;
}
