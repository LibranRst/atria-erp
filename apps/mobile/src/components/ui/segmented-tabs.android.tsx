import { Host } from "@expo/ui";
import { SegmentedButton, SingleChoiceSegmentedButtonRow, Text } from "@expo/ui/jetpack-compose";
import { defaultMinSize, fillMaxWidth, horizontalScroll } from "@expo/ui/jetpack-compose/modifiers";

import { theme } from "@/theme";
import type { SegmentedTabsProps } from "./segmented-tabs.shared";

export type { SegmentedTab, SegmentedTabsProps } from "./segmented-tabs.shared";

export function SegmentedTabs<TValue extends string>({
  accessibilityLabel,
  onChange,
  options,
  scrollable = false,
  style,
  value,
}: SegmentedTabsProps<TValue>): React.JSX.Element {
  return (
    <Host
      accessibilityLabel={accessibilityLabel}
      colorScheme="light"
      matchContents={{ vertical: true }}
      seedColor={theme.colors.primary}
      style={[{ minHeight: 48, width: "100%" }, style]}
    >
      <SingleChoiceSegmentedButtonRow
        modifiers={[scrollable ? horizontalScroll() : fillMaxWidth()]}
      >
        {options.map((option) => (
          <SegmentedButton
            key={option.value}
            enabled={!option.disabled}
            selected={option.value === value}
            onClick={(): void => onChange(option.value)}
            modifiers={[defaultMinSize({ minHeight: 48, minWidth: 48 })]}
            colors={{
              activeContainerColor: theme.colors.primary,
              activeContentColor: theme.colors.onPrimary,
              inactiveContainerColor: theme.colors.surfaceContainerLowest,
              inactiveContentColor: theme.colors.onSurface,
              activeBorderColor: theme.colors.primary,
              inactiveBorderColor: theme.colors.outlineVariant,
            }}
          >
            <SegmentedButton.Label>
              <Text>{option.label}</Text>
            </SegmentedButton.Label>
          </SegmentedButton>
        ))}
      </SingleChoiceSegmentedButtonRow>
    </Host>
  );
}
