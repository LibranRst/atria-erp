import { Host } from "@expo/ui";
import { Button, RNHostView } from "@expo/ui/swift-ui";
import {
  accessibilityAddTraits,
  accessibilityElement,
  accessibilityHint as nativeHint,
  accessibilityLabel as nativeLabel,
  buttonStyle,
  contentShape,
  disabled as nativeDisabled,
  frame,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
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
      style={styles.placement}
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        if (width > 0 && width !== contentWidth) setContentWidth(width);
      }}
    >
      <Host
        matchContents={{ vertical: true }}
        ignoreSafeArea="all"
        colorScheme="light"
        seedColor={theme.colors.accent}
        style={hostStyles.host}
      >
        <Button
          onPress={disabled ? undefined : onPress}
          testID={testID}
          modifiers={[
            buttonStyle("plain"),
            frame({ maxWidth: Infinity, minHeight: 48 }),
            contentShape(shapes.rectangle()),
            nativeDisabled(disabled),
            accessibilityElement("ignore"),
            nativeLabel(accessibilityLabel),
            ...(accessibilityHint ? [nativeHint(accessibilityHint)] : []),
            ...(selected || accessibilityState?.selected
              ? [accessibilityAddTraits(["isSelected"])]
              : []),
          ]}
        >
          <RNHostView matchContents>
            <View
              pointerEvents="none"
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[hostStyles.content, styles.content, { width: contentWidth }]}
            >
              {children}
            </View>
          </RNHostView>
        </Button>
      </Host>
    </View>
  );
}

const hostStyles = StyleSheet.create({
  host: { width: "100%", minHeight: 48, minWidth: 48 },
  content: { minHeight: 48, minWidth: 48 },
});
