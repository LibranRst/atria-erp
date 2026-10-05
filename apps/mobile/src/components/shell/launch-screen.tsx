import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/theme";

export function LaunchScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <View
      accessible
      accessibilityLabel="Membuka Atria"
      accessibilityState={{ busy: true }}
      style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <Text style={styles.brand}>Atria</Text>
      <Text style={styles.message}>Menyiapkan workspace…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.marginMobile,
  },
  brand: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.extrabold,
    ...theme.typography.title,
  },
  message: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.medium,
    ...theme.typography.support,
  },
});
