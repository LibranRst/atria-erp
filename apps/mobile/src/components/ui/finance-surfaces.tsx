import { StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

import { MoneyValue } from "./money-value";
import { DuotoneIconTile } from "./duotone-icon-tile";
import { StatusBadge } from "./status-badge";
import { theme } from "@/theme";

export function SummarySurface({
  amount,
  accessibilityLabel,
  action,
  children,
  eyebrow,
  icon,
  label,
  status,
  statusTone = "neutral",
  style,
}: {
  readonly amount?: number;
  readonly accessibilityLabel?: string;
  readonly action?: React.ReactNode;
  readonly children?: React.ReactNode;
  readonly eyebrow?: string;
  readonly icon?: string;
  readonly label?: string;
  readonly status?: string;
  readonly statusTone?: "critical" | "warning" | "positive" | "neutral";
  readonly style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const title = eyebrow ?? label;
  if (!eyebrow && !icon && !status && !action) {
    return (
      <View style={[styles.legacySummary, style]} accessibilityLabel={accessibilityLabel ?? label}>
        <Text style={styles.legacySummaryLabel}>{label}</Text>
        {typeof amount === "number" ? (
          <MoneyValue amount={amount} size="2xl" variant="compactWithFull" />
        ) : null}
        {children}
      </View>
    );
  }
  return (
    <View style={[styles.summary, style]} accessibilityLabel={accessibilityLabel ?? title}>
      <View style={styles.summaryHeader}>
        <View style={styles.summaryIdentity}>
          {icon ? <DuotoneIconTile name={icon} iconSize={16} style={styles.summaryIcon} /> : null}
          <Text numberOfLines={1} style={styles.summaryLabel}>
            {title}
          </Text>
        </View>
        {action ??
          (status ? (
            <StatusBadge
              status={status}
              label={status}
              tone={statusTone === "positive" ? "healthy" : statusTone}
            />
          ) : null)}
      </View>
      <View style={styles.summaryContent}>
        {typeof amount === "number" ? (
          <View style={styles.summaryAmount}>
            <MoneyValue amount={amount} size="2xl" variant="fullDynamic" />
          </View>
        ) : null}
        {children}
      </View>
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
  legacySummary: {
    gap: theme.spacing.xs,
    borderRadius: theme.radii.owner,
    backgroundColor: theme.colors.surfaceContainerLowest,
    padding: theme.spacing.lg,
    boxShadow: theme.shadows.surface,
  },
  legacySummaryLabel: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.support,
  },
  summary: {
    gap: theme.spacing.base,
    borderRadius: theme.radii.owner,
    borderCurve: "continuous",
    backgroundColor: theme.colors.surfaceContainerLowest,
    padding: theme.spacing.xs,
    boxShadow: theme.shadows.surface,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.base,
  },
  summaryIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    flex: 1,
    minWidth: 0,
  },
  summaryIcon: { width: 32, height: 32 },
  summaryContent: {
    overflow: "hidden",
    borderRadius: theme.radii.inset,
    backgroundColor: theme.colors.surfaceContainerLow,
  },
  summaryAmount: { padding: theme.spacing.sm },
  summaryLabel: {
    flexShrink: 1,
    color: theme.colors.muted,
    fontFamily: theme.fonts.bold,
    ...theme.typography.eyebrow,
    textTransform: "uppercase",
    letterSpacing: 1,
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
