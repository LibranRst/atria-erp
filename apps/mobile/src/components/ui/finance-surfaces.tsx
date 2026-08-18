import { StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

import { MoneyValue } from "./money-value";
import { theme } from "@/theme";

export function SummarySurface({
  amount,
  children,
  label,
  style,
}: {
  readonly amount: number;
  readonly children?: React.ReactNode;
  readonly label: string;
  readonly style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return (
    <View style={[styles.summary, style]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <MoneyValue amount={amount} size="2xl" variant="compactWithFull" />
      {children}
    </View>
  );
}

export function MetricPill({
  amount,
  format = "money",
  label,
  tone = "default",
}: {
  readonly amount: number;
  /**
   * `count` untuk metrik yang bukan uang (jumlah item, jumlah isu). Tanpa ini
   * angka seperti 3 item akan terbaca "Rp 3" — salah arti di layar finansial.
   */
  readonly format?: "money" | "count";
  readonly label: string;
  readonly tone?: "default" | "warning" | "danger";
}): React.JSX.Element {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      {format === "count" ? (
        <Text style={[styles.metricCount, tone !== "default" && metricCountTone[tone]]}>
          {new Intl.NumberFormat("id-ID").format(amount)}
        </Text>
      ) : (
        <MoneyValue amount={amount} size="sm" tone={tone} variant="compactWithFull" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: theme.spacing.xs,
    borderRadius: theme.radii.owner,
    backgroundColor: theme.colors.surfaceContainerLowest,
    padding: theme.spacing.lg,
    boxShadow: theme.shadows.surface,
  },
  summaryLabel: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.support,
  },
  metric: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.base,
    borderRadius: theme.radii.icon,
    backgroundColor: theme.colors.surfaceContainerLow,
    padding: theme.spacing.sm,
  },
  metricLabel: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.meta,
  },
  metricCount: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    fontVariant: ["tabular-nums"],
    ...theme.typography.row,
  },
  metricCountWarning: { color: theme.colors.warningOnContainer },
  metricCountDanger: { color: theme.colors.critical },
});

const metricCountTone = {
  danger: styles.metricCountDanger,
  warning: styles.metricCountWarning,
} as const;
