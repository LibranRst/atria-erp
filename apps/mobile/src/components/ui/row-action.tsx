import { Pressable, View } from "react-native";
import type { RowActionProps } from "./row-action.types";
import { splitRowActionStyle } from "./row-action.styles";

export type { RowActionProps } from "./row-action.types";

/** Browser fallback; native platforms use real system action controls. */
export function RowAction({
  children,
  onPress,
  style,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  disabled = false,
  selected = false,
  testID,
}: RowActionProps): React.JSX.Element {
  const styles = splitRowActionStyle(style);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        ...accessibilityState,
        disabled,
        selected: selected || Boolean(accessibilityState?.selected),
      }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={styles.placement}
    >
      <View
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[{ minHeight: 48, minWidth: 48 }, styles.content, disabled && { opacity: 0.5 }]}
      >
        {children}
      </View>
    </Pressable>
  );
}
