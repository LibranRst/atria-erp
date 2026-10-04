import { transitionEaseSmooth } from "@atria/tokens/motion";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { KeyboardEvent } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChromeButton } from "./chrome-button";
import { useFieldRegistration } from "./sheet-form-fields";
import { theme } from "@/theme";

type DialogFrameProps = {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onExitComplete?: () => void;
  readonly title: string;
  readonly children: React.ReactNode;
  readonly footer?: React.ReactNode;
  readonly utility?: React.ReactNode;
  readonly headerAction?: React.ReactNode;
  readonly returnFocusField?: string;
  readonly onShow?: () => void;
  readonly topBiased?: boolean;
  readonly scroll?: boolean;
  readonly pending?: boolean;
  readonly presentation?: "standard" | "choice" | "calendar";
};

/** Internal presenter: native Back, keyboard viewport, exit presence and focus have one owner. */
export function DialogFrame({
  visible,
  onClose,
  onExitComplete,
  title,
  children,
  footer,
  utility,
  headerAction,
  returnFocusField,
  onShow,
  topBiased = false,
  scroll = true,
  pending = false,
  presentation = "standard",
}: DialogFrameProps): React.JSX.Element {
  const viewport = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { fields } = useFieldRegistration();
  const [presence, setPresence] = useState({
    visible,
    presented: visible,
    content: { title, children, footer, utility, headerAction },
  });
  if (
    visible !== presence.visible ||
    (visible &&
      (title !== presence.content.title ||
        children !== presence.content.children ||
        footer !== presence.content.footer ||
        utility !== presence.content.utility ||
        headerAction !== presence.content.headerAction))
  ) {
    setPresence({
      visible,
      presented: visible || presence.presented,
      content: visible ? { title, children, footer, utility, headerAction } : presence.content,
    });
  }
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const progress = useSharedValue(0);
  const restore = useRef<(() => void) | undefined>(undefined);
  const previousVisible = useRef(false);
  const exitNotified = useRef(true);
  const restoreFocus = useCallback((): void => {
    if (previousVisible.current || exitNotified.current) return;
    exitNotified.current = true;
    const callback = restore.current;
    restore.current = undefined;
    requestAnimationFrame(() => {
      if (previousVisible.current) return;
      callback?.();
      onExitComplete?.();
    });
  }, [onExitComplete]);
  const finishClose = useCallback((): void => {
    if (previousVisible.current) return;
    setPresence((current) => (current.visible ? current : { ...current, presented: false }));
    if (Platform.OS !== "ios") restoreFocus();
  }, [restoreFocus]);

  useEffect(() => {
    if (visible) {
      if (!previousVisible.current) {
        exitNotified.current = false;
        restore.current = fields?.captureReadingPosition(returnFocusField);
        Keyboard.dismiss();
      }
      progress.value = withTiming(1, {
        duration: reduceMotion ? 0 : transitionEaseSmooth.duration * 1000,
        easing: Easing.bezier(...transitionEaseSmooth.ease),
      });
    } else if (previousVisible.current) {
      Keyboard.dismiss();
      progress.value = withTiming(
        0,
        {
          duration: reduceMotion ? 0 : transitionEaseSmooth.duration * 1000,
          easing: Easing.bezier(...transitionEaseSmooth.ease),
        },
        (finished) => {
          if (finished) runOnJS(finishClose)();
        },
      );
    }
    previousVisible.current = visible;
  }, [visible, fields, returnFocusField, progress, reduceMotion, finishClose]);
  useEffect(() => {
    const change = (event: KeyboardEvent): void =>
      setKeyboardHeight(Math.max(0, viewport.height - event.endCoordinates.screenY));
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow",
      change,
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, [viewport.height]);
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * (presentation === "calendar" ? 0.45 : 0.18),
  }));
  const panelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - progress.value) * 8 }],
  }));
  const close = (): void => {
    if (!pending && visible) onClose();
  };
  const availableHeight = Math.max(
    160,
    viewport.height - insets.top - Math.max(insets.bottom, keyboardHeight) - 40,
  );
  const content = visible ? { title, children, footer, utility, headerAction } : presence.content;

  return (
    <Modal
      transparent
      visible={presence.presented}
      animationType="none"
      statusBarTranslucent
      onRequestClose={close}
      onDismiss={restoreFocus}
      onShow={onShow}
    >
      <View
        onFocus={(event) => event.stopPropagation()}
        style={[
          styles.viewport,
          {
            paddingTop: insets.top + 20,
            paddingBottom: Math.max(insets.bottom, keyboardHeight) + 20,
          },
          topBiased && styles.top,
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.scrim, backdropStyle]}
        />
        <Pressable
          accessibilityLabel="Tutup dialog"
          accessible={false}
          style={StyleSheet.absoluteFill}
          onPress={close}
        />
        <Animated.View
          pointerEvents={visible ? "auto" : "none"}
          accessibilityViewIsModal
          onAccessibilityEscape={close}
          style={[
            styles.position,
            {
              width: Math.min(
                presentation === "calendar" ? 340 : 360,
                viewport.width - (presentation === "calendar" ? 32 : 24),
              ),
              maxHeight:
                presentation === "calendar"
                  ? Math.min(560, viewport.height * 0.78, availableHeight)
                  : availableHeight,
            },
            panelStyle,
          ]}
        >
          {content.utility ? (
            <View style={styles.utility}>
              {content.utility}
              <ChromeButton
                label="Tutup pilihan"
                icon="close"
                systemImage="xmark"
                onPress={close}
              />
            </View>
          ) : null}
          <View
            style={[
              styles.panel,
              presentation === "choice" && styles.solidPanel,
              presentation === "calendar" && styles.calendarPanel,
              { maxHeight: availableHeight - (content.utility ? 60 : 0) },
            ]}
          >
            <View style={[styles.header, presentation === "calendar" && styles.calendarHeader]}>
              <Text
                accessibilityRole="header"
                style={[
                  styles.title,
                  presentation === "choice" && styles.solidTitle,
                  presentation === "calendar" && styles.calendarTitle,
                ]}
              >
                {content.title}
              </Text>
              {content.headerAction}
              {!content.utility ? (
                <ChromeButton
                  label="Tutup dialog"
                  icon="close"
                  systemImage="xmark"
                  onPress={close}
                />
              ) : null}
            </View>
            {presentation === "choice" ? <View style={styles.choiceDivider} /> : null}
            {scroll ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                style={styles.scroll}
                contentContainerStyle={[
                  styles.body,
                  presentation === "calendar" && styles.calendarBody,
                ]}
              >
                {content.children}
              </ScrollView>
            ) : (
              <View style={[styles.body, presentation === "choice" && styles.choiceBody]}>
                {content.children}
              </View>
            )}
            {content.footer ? <View style={styles.footer}>{content.footer}</View> : null}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, alignItems: "center", justifyContent: "center" },
  top: { justifyContent: "flex-start" },
  scrim: { backgroundColor: theme.colors.primary },
  position: { flexShrink: 1, gap: theme.spacing.sm },
  utility: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  panel: {
    flexShrink: 1,
    backgroundColor: theme.colors.surfaceContainerLow,
    borderRadius: theme.radii.owner,
    boxShadow: theme.shadows.raised,
    overflow: "hidden",
  },
  solidPanel: { backgroundColor: theme.colors.surfaceContainerLowest },
  choiceBody: { paddingHorizontal: 0, paddingBottom: 0, gap: 0 },
  calendarPanel: { padding: theme.spacing.xs },
  calendarHeader: {
    paddingHorizontal: theme.spacing.xs,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
    minHeight: 0,
  },
  calendarTitle: { ...theme.typography.row },
  calendarBody: { paddingHorizontal: 0, paddingBottom: 0, gap: 0 },
  solidTitle: {
    fontFamily: Platform.OS === "ios" ? undefined : theme.fonts.semibold,
    fontWeight: "600",
  },
  choiceDivider: {
    marginHorizontal: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.outlineVariant,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingLeft: theme.spacing.md,
    paddingRight: theme.spacing.xs,
    minHeight: 60,
  },
  title: {
    flex: 1,
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    ...theme.typography.section,
  },
  scroll: { flexShrink: 1 },
  body: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.sm,
    flexShrink: 1,
  },
  footer: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.xs,
  },
});
