import { AtriaNativeSegmentedTabsView } from "../../../modules/atria-native-dock/src/atria-native-segmented-tabs-view";
import type { SegmentedTabsProps } from "./segmented-tabs.shared";
import { transitionEaseSmooth, transitionSpringBouncy } from "@atria/tokens/motion";
import { useWindowDimensions } from "react-native";
import { theme } from "@/theme";
import { nativeIconImageData } from "@atria/icons/native-images";

export type { SegmentedTab, SegmentedTabsProps } from "./segmented-tabs.shared";

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
        iconData: option.icon ? nativeIconImageData(option.icon) : "",
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
