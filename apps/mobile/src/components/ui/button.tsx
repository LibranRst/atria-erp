import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { PressableProps, StyleProp, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, withSpring } from "react-native-reanimated";

import { transitionSpringSnappy } from "@atria/tokens/motion";

import { theme } from "@/theme";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const variantStyle: Record<ButtonVariant, { backgroundColor: string; color: string }> = {
  primary: { backgroundColor: theme.colors.primary, color: theme.colors.onPrimary },
  secondary: {
    backgroundColor: theme.colors.surfaceContainerLowest,
    color: theme.colors.onSurface,
  },
  ghost: { backgroundColor: "transparent", color: theme.colors.onSurface },
  danger: { backgroundColor: theme.colors.critical, color: theme.colors.onCritical },
};

export function Button({
  children,
  disabled,
  leading,
  loading = false,
  style,
  variant = "primary",
  ...props
}: Omit<PressableProps, "children" | "style"> & {
  readonly children: string;
  readonly leading?: React.ReactNode;
  readonly loading?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly variant?: ButtonVariant;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const palette = variantStyle[variant];
  const unavailable = disabled || loading;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: reduceMotion
          ? 1
          : withSpring(pressed ? 0.97 : 1, {
              stiffness: transitionSpringSnappy.stiffness,
              damping: transitionSpringSnappy.damping,
              mass: transitionSpringSnappy.mass,
            }),
      },
    ],
  }));

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        {...props}
        accessibilityRole="button"
        accessibilityState={{ disabled: unavailable, busy: loading }}
        disabled={unavailable}
        hitSlop={4}
        onPressIn={(event) => {
          setPressed(true);
          props.onPressIn?.(event);
        }}
        onPressOut={(event) => {
          setPressed(false);
          props.onPressOut?.(event);
        }}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: palette.backgroundColor },
          variant === "secondary" && styles.secondary,
          unavailable && styles.disabled,
          pressed && reduceMotion && styles.pressed,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={palette.color} size="small" />
        ) : (
          <View style={styles.content}>
            {leading}
            <Text numberOfLines={1} style={[styles.label, { color: palette.color }]}>
              {children}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radii.capsule,
    paddingHorizontal: 20,
    boxShadow: theme.shadows.primary,
  },
  secondary: { boxShadow: theme.shadows.control },
  content: {
    maxWidth: "100%",
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  label: { minWidth: 0, flexShrink: 1, fontFamily: theme.fonts.bold, ...theme.typography.row },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.82 },
});
