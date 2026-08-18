import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/theme";

export function LaunchScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + theme.spacing.lg }]}>
      <View style={styles.brandMark} />
      <View style={styles.copy}>
        <View style={styles.title} />
        <View style={styles.line} />
      </View>
      <View style={styles.surface}>
        <View style={styles.row} />
        <View style={styles.divider} />
        <View style={styles.row} />
        <View style={styles.divider} />
        <View style={styles.row} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.marginMobile,
  },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.icon,
    backgroundColor: theme.colors.primary,
  },
  copy: { gap: theme.spacing.xs },
  title: {
    width: "54%",
    height: 28,
    borderRadius: theme.radii.inset,
    backgroundColor: theme.colors.surfaceContainerHigh,
  },
  line: {
    width: "82%",
    height: 16,
    borderRadius: theme.radii.inset,
    backgroundColor: theme.colors.surfaceContainer,
  },
  surface: {
    overflow: "hidden",
    borderRadius: theme.radii.owner,
    backgroundColor: theme.colors.surfaceContainerLowest,
  },
  row: { height: 64, backgroundColor: theme.colors.surfaceContainerLowest },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.outlineVariant },
});
