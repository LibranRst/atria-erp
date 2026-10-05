import { StyleSheet, Text, View } from "react-native";

import { getBudgetGeometry } from "@atria/core/finance/budget-indicator";
import { formatShortIdr } from "@atria/core/utils/money";

import { theme } from "@/theme";

/**
 * Indikator split terpakai/tersisa. Port langsung dari `BudgetSplitIndicator`
 * web — geometri sama persis lewat `getBudgetGeometry` dari core, hanya warna
 * yang berbeda antara mode `inverse` (di atas kartu gelap) dan mode biasa.
 */
export function BudgetSplitIndicator({
  danger = false,
  inverse = false,
  remainingAmount,
  usedAmount,
  value,
}: {
  readonly danger?: boolean;
  readonly inverse?: boolean;
  readonly remainingAmount?: number;
  readonly usedAmount?: number;
  readonly value: number;
}): React.JSX.Element {
  const geometry = getBudgetGeometry(value);
  const usedColor = inverse
    ? danger
      ? theme.colors.criticalOnInverse
      : theme.colors.onSurfaceInverse
    : danger
      ? theme.colors.error
      : theme.colors.primary;
  const remainingColor = inverse ? theme.opacityColors.white10 : theme.colors.surfaceContainerHigh;
  const captionColor = inverse ? theme.colors.onSurfaceInverse : theme.colors.onSurfaceVariant;

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        {geometry.clampedPercentage > 0 ? (
          <View
            style={[
              styles.segment,
              { backgroundColor: usedColor, flex: geometry.clampedPercentage },
            ]}
          />
        ) : null}
        {geometry.remainingPercentage > 0 ? (
          <View
            style={[
              styles.segment,
              { backgroundColor: remainingColor, flex: geometry.remainingPercentage },
            ]}
          />
        ) : null}
        {geometry.overflowPercentage > 0 ? (
          <View style={[styles.overflowMarker, { backgroundColor: usedColor }]} />
        ) : null}
      </View>
      <View style={styles.captionRow}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          style={[styles.caption, { color: captionColor }]}
        >
          Terpakai {usedAmount === undefined ? "" : formatShortIdr(usedAmount)}
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          style={[styles.caption, { color: captionColor, textAlign: "right", flex: 1.3 }]}
        >
          {geometry.overflowPercentage > 0
            ? `Lebih ${geometry.overflowPercentage.toFixed(0)}%${remainingAmount === undefined ? "" : ` · ${formatShortIdr(Math.abs(remainingAmount))}`}`
            : `Tersisa ${geometry.remainingPercentage.toFixed(0)}%${remainingAmount === undefined ? "" : ` · ${formatShortIdr(remainingAmount)}`}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  captionRow: {
    flexDirection: "row",
    gap: theme.spacing.xs,
    justifyContent: "space-between",
    marginTop: theme.spacing.base,
  },
  caption: {
    fontFamily: theme.fonts.bold,
    flex: 1,
    minWidth: 0,
    ...theme.typography.meta,
  },
  // The owning surface already separates the value row from this component.
  container: { marginTop: theme.spacing.base },
  overflowMarker: {
    position: "absolute",
    top: -4,
    right: -2,
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  segment: { minWidth: 4, height: "100%", borderRadius: theme.radii.capsule },
  track: {
    flexDirection: "row",
    gap: theme.spacing.base,
    height: 8,
  },
});
