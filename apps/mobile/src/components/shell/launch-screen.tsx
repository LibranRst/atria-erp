import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/theme";
import { PadunaLogo } from "@/components/brand/paduna-logo";
import { MOBILE_APP_NAME } from "@/constants/brand";

export function LaunchScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <View
      accessible
      accessibilityLabel={`Membuka ${MOBILE_APP_NAME}`}
      accessibilityState={{ busy: true }}
      style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <PadunaLogo accessible={false} />
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
  message: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.medium,
    ...theme.typography.support,
  },
});
