import { Host } from "@expo/ui";
import { TextButton, RNHostView } from "@expo/ui/jetpack-compose";
import {
  defaultMinSize,
  fillMaxWidth,
  testID as nativeTestID,
} from "@expo/ui/jetpack-compose/modifiers";
import { StyleSheet, View } from "react-native";
import { useState } from "react";
import type { RowActionProps } from "./row-action.types";
import { splitRowActionStyle } from "./row-action.styles";
import { theme } from "@/theme";

export type { RowActionProps } from "./row-action.types";

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
  const [contentWidth, setContentWidth] = useState<number | undefined>();
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        ...accessibilityState,
        disabled,
        selected: selected || Boolean(accessibilityState?.selected),
      }}
      accessibilityActions={disabled ? [] : [{ name: "activate" }]}
      onAccessibilityAction={
        disabled
          ? undefined
          : (event) => {
              if (event.nativeEvent.actionName === "activate") onPress();
            }
      }
      style={styles.placement}
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        if (width > 0 && width !== contentWidth) setContentWidth(width);
      }}
      testID={testID}
    >
      <View importantForAccessibility="no-hide-descendants">
        <Host
          matchContents={{ vertical: true }}
          colorScheme="light"
          seedColor={theme.colors.accent}
          style={hostStyles.host}
        >
          <TextButton
            enabled={!disabled}
            onClick={disabled ? undefined : onPress}
            contentPadding={{ start: 0, end: 0, top: 0, bottom: 0 }}
            colors={{ containerColor: "transparent" }}
            modifiers={[
              fillMaxWidth(),
              defaultMinSize({ minHeight: 48, minWidth: 48 }),
              ...(testID ? [nativeTestID(testID)] : []),
            ]}
          >
            <RNHostView matchContents>
              <View
                pointerEvents="none"
                accessible={false}
                style={[hostStyles.content, styles.content, { width: contentWidth }]}
              >
                {children}
              </View>
            </RNHostView>
          </TextButton>
        </Host>
      </View>
    </View>
  );
}

const hostStyles = StyleSheet.create({
  host: { width: "100%", minHeight: 48, minWidth: 48 },
  content: { minHeight: 48, minWidth: 48 },
});
