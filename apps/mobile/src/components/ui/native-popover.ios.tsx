import { Host } from "@expo/ui";
import { Group, Popover, RNHostView } from "@expo/ui/swift-ui";
import { onDisappear } from "@expo/ui/swift-ui/modifiers";
import { useState } from "react";
import { View, useWindowDimensions } from "react-native";
import type { NativePopoverProps } from "./native-popover.types";

export function NativePopover({
  visible,
  onClose,
  onDismiss,
  children,
  content,
  contentWidth,
}: NativePopoverProps): React.JSX.Element {
  const viewport = useWindowDimensions();
  const [width, setWidth] = useState(Math.max(48, viewport.width - 40));
  const popupWidth = Math.min(contentWidth ?? width, viewport.width - 24, 360);
  return (
    <View
      onLayout={(event) => {
        const measured = event.nativeEvent.layout.width;
        if (measured > 0 && measured !== width) setWidth(measured);
      }}
    >
      <Host
        matchContents={{ vertical: true }}
        colorScheme="light"
        ignoreSafeArea="all"
        style={{ width }}
      >
        <Popover
          isPresented={visible}
          onIsPresentedChange={(presented) => {
            if (!presented && visible) onClose();
          }}
          attachmentAnchor="bottom"
          arrowEdge="none"
        >
          <Popover.Trigger>
            <RNHostView matchContents>
              <View style={{ width }}>{children}</View>
            </RNHostView>
          </Popover.Trigger>
          <Popover.Content>
            <Group modifiers={[onDisappear(() => onDismiss?.())]}>
              <RNHostView matchContents>
                <View style={{ width: popupWidth }}>{content}</View>
              </RNHostView>
            </Group>
          </Popover.Content>
        </Popover>
      </Host>
    </View>
  );
}
