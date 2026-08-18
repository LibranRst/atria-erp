import { calculateCenteredScrollLeft } from "@atria/core/presentation/segmented-tabs-scroll";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, withSpring } from "react-native-reanimated";

import { transitionSpringSnappy } from "@atria/tokens/motion";

import { AppIcon, type AppIconName } from "./app-icon";
import { theme } from "@/theme";

export type SegmentedTab<TValue extends string> = {
  readonly badge?: number;
  readonly icon?: AppIconName | string;
  readonly label: string;
  readonly value: TValue;
};

export function SegmentedTabs<TValue extends string>({
  accessibilityLabel,
  onChange,
  options,
  scrollable = false,
  style,
  value,
}: {
  readonly accessibilityLabel: string;
  readonly onChange: (value: TValue) => void;
  readonly options: readonly SegmentedTab<TValue>[];
  readonly scrollable?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly value: TValue;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [trackWidth, setTrackWidth] = useState(0);
  const availableWidth = Math.max(0, trackWidth - theme.spacing.xs);
  const segmentWidth = options.length > 0 ? availableWidth / options.length : 0;

  /**
   * Mode scrollable menarik tab aktif ke tengah, sama seperti web.
   *
   * Tanpa ini, tab yang berada di luar layar tidak pernah terbaca — strip-nya
   * terlihat terpotong di tengah kata, bukan terlihat bisa digeser. Posisi tiap
   * tab diukur lewat `onLayout` karena React Native tidak punya `offsetLeft`.
   */
  const scrollRef = useRef<ScrollView>(null);
  const tabLayouts = useRef(new Map<string, { x: number; width: number }>());
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  /**
   * Lebar tiap tab pada mode scrollable berbeda-beda, jadi pil aktif tidak bisa
   * dihitung dari `segmentWidth` seperti mode non-scrollable. Layout tab aktif
   * disimpan sebagai state supaya pil ikut berpindah dan melar mengikuti tab.
   */
  const [activeLayout, setActiveLayout] = useState<{ x: number; width: number } | null>(null);

  useEffect(() => {
    if (!scrollable) return;

    const layout = tabLayouts.current.get(value);
    if (layout) setActiveLayout(layout);
    if (!layout || viewportWidth === 0 || contentWidth === 0) return;

    scrollRef.current?.scrollTo({
      x: calculateCenteredScrollLeft({
        itemLeft: layout.x,
        itemWidth: layout.width,
        viewportWidth,
        scrollWidth: contentWidth,
      }),
      animated: !reduceMotion,
    });
  }, [contentWidth, reduceMotion, scrollable, value, viewportWidth]);

  const scrollIndicatorStyle = useAnimatedStyle(() => {
    if (!activeLayout) return { opacity: 0 };

    const spring = {
      stiffness: transitionSpringSnappy.stiffness,
      damping: transitionSpringSnappy.damping,
      mass: transitionSpringSnappy.mass,
    };

    return {
      opacity: 1,
      transform: [
        {
          translateX: reduceMotion ? activeLayout.x : withSpring(activeLayout.x, spring),
        },
      ],
      width: reduceMotion ? activeLayout.width : withSpring(activeLayout.width, spring),
    };
  });

  const indicatorStyle = useAnimatedStyle(() => {
    const target = activeIndex * segmentWidth;
    return {
      transform: [
        {
          translateX: reduceMotion
            ? target
            : withSpring(target, {
                stiffness: transitionSpringSnappy.stiffness,
                damping: transitionSpringSnappy.damping,
                mass: transitionSpringSnappy.mass,
              }),
        },
      ],
    };
  });
  const onLayout = (event: LayoutChangeEvent): void =>
    setTrackWidth(event.nativeEvent.layout.width);

  const tabs = options.map((option) => {
    const active = option.value === value;
    return (
      <Pressable
        key={option.value}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        hitSlop={2}
        onLayout={
          scrollable
            ? (event: LayoutChangeEvent) => {
                const { width, x } = event.nativeEvent.layout;
                tabLayouts.current.set(option.value, { width, x });
                if (active) setActiveLayout({ width, x });
              }
            : undefined
        }
        onPress={() => onChange(option.value)}
        style={[styles.tab, scrollable && styles.scrollTab]}
      >
        {option.icon ? (
          <AppIcon
            color={active ? theme.colors.onPrimary : theme.colors.onSurfaceVariant}
            name={option.icon}
            size={15}
          />
        ) : null}
        <Text numberOfLines={1} style={[styles.label, active && styles.activeLabel]}>
          {option.label}
        </Text>
        {typeof option.badge === "number" ? (
          <View style={[styles.badge, active && styles.activeBadge]}>
            <Text style={[styles.badgeLabel, active && styles.activeBadgeLabel]}>
              {option.badge > 99 ? "99+" : option.badge}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  });

  if (scrollable) {
    return (
      <ScrollView
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="tablist"
        contentContainerStyle={[styles.scrollContent, style]}
        horizontal
        onContentSizeChange={(width) => setContentWidth(width)}
        onLayout={(event: LayoutChangeEvent) => setViewportWidth(event.nativeEvent.layout.width)}
        ref={scrollRef}
        showsHorizontalScrollIndicator={false}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.indicator, styles.scrollIndicator, scrollIndicatorStyle]}
        />
        {tabs}
      </ScrollView>
    );
  }

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tablist"
      onLayout={onLayout}
      style={[styles.track, style]}
    >
      {trackWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.indicator, { width: segmentWidth }, indicatorStyle]}
        />
      ) : null}
      {tabs}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    minHeight: 48,
    flexDirection: "row",
    borderRadius: theme.radii.capsule,
    backgroundColor: theme.colors.surfaceContainerLow,
    padding: theme.spacing.base,
  },
  indicator: {
    position: "absolute",
    top: theme.spacing.base,
    bottom: theme.spacing.base,
    left: theme.spacing.base,
    borderRadius: theme.radii.capsule,
    backgroundColor: theme.colors.primary,
    boxShadow: theme.shadows.primary,
  },
  tab: {
    zIndex: 1,
    minWidth: 0,
    minHeight: 40,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: theme.radii.capsule,
    paddingHorizontal: theme.spacing.sm,
  },
  scrollContent: {
    minHeight: 48,
    flexDirection: "row",
    gap: theme.spacing.base,
    borderRadius: theme.radii.capsule,
    backgroundColor: theme.colors.surfaceContainerLow,
    padding: theme.spacing.base,
  },
  scrollIndicator: {
    // Pada mode scrollable `left` diatur lewat translateX hasil pengukuran,
    // jadi offset kirinya dinolkan agar tidak ditambahkan dua kali.
    left: 0,
  },
  scrollTab: { minWidth: 104, flex: 0 },
  label: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.support,
  },
  activeLabel: { color: theme.colors.onPrimary, fontFamily: theme.fonts.bold },
  badge: {
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: theme.colors.surfaceContainerHigh,
    paddingHorizontal: 4,
  },
  // Di atas pil ink, badge memakai putih transparan seperti web (`bg-white/12`).
  activeBadge: { backgroundColor: theme.opacityColors.white10 },
  badgeLabel: { color: theme.colors.onSurfaceVariant, fontFamily: theme.fonts.bold, fontSize: 8 },
  activeBadgeLabel: { color: theme.colors.onPrimary },
});
