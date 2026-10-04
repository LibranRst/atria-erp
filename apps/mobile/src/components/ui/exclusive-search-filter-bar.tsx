import { transitionSpringSnappy } from "@atria/tokens/motion";
import { useLayoutEffect, useRef, useState } from "react";
import { Keyboard, StyleSheet, TextInput as NativeTextInput, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { ChromeButton } from "./chrome-button";
import { TextInput } from "./text-input";
import { theme } from "@/theme";

export type ExclusiveSearchFilterBarProps = {
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly children: React.ReactNode;
  readonly onOpenChange?: (open: boolean) => void;
  readonly searchPlaceholder?: string;
  readonly accessibilityLabel?: string;
};

/** The rail keeps one geometry while search grows from its native trigger. */
export function ExclusiveSearchFilterBar({
  query,
  onQueryChange,
  children,
  onOpenChange,
  searchPlaceholder = "Cari...",
  accessibilityLabel = "Cari",
}: ExclusiveSearchFilterBarProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(0);
  const input = useRef<NativeTextInput>(null);
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  useLayoutEffect(() => {
    progress.set(
      reducedMotion
        ? Number(open)
        : withSpring(Number(open), {
            stiffness: transitionSpringSnappy.stiffness,
            damping: transitionSpringSnappy.damping,
            mass: transitionSpringSnappy.mass,
            overshootClamping: true,
          }),
    );
    if (!open) return undefined;
    const frame = requestAnimationFrame(() => input.current?.focus());
    return (): void => cancelAnimationFrame(frame);
  }, [open, reducedMotion, progress]);
  const searchStyle = useAnimatedStyle(() => ({
    left: Math.max(0, width - 48) * (1 - progress.get()),
    width: 48 + Math.max(0, width - 48) * progress.get(),
    opacity: progress.get(),
  }));
  const close = (): void => {
    input.current?.blur();
    Keyboard.dismiss();
    onQueryChange("");
    setOpen(false);
    onOpenChange?.(false);
  };
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.rail}>
      <View
        accessibilityElementsHidden={open}
        importantForAccessibility={open ? "no-hide-descendants" : "auto"}
        pointerEvents={open ? "none" : "auto"}
        style={[styles.filters, open && styles.hidden]}
      >
        {children}
      </View>
      {!open ? (
        <View style={styles.trigger}>
          <ChromeButton
            label={accessibilityLabel}
            icon="search"
            systemImage="magnifyingglass"
            onPress={() => {
              setOpen(true);
              onOpenChange?.(true);
            }}
          />
        </View>
      ) : null}
      <Animated.View
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? "auto" : "no-hide-descendants"}
        pointerEvents={open ? "auto" : "none"}
        style={[styles.search, searchStyle]}
      >
        <TextInput
          ref={input}
          accessibilityLabel={accessibilityLabel}
          autoCapitalize="none"
          autoCorrect={false}
          editable={open}
          onChangeText={onQueryChange}
          placeholder={searchPlaceholder}
          returnKeyType="search"
          onSubmitEditing={() => input.current?.blur()}
          style={styles.input}
          value={query}
        />
        <ChromeButton
          label="Tutup pencarian"
          icon="close"
          systemImage="xmark"
          surface={false}
          onPress={close}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { minWidth: 0, position: "relative", height: 48 },
  filters: { minWidth: 0, height: 48, paddingRight: 56, justifyContent: "center" },
  hidden: { opacity: 0 },
  trigger: { position: "absolute", right: 0, top: 0 },
  search: {
    position: "absolute",
    top: 0,
    height: 48,
    borderRadius: theme.radii.capsule,
    backgroundColor: theme.colors.surfaceContainerLowest,
    boxShadow: theme.shadows.control,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    borderWidth: 0,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: "transparent",
    boxShadow: "none",
  },
});
