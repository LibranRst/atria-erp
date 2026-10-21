import { StyleSheet, View, Text } from "react-native";
import { MoneyValue, BudgetSplitIndicator } from "@/components/ui";
import { theme } from "@/theme";
import type { DashboardOverview } from "./types";

export function FinancialPosition({
  summary,
}: {
  readonly summary: DashboardOverview["summary"];
}): React.JSX.Element {
  const overBudget = summary.remainingBudget < 0 || summary.usedPercentage >= 100;
  return (
    <View style={styles.surface}>
      <Text style={styles.label}>Kas tersedia</Text>
      <MoneyValue amount={summary.cashAvailable} size="hero" tone="inverse" variant="fullDynamic" />
      <View style={styles.metrics}>
        <InverseMetric label="Piutang" amount={summary.receivablesOutstanding} />
        <InverseMetric label="Hutang" amount={summary.payablesOutstanding} />
        <InverseMetric
          label="≤ 7 hari"
          amount={summary.payablesDueSoon}
          danger={summary.payablesDueSoon > summary.cashAvailable}
        />
      </View>
      <View style={styles.budget}>
        <View style={styles.margin}>
          <Text style={styles.metricLabel}>Budget aktif terpakai</Text>
          <Text style={styles.metricLabel}>Sisa budget</Text>
        </View>
        <View style={styles.margin}>
          <Text selectable style={[styles.marginValue, overBudget && styles.danger]}>
            {summary.usedPercentage.toFixed(1)}%
          </Text>
          <MoneyValue
            amount={summary.remainingBudget}
            variant="compact"
            size="sm"
            align="right"
            tone="inverse"
            textStyle={overBudget ? styles.danger : undefined}
          />
        </View>
        {summary.internalBudget > 0 ? (
          <BudgetSplitIndicator
            danger={overBudget}
            inverse
            remainingAmount={summary.remainingBudget}
            usedAmount={summary.actualCost}
            value={summary.usedPercentage}
          />
        ) : (
          <Text style={styles.label}>Belum ada budget project aktif.</Text>
        )}
        <View style={styles.margin}>
          <Text style={styles.footerLabel}>Project aktif</Text>
          <Text selectable style={styles.footerLabel}>
            Margin proyeksi {summary.projectedMarginPercentage.toFixed(1)}%
          </Text>
        </View>
      </View>
    </View>
  );
}

function InverseMetric({
  label,
  amount,
  danger = false,
}: {
  readonly label: string;
  readonly amount: number;
  readonly danger?: boolean;
}): React.JSX.Element {
  return (
    <View style={[styles.metric, styles.inset]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <MoneyValue
        amount={amount}
        size="sm"
        tone="inverse"
        variant="compact"
        textStyle={danger ? styles.danger : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    backgroundColor: theme.colors.surfaceInverse,
    borderRadius: theme.radii.owner,
    borderCurve: "continuous",
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    boxShadow: theme.shadows.inverse,
  },
  label: {
    color: theme.opacityColors.white88,
    fontFamily: theme.fonts.medium,
    ...theme.typography.eyebrow,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  metrics: { flexDirection: "row", gap: theme.spacing.xs },
  metric: { flex: 1, minWidth: 0, gap: theme.spacing.base },
  inset: {
    borderRadius: theme.radii.inset,
    backgroundColor: theme.opacityColors.white10,
    padding: theme.spacing.sm,
  },
  metricLabel: {
    color: theme.opacityColors.white88,
    fontFamily: theme.fonts.medium,
    ...theme.typography.eyebrow,
    textTransform: "uppercase",
  },
  budget: {
    marginTop: theme.spacing.xs,
    padding: theme.spacing.sm,
    gap: theme.spacing.xs,
    borderRadius: theme.radii.inset,
    backgroundColor: theme.opacityColors.white10,
  },
  budgetTitle: {
    color: theme.colors.onSurfaceInverse,
    fontFamily: theme.fonts.bold,
    ...theme.typography.support,
  },
  footerLabel: {
    color: theme.opacityColors.white88,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.meta,
    flexShrink: 1,
  },
  margin: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  marginValue: {
    color: theme.colors.onSurfaceInverse,
    fontFamily: theme.fonts.bold,
    ...theme.typography.row,
    fontVariant: ["tabular-nums"],
  },
  danger: { color: theme.colors.criticalOnInverse },
});
