import { transitionEaseSmooth } from "@atria/tokens/motion";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  StyleSheet,
  View,
  findNodeHandle,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { NativePopoverProps } from "./native-popover.types";
import { theme } from "@/theme";

/** Android/web keep the same anchored Atria content; native Modal owns Back. */
export function NativePopover({
  visible,
  onClose,
  onDismiss,
  children,
  content,
  contentWidth,
}: NativePopoverProps): React.JSX.Element {
  const trigger = useRef<View>(null);
  const viewport = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const previouslyVisible = useRef(false);
  const [presence, setPresence] = useState({ visible, presented: visible, content });
  if (visible !== presence.visible || (visible && content !== presence.content))
    setPresence({
      visible,
      presented: visible || presence.presented,
      content: visible ? content : presence.content,
    });
  const progress = useSharedValue(0);
  const [anchor, setAnchor] = useState({
    x: 12,
    y: insets.top + 12,
    width: viewport.width - 24,
    height: 48,
  });
  const [height, setHeight] = useState(240);
  const finishClose = useCallback((): void => {
    if (previouslyVisible.current) return;
    setPresence((current) => (current.visible ? current : { ...current, presented: false }));
    requestAnimationFrame(() => {
      if (previouslyVisible.current) return;
      const node = findNodeHandle(trigger.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
      onDismiss?.();
    });
  }, [onDismiss]);
  useEffect(() => {
    if (visible) {
      trigger.current?.measureInWindow((x, y, width, measuredHeight) =>
        setAnchor({ x, y, width, height: measuredHeight }),
      );
      progress.value = withTiming(1, {
        duration: reduced ? 0 : transitionEaseSmooth.duration * 1000,
        easing: Easing.bezier(...transitionEaseSmooth.ease),
      });
    } else if (previouslyVisible.current) {
      progress.value = withTiming(
        0,
        {
          duration: reduced ? 0 : transitionEaseSmooth.duration * 1000,
          easing: Easing.bezier(...transitionEaseSmooth.ease),
        },
        (finished) => {
          if (finished) runOnJS(finishClose)();
        },
      );
    }
    previouslyVisible.current = visible;
  }, [visible, viewport.width, viewport.height, progress, reduced, finishClose]);
  const width = Math.min(contentWidth ?? anchor.width, viewport.width - 24, 360);
  const available = viewport.height - insets.bottom - 12;
  const below = anchor.y + anchor.height + 8;
  const top =
    below + height <= available ? below : Math.max(insets.top + 12, anchor.y - height - 8);
  const left = Math.max(12, Math.min(anchor.x, viewport.width - width - 12));
  const animated = useAnimatedStyle(() => ({ opacity: progress.value }));
  return (
    <>
      <View ref={trigger} collapsable={false}>
        {children}
      </View>
      <Modal visible={presence.presented} transparent animationType="none" onRequestClose={onClose}>
        <View style={styles.layer}>
          <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={onClose} />
          <Animated.View
            pointerEvents={visible ? "auto" : "none"}
            accessibilityViewIsModal
            onAccessibilityEscape={onClose}
            onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
            style={[
              styles.popover,
              { top, left, width, maxHeight: viewport.height - insets.top - insets.bottom - 24 },
              animated,
            ]}
          >
            {visible ? content : presence.content}
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  layer: { flex: 1 },
  popover: {
    position: "absolute",
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderRadius: theme.radii.owner,
    overflow: "hidden",
    boxShadow: theme.shadows.raised,
  },
});
