import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { ButtonProps, ButtonVariant } from "./button.types";
import { useButtonSize } from "./button-size-context";
import { theme } from "@/theme";

export type { ButtonProps, ButtonSize, ButtonVariant } from "./button.types";

const palettes: Record<ButtonVariant, { backgroundColor: string; color: string }> = {
  primary: { backgroundColor: theme.colors.accent, color: theme.colors.onPrimary },
  secondary: { backgroundColor: theme.colors.surfaceContainerLowest, color: theme.colors.accent },
  ghost: { backgroundColor: "transparent", color: theme.colors.accent },
  danger: { backgroundColor: theme.colors.critical, color: theme.colors.onCritical },
  section: {
    backgroundColor: "transparent",
    color: theme.colors.onSurfaceVariant,
  },
};

/** Browser fallback; iOS and Android resolve their native platform siblings. */
export function Button({
  children,
  leading,
  trailing,
  loading = false,
  disabled = false,
  variant = "primary",
  size,
  style,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  testID,
}: ButtonProps): React.JSX.Element {
  const unavailable = disabled || loading;
  const resolvedSize = useButtonSize(size);
  const palette = palettes[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ ...accessibilityState, disabled: unavailable, busy: loading }}
      disabled={unavailable}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        resolvedSize === "compact" && styles.compact,
        variant === "section" && styles.section,
        resolvedSize === "sheet" && styles.sheet,
        { backgroundColor: palette.backgroundColor },
        style,
        (unavailable || pressed) && styles.dimmed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.color} />
      ) : leading ? (
        <View
          pointerEvents="none"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.leading}
        >
          {leading}
        </View>
      ) : null}
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          resolvedSize === "compact" && styles.compactLabel,
          resolvedSize === "sheet" && styles.sheetLabel,
          { color: palette.color },
        ]}
      >
        {children}
      </Text>
      {trailing ? (
        <View
          pointerEvents="none"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.leading}
        >
          {trailing}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    minWidth: 48,
    borderRadius: theme.radii.capsule,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  label: { flexShrink: 1, fontSize: 16, fontWeight: "600" },
  compact: { flexGrow: 0, flexShrink: 0, alignSelf: "flex-start", paddingHorizontal: 8 },
  compactLabel: { fontSize: 13 },
  section: { paddingHorizontal: 0, gap: 4 },
  sheet: { minHeight: 52, paddingHorizontal: 24 },
  sheetLabel: { fontSize: 17 },
  leading: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  dimmed: { opacity: 0.5 },
});
