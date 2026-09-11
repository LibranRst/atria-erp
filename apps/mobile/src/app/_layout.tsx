import "@/global.css";

import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono/500Medium";
import { Manrope_400Regular } from "@expo-google-fonts/manrope/400Regular";
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { Manrope_800ExtraBold } from "@expo-google-fonts/manrope/800ExtraBold";
import { useFonts } from "expo-font";
import { DefaultTheme, ThemeProvider } from "expo-router";
import { Stack } from "expo-router/stack";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Toaster } from "sonner-native";

import { LaunchScreen } from "@/components/shell/launch-screen";
import { AuthProvider, useAuth } from "@/providers/auth-provider";
import { QueryProvider } from "@/providers/query-provider";
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
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return <LaunchScreen />;

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
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: theme.colors.background },
        headerBackButtonDisplayMode: "minimal",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.onSurface,
        headerTitleStyle: { fontFamily: theme.fonts.bold },
      }}
    >
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={mustChangePassword}>
        <Stack.Screen name="profile/password" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={canEnterApp}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="approvals/index" options={{ title: "Persetujuan" }} />
        <Stack.Screen name="onboarding/index" options={{ title: "Setup organisasi" }} />
        <Stack.Screen name="onboarding/review" options={{ title: "Review saldo awal" }} />
        <Stack.Screen
          name="expenses/new"
          options={{
            headerShown: false,
            presentation: "formSheet",
            sheetAllowedDetents: [0.85, 1],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen
          name="modal/vendor-bill"
          options={{
            headerShown: false,
            presentation: "formSheet",
            sheetAllowedDetents: [0.85, 1],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen
          name="modal/project"
          options={{
            headerShown: false,
            presentation: "formSheet",
            sheetAllowedDetents: [0.85, 1],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen
          name="modal/invoice"
          options={{
            headerShown: false,
            presentation: "formSheet",
            sheetAllowedDetents: [0.85, 1],
            sheetGrabberVisible: true,
          }}
        />
      </Stack.Protected>
    </Stack>
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
            <PushNotificationsProvider>
              <RootNavigator />
            </PushNotificationsProvider>
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
