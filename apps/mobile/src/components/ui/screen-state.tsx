import { StyleSheet, Text, View } from "react-native";

import { AppIcon } from "./app-icon";
import { Button } from "./button";
import { SkeletonBlock, SkeletonBusy } from "./loading-skeletons";
import { theme } from "@/theme";

export function ScreenSkeleton({ rows = 4 }: { readonly rows?: number }): React.JSX.Element {
  return (
    <SkeletonBusy>
      <View style={styles.skeletonSurface}>
        {Array.from({ length: rows }, (_, index) => (
          <View key={index} style={[styles.skeletonRow, index > 0 && styles.divider]}>
            <SkeletonBlock width="68%" height={14} />
            <SkeletonBlock width="44%" height={11} />
          </View>
        ))}
      </View>
    </SkeletonBusy>
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
        <Button variant="ghost" onPress={onAction} style={styles.retry}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonSurface: {
    overflow: "hidden",
    borderRadius: theme.radii.owner,
    backgroundColor: theme.colors.surfaceContainerLowest,
  },
  skeletonRow: {
    minHeight: 64,
    justifyContent: "center",
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
  },
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
  retry: { minHeight: 48, width: "100%", maxWidth: 240 },
});
