import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon, Button, GroupedSurface, FactRow } from "@/components/ui";
import { getWebBaseURL } from "@/lib/runtime-config";
import { theme } from "@/theme";

export default function OnboardingBridgeScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ step?: string }>();
  const step = typeof params.step === "string" ? params.step : "welcome";

  return (
    <View style={[styles.screen, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}>
      <View style={styles.icon}>
        <AppIcon color={theme.colors.primary} name="tune" size={22} weight="bold" />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Selesaikan setup organisasi</Text>
        <Text style={styles.description}>
          Setup awal tetap dibuka di Paduna Build web agar seluruh pengaturan finansial dan material
          dapat ditinjau dalam satu alur yang aman.
        </Text>
      </View>
      <GroupedSurface>
        <FactRow label="Langkah saat ini" value={step.replaceAll("_", " ")} />
        <FactRow label="Status" value="Perlu diselesaikan" />
      </GroupedSurface>
      <Button
        onPress={() =>
          void WebBrowser.openBrowserAsync(
            `${getWebBaseURL()}/onboarding?step=${encodeURIComponent(step)}`,
          )
        }
      >
        Buka setup di web
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    gap: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.marginMobile,
  },
  icon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radii.icon,
    backgroundColor: theme.colors.surfaceContainerLowest,
  },
  copy: { gap: theme.spacing.xs },
  title: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.extrabold,
    ...theme.typography.title,
  },
  description: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    ...theme.typography.row,
  },
});
