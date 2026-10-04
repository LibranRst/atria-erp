import * as WebBrowser from "expo-web-browser";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon, Button, GroupedSurface, FactRow } from "@/components/ui";
import { getWebBaseURL } from "@/lib/runtime-config";
import { theme } from "@/theme";

export default function OnboardingReviewBridgeScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}>
      <View style={styles.icon}>
        <AppIcon color={theme.colors.warning} name="approval" size={22} weight="bold" />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Saldo awal menunggu keputusan</Text>
        <Text style={styles.description}>
          Review saldo awal dilakukan di Atria web supaya detail stok, nilai, dan jejak audit tetap
          terlihat lengkap.
        </Text>
      </View>
      <GroupedSurface>
        <FactRow label="Tugas" value="Review saldo awal" />
        <FactRow label="Akses" value="Admin Keuangan" />
      </GroupedSurface>
      <Button
        onPress={() => void WebBrowser.openBrowserAsync(`${getWebBaseURL()}/onboarding/review`)}
      >
        Buka review di web
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
    backgroundColor: theme.colors.warningContainer,
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
