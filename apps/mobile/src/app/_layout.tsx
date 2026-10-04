import "@/global.css";

import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono/500Medium";
import { Manrope_400Regular } from "@expo-google-fonts/manrope/400Regular";
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { Manrope_800ExtraBold } from "@expo-google-fonts/manrope/800ExtraBold";
import { useFonts } from "expo-font";
import { DefaultTheme, ThemeProvider, useRouter } from "expo-router";
import { Stack } from "expo-router/stack";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Toaster } from "sonner-native";

import {
  PersistentWorkspaceMenu,
  useWorkspaceHeaderOptions,
} from "@/components/shell/workspace-chrome";
import { LaunchScreen } from "@/components/shell/launch-screen";
import { Button, ScreenMessage, sheetHeaderOptions } from "@/components/ui";
import { Platform, View } from "react-native";
import { AuthProvider, useAuth } from "@/providers/auth-provider";
import { QueryProvider } from "@/providers/query-provider";
import { MainNavigationProvider } from "@/providers/main-navigation-provider";
import { PushNotificationsProvider } from "@/providers/push-notifications-provider";
import { theme } from "@/theme";

void SplashScreen.preventAutoHideAsync();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: theme.colors.background,
    border: theme.colors.outlineVariant,
    card: theme.colors.background,
    notification: theme.colors.critical,
    primary: theme.colors.primary,
    text: theme.colors.onSurface,
  },
};

function RootNavigator(): React.JSX.Element {
  const { accessError, isAuthenticated, isLoading, refresh, signOut, user } = useAuth();
  const headerOptions = useWorkspaceHeaderOptions();
  const router = useRouter();
  const sheetOptions = (title: string, editable = false) => ({
    ...sheetHeaderOptions(title, () => router.back()),
    presentation:
      Platform.OS === "android" && editable ? ("modal" as const) : ("formSheet" as const),
    // Known long forms can start presenting without waiting for intrinsic layout.
    sheetAllowedDetents: editable ? [1] : ("fitToContents" as const),
    sheetGrabberVisible: true,
    sheetCornerRadius: 28,
    contentStyle: {
      backgroundColor: theme.colors.surfaceContainerLow,
      ...(editable ? { flex: 1 } : { height: 180 }),
    },
  });
  if (isLoading) return <LaunchScreen />;
  if (accessError)
    return (
      <View style={{ flex: 1 }}>
        <ScreenMessage
          title="Periksa akses akun"
          description={accessError}
          onAction={() => void refresh()}
        />
        <View style={{ padding: theme.spacing.marginMobile }}>
          <Button variant="secondary" onPress={() => void signOut()}>
            Masuk ulang
          </Button>
        </View>
      </View>
    );

  /**
   * Tiga keadaan yang saling eksklusif:
   * - belum masuk → hanya login;
   * - masuk tetapi kata sandi masih sementara → hanya `/profile/password`;
   * - masuk penuh → shell operasional.
   *
   * Akun dengan kata sandi sementara sengaja tidak pernah melihat tab: server
   * juga menolaknya lewat `activeProcedure`, jadi gate ini mencerminkan batas
   * yang sama di sisi klien alih-alih menambah aturan baru.
   */
  const mustChangePassword = isAuthenticated && user?.mustChangePassword === true;
  const canEnterApp = isAuthenticated && !mustChangePassword;

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={headerOptions}>
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={mustChangePassword}>
          <Stack.Screen name="profile/password" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={canEnterApp}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: "none" }} />
          <Stack.Screen name="onboarding/index" options={{ title: "Setup organisasi" }} />
          <Stack.Screen name="onboarding/review" options={{ title: "Review saldo awal" }} />
          <Stack.Screen name="expenses/new" options={sheetOptions("Catat biaya proyek", true)} />
          <Stack.Screen name="modal/vendor-bill" options={sheetOptions("Tagihan vendor")} />
          <Stack.Screen name="modal/project" options={sheetOptions("Proyek", true)} />
          <Stack.Screen name="modal/account" options={sheetOptions("Detail rekening")} />
          <Stack.Screen name="modal/activity" options={sheetOptions("Detail transaksi")} />
          <Stack.Screen name="modal/approval" options={sheetOptions("Detail persetujuan")} />
          <Stack.Screen name="modal/invoice" options={sheetOptions("Invoice")} />
        </Stack.Protected>
      </Stack>
      {canEnterApp && Platform.OS === "ios" ? <PersistentWorkspaceMenu /> : null}
    </View>
  );
}

export default function RootLayout(): React.JSX.Element | null {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    JetBrainsMono_500Medium,
  });
  const ready = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ThemeProvider value={navigationTheme}>
        <QueryProvider>
          <AuthProvider>
            <MainNavigationProvider>
              <PushNotificationsProvider>
                <RootNavigator />
              </PushNotificationsProvider>
            </MainNavigationProvider>
          </AuthProvider>
        </QueryProvider>
      </ThemeProvider>
      <StatusBar style="dark" />
      <Toaster
        position="top-center"
        richColors={false}
        toastOptions={{
          style: {
            backgroundColor: theme.colors.surfaceInverse,
            borderColor: theme.colors.surfaceInverse,
            borderRadius: theme.radii.inset,
          },
        }}
      />
    </GestureHandlerRootView>
  );
}
