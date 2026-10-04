export type SheetSizingHint = "content" | "maximum";

export type SheetScrollBounds = {
  readonly minimum: number;
  readonly maximum: number;
};

/** Use the adjusted native insets; raw scroll-command insets omit floating chrome. */
export function sheetScrollBounds({
  contentHeight,
  viewportHeight,
  topInset,
  bottomInset,
}: {
  readonly contentHeight: number;
  readonly viewportHeight: number;
  readonly topInset: number;
  readonly bottomInset: number;
}): SheetScrollBounds {
  const minimum = -topInset;
  return { minimum, maximum: Math.max(minimum, contentHeight - viewportHeight + bottomInset) };
}

export function sheetClampScrollOffset(offset: number, bounds: SheetScrollBounds): number {
  return Math.min(bounds.maximum, Math.max(bounds.minimum, offset));
}

/** A dismissed keyboard cannot keep owning bottom space through a stale native scroll event. */
export function sheetEffectiveBottomInset({
  safeAreaInset,
  declaredInset = 0,
  nativeInset = 0,
  keyboardVisible,
  keyboardOverlap = 0,
}: {
  readonly safeAreaInset: number;
  readonly declaredInset?: number;
  readonly nativeInset?: number;
  readonly keyboardVisible: boolean;
  readonly keyboardOverlap?: number;
}): number {
  return Math.max(
    safeAreaInset,
    declaredInset,
    keyboardVisible ? Math.max(nativeInset, keyboardOverlap) : 0,
  );
}

/** Keep the captured viewport reachable when form rows disappear, without retaining their full height. */
export function sheetContentMinimumHeight({
  viewportHeight,
  topInset,
  bottomInset,
  readingOffset = -topInset,
}: {
  readonly viewportHeight: number;
  readonly topInset: number;
  readonly bottomInset: number;
  readonly readingOffset?: number;
}): number {
  return Math.max(0, viewportHeight - bottomInset + Math.max(-topInset, readingOffset));
}

/** Selection dismissal should not write an offset the native scroll already has. */
export function sheetReadingRestoreOffset(captured: number, current: number): number | null {
  return Math.abs(captured - current) > 1 ? captured : null;
}

/** Native popovers already return touch focus; only assistive navigation needs an AX notification. */
export function restoreSheetReadingPosition({
  captured,
  current,
  bounds,
  restoreScroll = true,
  screenReaderEnabled,
  scrollTo,
  restoreAccessibilityFocus,
}: {
  readonly captured: number;
  readonly current: number;
  readonly bounds?: SheetScrollBounds;
  readonly restoreScroll?: boolean;
  readonly screenReaderEnabled: boolean;
  readonly scrollTo: (offset: number) => void;
  readonly restoreAccessibilityFocus: () => void;
}): void {
  if (restoreScroll) {
    const target = bounds ? sheetClampScrollOffset(captured, bounds) : captured;
    const offset = sheetReadingRestoreOffset(target, current);
    if (offset !== null) scrollTo(offset);
  }
  if (screenReaderEnabled) restoreAccessibilityFocus();
}

/** Automatic native top insets permit a negative resting offset below floating chrome. */
export function sheetScrollTarget({
  offset,
  delta,
  topInset = 0,
  maximumOffset = Infinity,
}: {
  readonly offset: number;
  readonly delta: number;
  readonly topInset?: number;
  readonly maximumOffset?: number;
}): number {
  const minimum = topInset > 0 ? -topInset : 0;
  return sheetClampScrollOffset(offset + delta, {
    minimum,
    maximum: Math.max(minimum, maximumOffset),
  });
}

export function sheetBottomClearance({
  footerHeight,
  viewportTop,
  viewportHeight,
  footerTop,
  bottomInset = 0,
  keyboardTop,
}: {
  readonly footerHeight: number;
  readonly viewportTop: number;
  readonly viewportHeight: number;
  readonly footerTop: number;
  readonly bottomInset?: number;
  readonly keyboardTop?: number;
}): number {
  // Native-stack can resize UIScrollView past its React wrapper. Reserve the
  // actual occluded viewport, subtracting space UIKit already owns for keyboard.
  const keyboardInset =
    keyboardTop === undefined ? 0 : Math.max(0, viewportTop + viewportHeight - keyboardTop);
  const occludedHeight =
    viewportTop + viewportHeight - footerTop - Math.max(0, bottomInset, keyboardInset);
  return Math.ceil(Math.max(footerHeight, occludedHeight) + 12);
}

/** Content growth cannot shrink the footer reserve within one viewport/keyboard epoch. */
export function sheetFooterPadding({
  footerHeight,
  measuredClearance,
  minimumPadding = 0,
  previousPadding = 0,
}: {
  readonly footerHeight: number;
  readonly headerHeight: number;
  readonly measuredClearance?: number | null;
  readonly minimumPadding?: number;
  readonly previousPadding?: number;
}): number {
  return Math.max(minimumPadding, footerHeight + 12, measuredClearance ?? 0, previousPadding);
}

/** Breathing room is added only after actual occlusion, never to chase a visible field. */
export function sheetFocusedInputScrollDelta({
  inputTop,
  inputHeight,
  viewportTop,
  headerHeight,
  footerTop,
}: {
  readonly inputTop: number;
  readonly inputHeight: number;
  readonly viewportTop: number;
  readonly headerHeight: number;
  readonly footerTop: number;
}): number {
  const visibleTop = viewportTop + headerHeight;
  const visibleBottom = footerTop;
  if (inputHeight > visibleBottom - visibleTop) return 0;
  return inputTop < visibleTop
    ? inputTop - (visibleTop + 28)
    : inputTop + inputHeight > visibleBottom
      ? inputTop + inputHeight - (visibleBottom - 12)
      : 0;
}

/** Height includes scroll padding (and therefore the measured floating footer). */
export function sheetBodyHeight({
  viewportHeight,
  topInset,
  headerHeight,
  contentHeight,
  previousHeight = 0,
  sizing = "content",
  contentPhase = "ready",
  readyMeasured = true,
  provisionalHeight = 0,
}: {
  readonly viewportHeight: number;
  readonly topInset: number;
  readonly headerHeight: number;
  readonly contentHeight: number;
  readonly previousHeight?: number;
  readonly sizing?: SheetSizingHint;
  readonly contentPhase?: "loading" | "ready";
  readonly readyMeasured?: boolean;
  readonly provisionalHeight?: number;
}): number {
  const maximum = Math.max(180, Math.floor(viewportHeight - topInset - headerHeight - 12));
  const measured = contentPhase === "ready" && !readyMeasured ? provisionalHeight : contentHeight;
  return sizing === "maximum"
    ? maximum
    : Math.min(maximum, Math.max(180, previousHeight, Math.ceil(measured)));
}

export function sheetDismissalDecision({
  dirty,
  pending,
}: {
  readonly dirty: boolean;
  readonly pending: boolean;
}): "close" | "confirm" | "block" {
  return pending ? "block" : dirty ? "confirm" : "close";
}
