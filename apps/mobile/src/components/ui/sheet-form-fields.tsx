import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useMemo,
  useEffect,
  useState,
} from "react";
import { AccessibilityInfo, Platform, findNodeHandle } from "react-native";
import type { ScrollView, TextInput, View } from "react-native";
import { createSheetControlState } from "./sheet-control-state";
import type { SheetControlState } from "./sheet-control-state";
import {
  restoreSheetReadingPosition,
  sheetClampScrollOffset,
  sheetContentMinimumHeight,
  sheetScrollBounds,
  sheetScrollTarget,
} from "./sheet-state";
import type { SheetScrollBounds } from "./sheet-state";

type Field = { view?: View; input?: TextInput };
type ScrollGeometry = {
  readonly contentHeight: number;
  readonly viewportHeight: number;
  readonly bottomInset: number;
};
export type SheetFormFields = SheetControlState & {
  readonly contentMinimumHeight: number;
  readonly attachView: (id: string, view: View | null) => void;
  readonly attachInput: (id: string, input: TextInput | null) => void;
  readonly focus: (id: string) => void;
  readonly attachScroll: (scroll: ScrollView | null) => void;
  readonly setScrollOffset: (offset: number) => void;
  readonly setScrollGeometry: (geometry: Partial<ScrollGeometry>) => void;
  readonly setScrollTopInset: (inset: number) => void;
  readonly shiftScroll: (delta: number) => void;
  readonly captureReadingPosition: (
    fieldId?: string,
    options?: { readonly restoreScroll?: boolean },
  ) => () => void;
  readonly cancelReadingPosition: () => void;
  readonly releaseScrollExtent: () => void;
  readonly resetScrollExtent: () => void;
  readonly clampScrollPosition: () => void;
  readonly registerReveal: (id: string, reveal: () => void | Promise<void>) => () => void;
};
export const SheetFormFieldsContext = createContext<SheetFormFields | null>(null);
export const FormFieldIdContext = createContext<string | undefined>(undefined);
export function useSheetFormFields(): SheetFormFields {
  const fields = useRef(new Map<string, Field>());
  const scroll = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const topInset = useRef(0);
  const receivedScrollOffset = useRef(false);
  const screenReaderEnabled = useRef(false);
  const readingRequest = useRef(0);
  const preservedOffset = useRef<number | null>(null);
  const [contentMinimumHeight, setContentMinimumHeight] = useState(0);
  const scrollGeometry = useRef<ScrollGeometry>({
    contentHeight: 0,
    viewportHeight: 0,
    bottomInset: 0,
  });
  const getScrollBounds = useCallback((): SheetScrollBounds => {
    const geometry = scrollGeometry.current;
    return Platform.OS === "ios" && geometry.contentHeight > 0 && geometry.viewportHeight > 0
      ? sheetScrollBounds({ ...geometry, topInset: topInset.current })
      : { minimum: -topInset.current, maximum: Infinity };
  }, []);
  const updateContentMinimumHeight = useCallback((): void => {
    if (Platform.OS !== "ios") return;
    const geometry = scrollGeometry.current;
    setContentMinimumHeight(
      sheetContentMinimumHeight({
        viewportHeight: geometry.viewportHeight,
        topInset: topInset.current,
        bottomInset: geometry.bottomInset,
        readingOffset: preservedOffset.current ?? undefined,
      }),
    );
  }, []);
  const cancelReadingPosition = useCallback((): void => {
    readingRequest.current += 1;
  }, []);
  const releaseScrollExtent = useCallback((): void => {
    preservedOffset.current = sheetClampScrollOffset(scrollOffset.current, getScrollBounds());
    updateContentMinimumHeight();
  }, [getScrollBounds, updateContentMinimumHeight]);
  const resetScrollExtent = useCallback((): void => {
    preservedOffset.current = null;
    updateContentMinimumHeight();
  }, [updateContentMinimumHeight]);
  const clampScrollPosition = useCallback((): void => {
    if (Platform.OS !== "ios") return;
    const geometry = scrollGeometry.current;
    if (geometry.contentHeight <= 0 || geometry.viewportHeight <= 0) return;
    const target = sheetClampScrollOffset(scrollOffset.current, getScrollBounds());
    if (Math.abs(target - scrollOffset.current) > 1)
      scroll.current?.scrollTo({ y: target, animated: false });
  }, [getScrollBounds]);
  useEffect(() => cancelReadingPosition, [cancelReadingPosition]);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      if (active) screenReaderEnabled.current = enabled;
    });
    const subscription = AccessibilityInfo.addEventListener("screenReaderChanged", (enabled) => {
      screenReaderEnabled.current = enabled;
    });
    return (): void => {
      active = false;
      subscription.remove();
    };
  }, []);
  const controls = useMemo(() => createSheetControlState(), []);
  const revealers = useRef(new Map<string, () => void | Promise<void>>());
  const focusRequest = useRef(0);
  const attachView = useCallback((id: string, view: View | null): void => {
    const field = fields.current.get(id) ?? {};
    if (view) fields.current.set(id, { ...field, view });
    else if (field.input) fields.current.set(id, { ...field, view: undefined });
    else fields.current.delete(id);
  }, []);
  const attachInput = useCallback((id: string, input: TextInput | null): void => {
    const field = fields.current.get(id) ?? {};
    fields.current.set(id, { ...field, input: input ?? undefined });
  }, []);
  const focus = useCallback(
    (id: string): void => {
      cancelReadingPosition();
      const request = ++focusRequest.current;
      void Promise.resolve(revealers.current.get(id)?.())
        .then(() => {
          requestAnimationFrame((): void => {
            if (request !== focusRequest.current) return;
            const field = fields.current.get(id);
            const nativeScroll = scroll.current?.getNativeScrollRef();
            if (!field?.view) return;
            const focusControl = (): void => {
              if (field.input) field.input.focus();
              else {
                const handle = findNodeHandle(field.view ?? null);
                if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
              }
            };
            if (!nativeScroll) {
              focusControl();
              return;
            }
            field.view.measureInWindow((_x, y): void => {
              nativeScroll.measureInWindow((_sx, scrollY): void => {
                if (request !== focusRequest.current) return;
                scroll.current?.scrollTo({
                  y: sheetScrollTarget({
                    offset: scrollOffset.current,
                    delta: y - scrollY - topInset.current - 12,
                    topInset: topInset.current,
                    maximumOffset: getScrollBounds().maximum,
                  }),
                  animated: false,
                });
                focusControl();
              });
            });
          });
        })
        .catch(() => undefined);
    },
    [cancelReadingPosition, getScrollBounds],
  );
  const registerReveal = useCallback(
    (id: string, reveal: () => void | Promise<void>): (() => void) => {
      revealers.current.set(id, reveal);
      return (): void => {
        if (revealers.current.get(id) === reveal) revealers.current.delete(id);
      };
    },
    [],
  );
  const attachScroll = useCallback((view: ScrollView | null): void => {
    scroll.current = view;
  }, []);
  const setScrollOffset = useCallback((offset: number): void => {
    receivedScrollOffset.current = true;
    scrollOffset.current = offset;
  }, []);
  const setScrollGeometry = useCallback(
    (geometry: Partial<ScrollGeometry>): void => {
      scrollGeometry.current = { ...scrollGeometry.current, ...geometry };
      updateContentMinimumHeight();
    },
    [updateContentMinimumHeight],
  );
  const setScrollTopInset = useCallback(
    (inset: number): void => {
      topInset.current = Math.max(0, inset);
      if (!receivedScrollOffset.current) scrollOffset.current = -topInset.current;
      updateContentMinimumHeight();
    },
    [updateContentMinimumHeight],
  );
  const shiftScroll = useCallback(
    (delta: number): void => {
      cancelReadingPosition();
      scroll.current?.scrollTo({
        y: sheetScrollTarget({
          offset: scrollOffset.current,
          delta,
          topInset: topInset.current,
          maximumOffset: getScrollBounds().maximum,
        }),
        animated: false,
      });
    },
    [cancelReadingPosition, getScrollBounds],
  );
  const captureReadingPosition = useCallback(
    (fieldId?: string, options?: { readonly restoreScroll?: boolean }): (() => void) => {
      const request = ++readingRequest.current;
      const captured = sheetClampScrollOffset(scrollOffset.current, getScrollBounds());
      if (Platform.OS === "ios") {
        preservedOffset.current = captured;
        // Reserve the currently visible viewport before a selection removes rows.
        updateContentMinimumHeight();
      }
      return (): void => {
        if (request !== readingRequest.current) return;
        readingRequest.current += 1;
        restoreSheetReadingPosition({
          captured,
          current: scrollOffset.current,
          bounds: Platform.OS === "ios" ? getScrollBounds() : undefined,
          restoreScroll: options?.restoreScroll,
          screenReaderEnabled: screenReaderEnabled.current,
          scrollTo: (y) => scroll.current?.scrollTo({ y, animated: false }),
          restoreAccessibilityFocus: () => {
            const view = fieldId ? fields.current.get(fieldId)?.view : undefined;
            const handle = view ? findNodeHandle(view) : null;
            if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
          },
        });
      };
    },
    [getScrollBounds, updateContentMinimumHeight],
  );
  return useMemo(
    () => ({
      ...controls,
      contentMinimumHeight,
      attachView,
      attachInput,
      focus,
      attachScroll,
      setScrollOffset,
      setScrollGeometry,
      setScrollTopInset,
      shiftScroll,
      captureReadingPosition,
      cancelReadingPosition,
      releaseScrollExtent,
      resetScrollExtent,
      clampScrollPosition,
      registerReveal,
    }),
    [
      attachView,
      attachInput,
      focus,
      attachScroll,
      setScrollOffset,
      setScrollGeometry,
      setScrollTopInset,
      shiftScroll,
      captureReadingPosition,
      cancelReadingPosition,
      releaseScrollExtent,
      resetScrollExtent,
      clampScrollPosition,
      controls,
      contentMinimumHeight,
      registerReveal,
    ],
  );
}
export function useFieldRegistration(): {
  readonly fields: SheetFormFields | null;
  readonly id?: string;
} {
  return { fields: useContext(SheetFormFieldsContext), id: useContext(FormFieldIdContext) };
}
