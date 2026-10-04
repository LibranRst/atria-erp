import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View } from "react-native";
import type { ViewProps } from "react-native";
import { theme } from "@/theme";

export function ChromeSurface({ children, style, ...props }: ViewProps): React.JSX.Element {
  const [reduceTransparency, setReduceTransparency] = useState(true);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let active = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((enabled) => {
      if (active) setReduceTransparency(enabled);
    });
    const listener = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduceTransparency,
    );
    return () => {
      active = false;
      listener.remove();
    };
  }, []);
  if (Platform.OS === "ios" && !reduceTransparency && isLiquidGlassAvailable()) {
    return (
      <GlassView
        {...props}
        colorScheme="light"
        glassEffectStyle="regular"
        tintColor={theme.chrome.lightGlassTint}
        isInteractive
        style={[styles.shape, style]}
      >
        {children}
      </GlassView>
    );
  }
  return (
    <View {...props} style={[styles.shape, styles.solid, style]}>
      {children}
    </View>
  );
}
const styles = StyleSheet.create({
  shape: { borderRadius: theme.radii.capsule, overflow: "hidden" },
  solid: { backgroundColor: theme.colors.surfaceContainerLowest, boxShadow: theme.shadows.control },
});
