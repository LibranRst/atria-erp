import { Children } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";

import { theme } from "@/theme";

export function GroupedSurface({
  children,
  style,
}: {
  readonly children: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return (
    <View style={[styles.surface, style]}>
      {Children.toArray(children).map((child, index) => (
        <View key={index} style={index > 0 ? styles.divider : undefined}>
          {child}
        </View>
      ))}
    </View>
  );
}

export function FactRow({
  label,
  value,
  valueStyle,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
  readonly valueStyle?: StyleProp<TextStyle>;
}): React.JSX.Element {
  return (
    <View
      style={styles.factRow}
      accessibilityLabel={typeof value === "string" ? `${label}, ${value}` : label}
    >
      <Text style={styles.factLabel}>{label}</Text>
      {typeof value === "string" || typeof value === "number" ? (
        <Text selectable numberOfLines={1} style={[styles.factValue, valueStyle]}>
          {value}
        </Text>
      ) : (
        <View style={styles.factSlot}>{value}</View>
      )}
    </View>
  );
}

export function SummaryFact({
  label,
  tone = "default",
  value,
}: {
  readonly label: string;
  readonly tone?: "default" | "warning" | "critical";
  readonly value: string;
}): React.JSX.Element {
  return (
    <View style={styles.summaryFact} accessibilityLabel={`${label}, ${value}`}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        selectable
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        style={[
          styles.summaryValue,
          tone === "warning" && styles.warning,
          tone === "critical" && styles.critical,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    overflow: "hidden",
    borderRadius: theme.radii.owner,
    backgroundColor: theme.colors.surfaceContainerLowest,
    boxShadow: theme.shadows.surface,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.opacityColors.outlineVariant20,
  },
  factRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  factLabel: {
    flex: 1,
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.medium,
    ...theme.typography.support,
  },
  factValue: {
    maxWidth: "58%",
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
    ...theme.typography.support,
  },
  factSlot: { maxWidth: "58%", alignItems: "flex-end" },
  summaryFact: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    borderRadius: theme.radii.icon,
    backgroundColor: theme.colors.surfaceContainerLow,
    padding: theme.spacing.sm,
  },
  summaryLabel: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.semibold,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    ...theme.typography.meta,
  },
  summaryValue: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    fontSize: theme.typography.section.fontSize,
    lineHeight: theme.typography.section.lineHeight,
    marginTop: theme.spacing.base,
    fontVariant: ["tabular-nums"],
  },
  warning: { color: theme.colors.warningOnContainer },
  critical: { color: theme.colors.critical },
});
