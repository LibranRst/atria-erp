import { useSheetPresented } from "./use-sheet-presented";
import { ScreenSkeleton } from "./screen-state";
import { SkeletonFooter } from "./loading-skeletons";
import {
  Fragment,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  useEffect,
} from "react";
import { useNavigation } from "expo-router";
import { HeaderHeightContext, useIsFocused, useRoute } from "expo-router/react-navigation";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import type { LayoutChangeEvent, ScrollViewProps, StyleProp, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/theme";
import { ButtonSizeContext } from "./button-size-context";
import {
  sheetBodyHeight,
  sheetBottomClearance,
  sheetContentMinimumHeight,
  sheetEffectiveBottomInset,
  sheetFooterPadding,
  sheetFocusedInputScrollDelta,
  type SheetSizingHint,
} from "./sheet-state";
import { useSheetHeader } from "./use-sheet-header";
import type { SheetDismissal } from "./use-sheet-dismissal";
import type { NativeMenuItem } from "./action-menu.types";
import {
  SheetFormFieldsContext,
  useSheetFormFields,
  type SheetFormFields,
} from "./sheet-form-fields";

// A route key is a presentation session. Loading and ready bodies may remount;
// their peak survives, while a newly opened route gets a fresh measurement.
const sessionHeights = new Map<string, number>();
const provisionalHeights = new Map<string, number>();

export type BottomSheetProps = {
  readonly deferContent?: boolean;
  readonly loadingContent?: React.ReactNode;
  readonly contentPhase?: "loading" | "ready";
  readonly children?: React.ReactNode;
  readonly description?: string;
  readonly footer?: React.ReactNode;
  readonly footerStatus?: string | null;
  readonly scrollProps?: Omit<ScrollViewProps, "children">;
  readonly style?: StyleProp<ViewStyle>;
  readonly title?: string;
  readonly sizing?: SheetSizingHint;
  readonly dismissal?: SheetDismissal;
  readonly onClose?: () => void;
  readonly headerActions?: readonly NativeMenuItem[];
  readonly headerActionLabel?: string;
  readonly fields?: SheetFormFields;
  readonly bodyOverlay?: React.ReactNode;
};

/** Native stack owns the sheet. ScrollView MUST be its first direct native
 * child, with at most one footer sibling. Providers add no native wrapper.
 * Selector hosts belong inside bodyOverlay, never beside these two children. */
export function BottomSheet({
  deferContent = false,
  loadingContent,
  contentPhase = "ready",
  children,
  description,
  footer,
  footerStatus,
  scrollProps,
  style,
  title,
  sizing = "content",
  dismissal,
  onClose,
  headerActions,
  headerActionLabel,
  fields,
  bodyOverlay,
}: BottomSheetProps): React.JSX.Element {
  const presented = useSheetPresented();
  const renderContent = !deferContent || presented;
  const phase = renderContent ? contentPhase : "loading";
  const navigation = useNavigation();
  const focused = useIsFocused();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const viewport = useWindowDimensions();
  const headerHeight = useContext(HeaderHeightContext) ?? 56;
  const topClearance = Platform.OS === "ios" ? headerHeight : 0;
  const ownFields = useSheetFormFields();
  const registry = fields ?? ownFields;
  const {
    cancelReadingPosition,
    clampScrollPosition,
    releaseScrollExtent,
    resetScrollExtent,
    setScrollGeometry,
    setScrollTopInset,
    shiftScroll,
  } = registry;
  const [bodyMeasurement, setBodyMeasurement] = useState<{
    phase: "loading" | "ready";
    height: number;
  } | null>(null);
  const [descriptionHeight, setDescriptionHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(footer ? 90 : 0);
  const [keyboardVisible, setKeyboardVisible] = useState(() => Keyboard.isVisible());
  const [keyboardOffset, setKeyboardOffset] = useState(insets.top);
  const keyboardTransitioning = useRef(false);
  const clearanceKey = `${viewport.width}:${viewport.height}:${keyboardVisible}:${Boolean(footer)}`;
  const clearanceEpoch = useRef(clearanceKey);
  useLayoutEffect(() => {
    clearanceEpoch.current = clearanceKey;
  }, [clearanceKey]);
  const scrollRef = useRef<ScrollView>(null);
  const footerRef = useRef<View>(null);
  const nativeViewport = useRef<{ height: number; bottomInset: number } | null>(null);
  const nativeViewportTop = useRef(0);
  const userScrolling = useRef(false);
  const clampAfterKeyboard = useRef(false);
  const [measuredClearance, setMeasuredClearance] = useState<{ key: string; value: number } | null>(
    null,
  );
  const updateClearance = useCallback((): void => {
    if (Platform.OS === "web") return;
    const metrics = nativeViewport.current;
    const epoch = clearanceEpoch.current;
    const nativeScroll = scrollRef.current?.getNativeScrollRef();
    if (!nativeScroll) return;
    nativeScroll.measureInWindow((_x, viewportTop, _width, viewportHeight): void => {
      if (epoch !== clearanceEpoch.current) return;
      const keyboard = Keyboard.isVisible() ? Keyboard.metrics() : undefined;
      nativeViewportTop.current = viewportTop;
      if (viewportHeight > 0)
        setScrollGeometry({
          viewportHeight,
          bottomInset:
            Platform.OS === "ios"
              ? sheetEffectiveBottomInset({
                  safeAreaInset: insets.bottom,
                  declaredInset: scrollProps?.contentInset?.bottom,
                  nativeInset: metrics?.bottomInset,
                  keyboardVisible: Keyboard.isVisible(),
                  keyboardOverlap: keyboard ? viewportTop + viewportHeight - keyboard.screenY : 0,
                })
              : (metrics?.bottomInset ?? 0),
        });
      if (clampAfterKeyboard.current && !userScrolling.current) clampScrollPosition();
      setKeyboardOffset(Math.max(0, viewportTop));
      if (!metrics || !footerRef.current) return;
      footerRef.current?.measureInWindow((_fx, footerTop, _fw, height): void => {
        if (
          keyboardTransitioning.current ||
          metrics !== nativeViewport.current ||
          epoch !== clearanceEpoch.current ||
          height <= 0
        )
          return;
        const value = sheetBottomClearance({
          footerHeight: height,
          viewportTop,
          viewportHeight: metrics.height,
          footerTop,
          bottomInset: metrics.bottomInset,
          keyboardTop: Keyboard.isVisible() ? Keyboard.metrics()?.screenY : undefined,
        });
        setMeasuredClearance((previous) =>
          previous?.key === epoch && previous.value === value ? previous : { key: epoch, value },
        );
      });
    });
  }, [insets.bottom, setScrollGeometry, clampScrollPosition, scrollProps?.contentInset?.bottom]);
  const ownedInput = useRef<ReturnType<typeof TextInput.State.currentlyFocusedInput> | null>(null);
  const focusMeasurementFrame = useRef<number | null>(null);
  const focusMeasurementGeneration = useRef(0);
  const [footerReserve, setFooterReserve] = useState({ key: clearanceKey, padding: 0 });
  const callerPadding = StyleSheet.flatten(scrollProps?.contentContainerStyle)?.paddingBottom;
  const bottomPadding = Math.max(
    typeof callerPadding === "number" ? callerPadding : 0,
    footer
      ? sheetFooterPadding({
          footerHeight,
          headerHeight: Platform.OS === "ios" ? headerHeight : 0,
          measuredClearance:
            measuredClearance?.key === clearanceKey ? measuredClearance.value : undefined,
          previousPadding: footerReserve.key === clearanceKey ? footerReserve.padding : 0,
        })
      : Math.max(insets.bottom, 16),
  );
  if (footerReserve.key !== clearanceKey || bottomPadding !== footerReserve.padding)
    setFooterReserve({ key: clearanceKey, padding: bottomPadding });
  const bodyHeight = sheetBodyHeight({
    viewportHeight: viewport.height,
    topInset: insets.top,
    headerHeight,
    contentHeight:
      bodyMeasurement?.phase === phase
        ? bodyMeasurement.height +
          (description ? descriptionHeight + 16 : 0) +
          12 +
          bottomPadding +
          topClearance
        : 0,
    previousHeight: sessionHeights.get(route.key),
    sizing,
    contentPhase: phase,
    readyMeasured: bodyMeasurement?.phase === "ready",
    provisionalHeight: provisionalHeights.get(route.key),
  });
  const close = useCallback((): void => {
    if (dismissal) dismissal.requestClose();
    else if (onClose) onClose();
    else navigation.goBack();
  }, [dismissal, onClose, navigation]);
  useSheetHeader({
    title,
    onClose: close,
    pending: dismissal?.pending,
    actions: headerActions,
    actionLabel: headerActionLabel,
  });
  useLayoutEffect(() => setScrollTopInset(topClearance), [setScrollTopInset, topClearance]);

  useLayoutEffect(() => {
    if (phase === "ready" && bodyMeasurement?.phase === "ready")
      sessionHeights.set(route.key, bodyHeight);
    else provisionalHeights.set(route.key, bodyHeight);
    if (sessionHeights.size > 128) {
      const oldest = sessionHeights.keys().next().value;
      if (oldest) sessionHeights.delete(oldest);
    }
    if (provisionalHeights.size > 128) {
      const oldest = provisionalHeights.keys().next().value;
      if (oldest) provisionalHeights.delete(oldest);
    }
    if (focused && Platform.OS === "ios" && sizing === "content")
      navigation.setOptions({
        contentStyle: { height: bodyHeight, backgroundColor: theme.colors.surfaceContainerLow },
      });
  }, [bodyHeight, bodyMeasurement?.phase, focused, navigation, phase, route.key, sizing]);

  const clearFocusedInput = useCallback((): void => {
    if (Platform.OS !== "ios" || !Keyboard.isVisible()) return;
    const generation = ++focusMeasurementGeneration.current;
    if (focusMeasurementFrame.current !== null) cancelAnimationFrame(focusMeasurementFrame.current);
    focusMeasurementFrame.current = requestAnimationFrame(() => {
      focusMeasurementFrame.current = null;
      if (
        keyboardTransitioning.current ||
        userScrolling.current ||
        generation !== focusMeasurementGeneration.current
      )
        return;
      const scroll = scrollRef.current;
      const nativeScroll = scroll?.getNativeScrollRef();
      const input = TextInput.State.currentlyFocusedInput();
      if (!scroll || !nativeScroll || !footerRef.current || !input || input !== ownedInput.current)
        return;
      input.measureInWindow((_x, inputY, _w, inputHeight): void => {
        nativeScroll.measureInWindow((_sx, scrollY): void => {
          footerRef.current?.measureInWindow((_fx, footerY): void => {
            const keyboard = Keyboard.metrics();
            if (
              generation !== focusMeasurementGeneration.current ||
              keyboardTransitioning.current ||
              userScrolling.current ||
              !keyboard ||
              !Keyboard.isVisible() ||
              input !== TextInput.State.currentlyFocusedInput()
            )
              return;
            const delta = sheetFocusedInputScrollDelta({
              inputTop: inputY,
              inputHeight,
              viewportTop: scrollY,
              headerHeight: topClearance,
              footerTop: footerY,
            });
            if (Math.abs(delta) > 1) shiftScroll(delta);
          });
        });
      });
    });
  }, [shiftScroll, topClearance]);
  useEffect(
    () => (): void => {
      focusMeasurementGeneration.current += 1;
      if (focusMeasurementFrame.current !== null)
        cancelAnimationFrame(focusMeasurementFrame.current);
    },
    [],
  );
  useEffect(() => {
    const settleKeyboard = (): void => {
      keyboardTransitioning.current = false;
      // Fabric reapplies the old offset after removing its keyboard inset.
      // Overflow is required for the adjusted header, so bound that native
      // offset until the next deliberate body interaction.
      clampAfterKeyboard.current = !Keyboard.isVisible();
      updateClearance();
      clearFocusedInput();
    };
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => {
        cancelReadingPosition();
        clampAfterKeyboard.current = false;
        keyboardTransitioning.current = Platform.OS === "ios";
        setKeyboardVisible(true);
      },
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        cancelReadingPosition();
        clampAfterKeyboard.current = false;
        keyboardTransitioning.current = Platform.OS === "ios";
        setKeyboardVisible(false);
      },
    );
    const changing = Keyboard.addListener("keyboardWillChangeFrame", () => {
      cancelReadingPosition();
      clampAfterKeyboard.current = false;
      keyboardTransitioning.current = Platform.OS === "ios";
    });
    const shown = Keyboard.addListener("keyboardDidShow", settleKeyboard);
    const changed = Keyboard.addListener("keyboardDidChangeFrame", settleKeyboard);
    const hidden = Keyboard.addListener("keyboardDidHide", settleKeyboard);
    return () => {
      show.remove();
      hide.remove();
      shown.remove();
      changed.remove();
      changing.remove();
      hidden.remove();
    };
  }, [clearFocusedInput, cancelReadingPosition, updateClearance]);
  useLayoutEffect(() => {
    cancelReadingPosition();
    resetScrollExtent();
  }, [clearanceKey, cancelReadingPosition, resetScrollExtent]);
  const onFooterLayout = (event: LayoutChangeEvent): void => {
    setFooterHeight(event.nativeEvent.layout.height);
    updateClearance();
    clearFocusedInput();
  };
  return (
    <SheetFormFieldsContext.Provider value={registry}>
      <ButtonSizeContext.Provider value="sheet">
        <ScrollView
          testID="native-sheet-scroll"
          {...scrollProps}
          ref={(view) => {
            scrollRef.current = view;
            registry.attachScroll(view);
          }}
          onFocus={(event) => {
            clampAfterKeyboard.current = false;
            cancelReadingPosition();
            scrollProps?.onFocus?.(event);
            ownedInput.current = TextInput.State.currentlyFocusedInput();
            clearFocusedInput();
          }}
          onLayout={(event) => {
            scrollProps?.onLayout?.(event);
            updateClearance();
            clearFocusedInput();
          }}
          onTouchStart={(event) => {
            clampAfterKeyboard.current = false;
            scrollProps?.onTouchStart?.(event);
          }}
          onContentSizeChange={(width, height) => {
            setScrollGeometry({ contentHeight: height });
            scrollProps?.onContentSizeChange?.(width, height);
            updateClearance();
            clearFocusedInput();
          }}
          onScroll={(event) => {
            const height = event.nativeEvent.layoutMeasurement.height;
            const bottomInset = event.nativeEvent.contentInset?.bottom ?? 0;
            const keyboard = Keyboard.isVisible() ? Keyboard.metrics() : undefined;
            if (
              nativeViewport.current?.height !== height ||
              nativeViewport.current.bottomInset !== bottomInset
            )
              nativeViewport.current = { height, bottomInset };
            setScrollGeometry({
              contentHeight: event.nativeEvent.contentSize.height,
              viewportHeight: height,
              bottomInset:
                Platform.OS === "ios"
                  ? sheetEffectiveBottomInset({
                      safeAreaInset: insets.bottom,
                      declaredInset: scrollProps?.contentInset?.bottom,
                      nativeInset: bottomInset,
                      keyboardVisible: Keyboard.isVisible(),
                      keyboardOverlap: keyboard
                        ? nativeViewportTop.current + height - keyboard.screenY
                        : 0,
                    })
                  : bottomInset,
            });
            updateClearance();
            registry.setScrollOffset(event.nativeEvent.contentOffset.y);
            scrollProps?.onScroll?.(event);
          }}
          onScrollBeginDrag={(event) => {
            clampAfterKeyboard.current = false;
            cancelReadingPosition();
            userScrolling.current = true;
            focusMeasurementGeneration.current += 1;
            scrollProps?.onScrollBeginDrag?.(event);
          }}
          onScrollEndDrag={(event) => {
            userScrolling.current = false;
            releaseScrollExtent();
            scrollProps?.onScrollEndDrag?.(event);
          }}
          onMomentumScrollBegin={(event) => {
            clampAfterKeyboard.current = false;
            cancelReadingPosition();
            userScrolling.current = true;
            focusMeasurementGeneration.current += 1;
            scrollProps?.onMomentumScrollBegin?.(event);
          }}
          onMomentumScrollEnd={(event) => {
            userScrolling.current = false;
            releaseScrollExtent();
            scrollProps?.onMomentumScrollEnd?.(event);
          }}
          scrollEventThrottle={16}
          style={[
            styles.canvas,
            Platform.OS === "ios" && sizing === "content"
              ? { height: bodyHeight, flex: 0 }
              : undefined,
            style,
            scrollProps?.style,
          ]}
          contentContainerStyle={[
            styles.content,
            scrollProps?.contentContainerStyle,
            {
              paddingBottom: bottomPadding,
              // Fullscreen forms keep their visible scroll range before rows
              // disappear; compact detail detents retain intrinsic sizing.
              minHeight:
                Platform.OS === "ios" && sizing === "maximum"
                  ? Math.max(
                      registry.contentMinimumHeight,
                      sheetContentMinimumHeight({
                        viewportHeight: bodyHeight,
                        topInset: topClearance,
                        bottomInset: insets.bottom,
                      }),
                    )
                  : undefined,
            },
          ]}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          contentInsetAdjustmentBehavior={
            Platform.OS === "ios" ? "always" : scrollProps?.contentInsetAdjustmentBehavior
          }
          // Fabric otherwise clamps the adjusted header's valid negative offset
          // against raw contentInset.top. The shared registry bounds commands.
          scrollToOverflowEnabled={
            Platform.OS === "ios" ? true : scrollProps?.scrollToOverflowEnabled
          }
        >
          {/* Keep controls mounted across Dynamic Type changes; their layout remeasures without discarding unfinished input. */}
          <Fragment>
            {description ? (
              <Text
                onLayout={(event) => setDescriptionHeight(event.nativeEvent.layout.height)}
                style={styles.description}
              >
                {description}
              </Text>
            ) : null}
            <View
              key={phase}
              onLayout={(event) =>
                setBodyMeasurement({ phase, height: event.nativeEvent.layout.height })
              }
              style={styles.body}
            >
              {renderContent ? children : (loadingContent ?? <ScreenSkeleton rows={5} />)}
            </View>
          </Fragment>
          {renderContent ? bodyOverlay : null}
        </ScrollView>
        {footer ? (
          <KeyboardAvoidingView
            collapsable={false}
            behavior="padding"
            enabled={Platform.OS === "ios"}
            keyboardVerticalOffset={keyboardOffset}
            style={styles.footerFloating}
          >
            <View
              testID="native-sheet-footer"
              collapsable={false}
              ref={footerRef}
              onLayout={onFooterLayout}
              style={[
                styles.footer,
                { paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 16) },
              ]}
            >
              <View pointerEvents="none" style={styles.edgeFade} />
              {footerStatus && phase === "ready" ? (
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  style={styles.error}
                >
                  {footerStatus}
                </Text>
              ) : null}
              <View style={styles.footerAction}>
                {phase === "ready" ? footer : <SkeletonFooter />}
              </View>
            </View>
          </KeyboardAvoidingView>
        ) : null}
      </ButtonSizeContext.Provider>
    </SheetFormFieldsContext.Provider>
  );
}
const styles = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: theme.colors.surfaceContainerLow },
  content: { gap: 16, paddingHorizontal: 16, paddingTop: 12 },
  body: { gap: 16 },
  description: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    ...theme.typography.support,
    paddingHorizontal: 4,
  },
  footerFloating: { position: "absolute", left: 0, right: 0, bottom: 0 },
  footer: { gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  footerAction: { ...theme.nativeShadows.floating },
  edgeFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    experimental_backgroundImage: `linear-gradient(to bottom, ${theme.colors.surfaceContainerLow}00 0%, ${theme.colors.surfaceContainerLow}D9 100%)`,
  },
  error: {
    color: theme.colors.critical,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.meta,
  },
});
