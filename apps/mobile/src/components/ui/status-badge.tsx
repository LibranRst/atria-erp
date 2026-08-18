import { StyleSheet, Text, View } from "react-native";

import { resolveStatusPresentation } from "@atria/core/presentation/status-presentation";
import type { BadgeStatus, StatusBadgeTone } from "@atria/core/presentation/status-presentation";

import { theme } from "@/theme";

const toneStyle: Record<StatusBadgeTone, { backgroundColor: string; color: string }> = {
  healthy: { backgroundColor: theme.colors.surfaceContainerLow, color: theme.colors.onSurface },
  warning: {
    backgroundColor: theme.colors.warningContainer,
    color: theme.colors.warningOnContainer,
  },
  critical: { backgroundColor: theme.colors.criticalContainer, color: theme.colors.critical },
  pending: {
    backgroundColor: theme.colors.surfaceContainerLow,
    color: theme.colors.onSurfaceVariant,
  },
  completed: { backgroundColor: theme.colors.surfaceContainerLow, color: theme.colors.onSurface },
  neutral: {
    backgroundColor: theme.colors.surfaceContainer,
    color: theme.colors.onSurfaceVariant,
  },
  inactive: {
    backgroundColor: theme.colors.surfaceContainerLow,
    color: theme.colors.onSurfaceVariant,
  },
};

export function StatusBadge({
  label,
  marker = "auto",
  status,
  tone,
}: {
  readonly label?: string;
  readonly marker?: "auto" | boolean;
  readonly status: BadgeStatus | string;
  readonly tone?: StatusBadgeTone;
}): React.JSX.Element {
  const presentation = resolveStatusPresentation(status);
  const resolvedTone = tone ?? presentation.tone;
  const resolvedLabel = label ?? presentation.label;
  const colors = toneStyle[resolvedTone];
  const showMarker =
    marker === "auto"
      ? resolvedTone === "warning" || resolvedTone === "critical" || resolvedTone === "pending"
      : marker;

  return (
    <View
      accessibilityLabel={resolvedLabel}
      style={[styles.badge, { backgroundColor: colors.backgroundColor }]}
    >
      {showMarker ? <View style={[styles.marker, { backgroundColor: colors.color }]} /> : null}
      <Text numberOfLines={1} style={[styles.label, { color: colors.color }]}>
        {resolvedLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minHeight: 24,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: theme.radii.capsule,
    paddingHorizontal: 10,
  },
  marker: { width: 6, height: 6, borderRadius: 3 },
  label: {
    fontFamily: theme.fonts.bold,
    letterSpacing: 0.45,
    textTransform: "uppercase",
    ...theme.typography.eyebrow,
  },
});
