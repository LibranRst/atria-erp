import { buildCalendarMonth, calendarMonthOf } from "@atria/core/presentation/calendar-month";
import { formatDateOnly } from "@atria/core/presentation/date-only";
import { transitionEaseSmooth } from "@atria/tokens/motion";
import { Host } from "@expo/ui";
import { Button as NativeButton, HStack, Text as NativeText, VStack } from "@expo/ui/swift-ui";
import {
  accessibilityAddTraits,
  accessibilityHidden,
  accessibilityLabel,
  background,
  buttonBorderShape,
  buttonStyle,
  contentShape,
  controlSize,
  disabled,
  font,
  foregroundColor,
  frame,
  shapes,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
} from "react-native-reanimated";
import type { CalendarContentProps } from "./calendar-content.types";
import { ChromeButton } from "./chrome-button";
import { theme } from "@/theme";

const WEEKDAYS = ["MIN", "SEN", "SEL", "RAB", "KAM", "JUM", "SAB"] as const;

/** Web calendar composition with native date actions; the shared dialog owns dismissal. */
export function CalendarContent({
  value,
  month,
  onMonthChange,
  onChange,
  minimumDate,
  maximumDate,
}: CalendarContentProps): React.JSX.Element {
  const viewport = useWindowDimensions();
  const [width, setWidth] = useState(Math.min(340, viewport.width - 32) - 16);
  const calendar = buildCalendarMonth({
    month: month ?? calendarMonthOf(value),
    selected: value,
    today: formatDateOnly(new Date()),
    minimumDate,
    maximumDate,
  });
  const gridWidth = Math.max(1, width - 16);
  const cellWidth = (gridWidth - 6 * theme.spacing.base) / 7;
  // Calendar cells follow the web's seven-column squares; action buttons keep native targets.
  const dayHeight = Math.max(
    cellWidth,
    Math.ceil(theme.typography.row.lineHeight * viewport.fontScale + theme.spacing.xs),
  );
  const gridHeight =
    calendar.rows.length * dayHeight + (calendar.rows.length - 1) * theme.spacing.base;
  const reduceMotion = useReducedMotion();
  const gridStyle = useAnimatedStyle(() => ({
    height: reduceMotion
      ? gridHeight
      : withTiming(gridHeight, {
          duration: transitionEaseSmooth.duration * 1000,
          easing: Easing.bezier(...transitionEaseSmooth.ease),
        }),
  }));
  return (
    <View
      onLayout={(event) => {
        const measured = event.nativeEvent.layout.width;
        if (measured > 0) setWidth(measured);
      }}
    >
      <View style={styles.month}>
        <ChromeButton
          icon="caret-left"
          systemImage="chevron.left"
          label="Bulan sebelumnya"
          surfaceStyle="tonal"
          visualSize={40}
          disabled={!calendar.canPrevious}
          onPress={() => onMonthChange?.(calendar.previousMonth)}
        />
        <Text accessibilityRole="header" style={styles.monthLabel}>
          {calendar.label}
        </Text>
        <ChromeButton
          icon="caret-right"
          systemImage="chevron.right"
          label="Bulan berikutnya"
          surfaceStyle="tonal"
          visualSize={40}
          disabled={!calendar.canNext}
          onPress={() => onMonthChange?.(calendar.nextMonth)}
        />
      </View>
      <View style={styles.grid}>
        <View accessibilityElementsHidden style={styles.weekdays}>
          {WEEKDAYS.map((day) => (
            <Text key={day} style={[styles.weekday, { width: cellWidth }]}>
              {day}
            </Text>
          ))}
        </View>
        <Animated.View style={[styles.dates, gridStyle]}>
          <Host
            style={{ width: gridWidth, height: gridHeight }}
            colorScheme="light"
            ignoreSafeArea="all"
          >
            <VStack spacing={theme.spacing.base}>
              {calendar.rows.map((row, rowIndex) => (
                <HStack key={rowIndex} spacing={theme.spacing.base}>
                  {row.map((day, column) =>
                    day ? (
                      <NativeButton
                        key={day.value}
                        onPress={day.disabled ? undefined : () => onChange(day.value)}
                        modifiers={[
                          buttonStyle(day.selected ? "glassProminent" : "plain"),
                          buttonBorderShape("circle"),
                          controlSize("small"),
                          tint(theme.colors.primary),
                          frame({ width: cellWidth, height: dayHeight }),
                          contentShape(shapes.rectangle()),
                          disabled(day.disabled),
                          accessibilityLabel(day.label),
                          ...(day.selected ? [accessibilityAddTraits(["isSelected"])] : []),
                        ]}
                      >
                        <NativeText
                          modifiers={[
                            font({
                              size: theme.typography.row.fontSize,
                              textStyle: "footnote",
                              weight: "bold",
                            }),
                            foregroundColor(
                              day.selected
                                ? theme.colors.onPrimary
                                : day.today
                                  ? theme.colors.accent
                                  : theme.colors.onSurface,
                            ),
                            ...(!day.selected
                              ? [
                                  frame({
                                    width: cellWidth,
                                    height: Math.min(cellWidth, dayHeight),
                                  }),
                                ]
                              : []),
                            ...(day.today && !day.selected
                              ? [background(theme.colors.surfaceContainerLow, shapes.circle())]
                              : []),
                          ]}
                        >
                          {String(day.day)}
                        </NativeText>
                      </NativeButton>
                    ) : (
                      <NativeText
                        key={`blank-${rowIndex}-${column}`}
                        modifiers={[
                          frame({ width: cellWidth, height: dayHeight }),
                          accessibilityHidden(true),
                        ]}
                      >
                        {""}
                      </NativeText>
                    ),
                  )}
                </HStack>
              ))}
            </VStack>
          </Host>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  month: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.base,
  },
  monthLabel: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    textAlign: "center",
    textTransform: "capitalize",
    fontFamily: theme.fonts.bold,
    color: theme.colors.onSurface,
    ...theme.typography.row,
  },
  grid: { paddingHorizontal: theme.spacing.xs, paddingVertical: theme.spacing.xs },
  weekdays: { flexDirection: "row", gap: theme.spacing.base },
  weekday: {
    paddingVertical: theme.spacing.base,
    textAlign: "center",
    fontFamily: theme.fonts.bold,
    color: theme.colors.onSurfaceVariant,
    ...theme.typography.eyebrow,
  },
  dates: { marginTop: theme.spacing.base, overflow: "hidden" },
});
