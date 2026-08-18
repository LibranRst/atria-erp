import { StyleSheet, Text, View } from "react-native";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";

import { formatIdr, formatShortIdr } from "@atria/core/utils/money";

import { theme } from "@/theme";

export type MoneyValueVariant = "compact" | "compactWithFull" | "fullDynamic";
export type MoneyValueTone =
  "default" | "primary" | "muted" | "warning" | "danger" | "success" | "inverse" | "inherit";
export type MoneyValueSize = "fit" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "hero";

const sizeStyle: Record<MoneyValueSize, TextStyle> = {
  fit: { fontSize: 12, lineHeight: 16 },
  xs: { fontSize: 10, lineHeight: 12 },
  sm: { fontSize: 12, lineHeight: 16 },
  md: { fontSize: 14, lineHeight: 19 },
  lg: { fontSize: 17, lineHeight: 22 },
  xl: { fontSize: 17, lineHeight: 22 },
  "2xl": { fontSize: 23, lineHeight: 28 },
  hero: { fontSize: 30, lineHeight: 36 },
};

const minimumScale: Record<MoneyValueSize, number> = {
  fit: 0.79,
  xs: 0.79,
  sm: 0.79,
  md: 0.74,
  lg: 0.63,
  xl: 0.63,
  "2xl": 0.56,
  hero: 0.56,
};

const toneColor: Record<MoneyValueTone, string | undefined> = {
  default: theme.colors.onSurface,
  primary: theme.colors.primary,
  muted: theme.colors.onSurfaceVariant,
  warning: theme.colors.warning,
  danger: theme.colors.error,
  success: theme.colors.success,
  inverse: theme.colors.onSurfaceInverse,
  inherit: undefined,
};

export function MoneyValue({
  align = "left",
  amount,
  prefix = "",
  size = "md",
  style,
  textStyle,
  tone = "default",
  variant,
}: {
  readonly align?: "left" | "center" | "right";
  readonly amount: number;
  readonly prefix?: string;
  readonly size?: MoneyValueSize;
  readonly style?: StyleProp<ViewStyle>;
  readonly textStyle?: StyleProp<TextStyle>;
  readonly tone?: MoneyValueTone;
  readonly variant: MoneyValueVariant;
}): React.JSX.Element {
  const compactValue = `${prefix}${formatShortIdr(amount)}`;
  const fullValue = `${prefix}${formatIdr(amount)}`;
  const displayedValue = variant === "fullDynamic" ? fullValue : compactValue;
  const textAlign = align;

  return (
    <View style={[styles.container, style]} accessibilityLabel={fullValue}>
      <Text
        selectable
        adjustsFontSizeToFit
        minimumFontScale={minimumScale[size]}
        numberOfLines={1}
        style={[styles.primary, sizeStyle[size], { color: toneColor[tone], textAlign }, textStyle]}
      >
        {displayedValue}
      </Text>
      {variant === "compactWithFull" && compactValue !== fullValue ? (
        <Text
          selectable
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          numberOfLines={1}
          style={[
            styles.exact,
            {
              color: tone === "inverse" ? theme.opacityColors.white88 : theme.colors.muted,
              textAlign,
            },
          ]}
        >
          {fullValue}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minWidth: 0 },
  primary: {
    fontFamily: theme.fonts.extrabold,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.4,
  },
  exact: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    lineHeight: 14,
    fontVariant: ["tabular-nums"],
    marginTop: 2,
  },
});
