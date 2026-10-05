import { Children } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";

import { theme } from "@/theme";
import { MoneyValue } from "./money-value";
import type { MoneyValueVariant } from "./money-value";

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

export function RowGroup({
  children,
  connected = false,
}: {
  readonly children: React.ReactNode;
  readonly connected?: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.rows}>
      {connected ? <View pointerEvents="none" style={styles.timeline} /> : null}
      {Children.toArray(children).map((child, index) => (
        <View key={index} style={!connected && index > 0 ? styles.divider : undefined}>
          {child}
        </View>
      ))}
    </View>
  );
}

export function SummaryFact({
  amount,
  children,
  label,
  tone = "default",
  value,
  variant = "fullDynamic",
}: {
  readonly amount?: number;
  readonly children?: React.ReactNode;
  readonly label: string;
  readonly tone?: "default" | "warning" | "critical" | "danger" | "positive";
  readonly value?: string;
  readonly variant?: MoneyValueVariant;
}): React.JSX.Element {
  return (
    <View style={styles.summaryFact} accessibilityLabel={value ? `${label}, ${value}` : label}>
      <Text
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        style={styles.summaryLabel}
      >
        {label}
      </Text>
      {children ??
        (amount !== undefined ? (
          <MoneyValue
            amount={amount}
            variant={variant}
            size="md"
            tone={tone === "critical" ? "danger" : tone === "positive" ? "success" : tone}
          />
        ) : (
          <Text
            selectable
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            style={[
              styles.summaryValue,
              tone === "warning" && styles.warning,
              (tone === "critical" || tone === "danger") && styles.critical,
            ]}
          >
            {value}
          </Text>
        ))}
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
  rows: { position: "relative" },
  timeline: {
    position: "absolute",
    left: 44,
    top: theme.spacing.md,
    bottom: theme.spacing.md,
    width: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.outlineVariant,
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
    borderRadius: theme.radii.inset,
    backgroundColor: theme.colors.surfaceContainerLowest,
    padding: theme.spacing.xs,
    gap: theme.spacing.base,
  },
  summaryLabel: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.bold,
    ...theme.typography.eyebrow,
    textTransform: "uppercase",
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
