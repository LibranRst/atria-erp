import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "./app-icon";
import { theme } from "@/theme";

export function ScreenSkeleton({ rows = 4 }: { readonly rows?: number }): React.JSX.Element {
  return (
    <View accessibilityLabel="Memuat data" style={styles.skeletonScreen}>
      <View style={styles.skeletonTitle} />
      <View style={styles.skeletonSummary} />
      <View style={styles.skeletonSurface}>
        {Array.from({ length: rows }, (_, index) => (
          <View key={index} style={[styles.skeletonRow, index > 0 && styles.divider]} />
        ))}
      </View>
    </View>
  );
}

export function ScreenMessage({
  actionLabel = "Coba lagi",
  description,
  icon = "cloud_off",
  onAction,
  title,
}: {
  readonly actionLabel?: string;
  readonly description: string;
  readonly icon?: string;
  readonly onAction?: () => void;
  readonly title: string;
}): React.JSX.Element {
  return (
    <View style={styles.message}>
      <View style={styles.messageIcon}>
        <AppIcon color={theme.colors.onSurfaceVariant} name={icon} size={22} weight="bold" />
      </View>
      <Text style={styles.messageTitle}>{title}</Text>
      <Text style={styles.messageDescription}>{description}</Text>
      {onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={styles.retry}>
          <Text style={styles.retryLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonScreen: { flex: 1, gap: theme.spacing.lg, padding: theme.spacing.marginMobile },
  skeletonTitle: {
    width: "52%",
    height: 28,
    borderRadius: theme.radii.inset,
    backgroundColor: theme.colors.surfaceContainerHigh,
  },
  skeletonSummary: {
    height: 144,
    borderRadius: theme.radii.owner,
    backgroundColor: theme.colors.surfaceContainer,
  },
  skeletonSurface: {
    overflow: "hidden",
    borderRadius: theme.radii.owner,
    backgroundColor: theme.colors.surfaceContainerLowest,
  },
  skeletonRow: { height: 64 },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.outlineVariant,
  },
  message: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.xl,
  },
  messageIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radii.icon,
    backgroundColor: theme.colors.surfaceContainerLow,
  },
  messageTitle: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    ...theme.typography.section,
  },
  messageDescription: {
    maxWidth: 320,
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    textAlign: "center",
    ...theme.typography.support,
  },
  retry: { minHeight: 48, justifyContent: "center", paddingHorizontal: theme.spacing.md },
  retryLabel: { color: theme.colors.accent, fontFamily: theme.fonts.bold, ...theme.typography.row },
});
