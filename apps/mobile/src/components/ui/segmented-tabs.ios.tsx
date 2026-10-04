import { AtriaNativeSegmentedTabsView } from "../../../modules/atria-native-dock/src/atria-native-segmented-tabs-view";
import type { SegmentedTabsProps } from "./segmented-tabs.shared";
import { transitionEaseSmooth, transitionSpringBouncy } from "@atria/tokens/motion";
import { useWindowDimensions } from "react-native";
import { theme } from "@/theme";

export type { SegmentedTab, SegmentedTabsProps } from "./segmented-tabs.shared";

const symbols: Readonly<Record<string, string>> = {
  space_dashboard: "square.grid.2x2",
  approval: "checkmark.seal",
  monitoring: "chart.xyaxis.line",
  event_busy: "calendar.badge.clock",
  account_balance: "building.columns",
  inventory_2: "shippingbox",
};

export function SegmentedTabs<TValue extends string>({
  accessibilityLabel,
  onChange,
  options,
  scrollable = false,
  style,
  value,
}: SegmentedTabsProps<TValue>): React.JSX.Element {
  const { fontScale } = useWindowDimensions();
  return (
    <AtriaNativeSegmentedTabsView
      controlLabel={accessibilityLabel}
      options={options.map((option) => ({
        id: option.value,
        label: option.label,
        symbol: option.icon ? (symbols[option.icon] ?? option.icon) : "",
        badge: option.badge ?? -1,
        disabled: option.disabled ?? false,
      }))}
      selectedId={value}
      scrollable={scrollable}
      activeColor={theme.colors.primary}
      motion={{ ...transitionSpringBouncy, duration: transitionEaseSmooth.duration }}
      style={[{ minHeight: 48, height: Math.max(48, Math.ceil(40 * fontScale) + 8) }, style]}
      onSelect={(event): void => {
        const selected = options.find((option) => option.value === event.nativeEvent.id);
        if (selected && !selected.disabled) onChange(selected.value);
      }}
    />
  );
}
