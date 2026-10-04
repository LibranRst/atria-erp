import { transitionSpringSmooth } from "@atria/tokens/motion";
import { Fragment, useLayoutEffect, useRef, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, withSpring } from "react-native-reanimated";
import { SheetOptionRow } from "./sheet-select";
import type { SelectOption } from "./sheet-select";
import { theme } from "@/theme";

export type ChoiceListProps = {
  readonly options: readonly SelectOption[];
  readonly value: string;
  readonly onSelect: (value: string) => void;
  readonly maxHeight: number;
  readonly emptyText?: string;
  readonly extra?: React.ReactNode;
};

export function ChoiceList({
  options,
  value,
  onSelect,
  maxHeight,
  emptyText = "Tidak ada pilihan yang cocok.",
  extra,
}: ChoiceListProps): React.JSX.Element {
  const [contentHeight, setContentHeight] = useState(Math.max(56, options.length * 56));
  const scroll = useRef<ScrollView>(null);
  useLayoutEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [options]);
  const reduced = useReducedMotion();
  const target = Math.min(maxHeight, contentHeight);
  const animated = useAnimatedStyle(() => ({
    height: reduced ? target : withSpring(target, transitionSpringSmooth),
  }));
  return (
    <Animated.View style={[styles.surface, animated]}>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        onContentSizeChange={(_width, height) => setContentHeight(Math.ceil(height))}
      >
        {options.length === 0 ? (
          <Text style={styles.empty}>{emptyText}</Text>
        ) : (
          options.map((option, index) => (
            <Fragment key={option.value}>
              {option.group && option.group !== options[index - 1]?.group ? (
                <Text style={styles.group}>{option.group}</Text>
              ) : null}
              {index > 0 && option.group === options[index - 1]?.group ? (
                <View style={styles.divider} />
              ) : null}
              <View>
                <SheetOptionRow
                  active={option.value === value}
                  onPress={() => {
                    if (!option.disabled) onSelect(option.value);
                  }}
                  option={option}
                />
              </View>
            </Fragment>
          ))
        )}
        {extra ? (
          <>
            {options.length > 0 ? <View style={styles.divider} /> : null}
            {extra}
          </>
        ) : null}
      </ScrollView>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  surface: {
    backgroundColor: theme.colors.surfaceContainerLowest,
    overflow: "hidden",
    flexShrink: 1,
  },
  content: { paddingVertical: theme.spacing.base },
  divider: {
    marginLeft: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.outlineVariant,
  },
  group: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: Platform.OS === "ios" ? undefined : theme.fonts.medium,
    fontWeight: "500",
    ...theme.typography.support,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.base,
  },
  empty: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    ...theme.typography.support,
    padding: theme.spacing.md,
    minHeight: 56,
  },
});
