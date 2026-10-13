export const SHEET_TOP_GAP = 8;
export const DESKTOP_SHEET_VIEWPORT_GAP = 48;
export const MIN_SHEET_HEIGHT = 196;
export const MIN_RESIZE_DISTANCE = 56;

export type BottomSheetMetricsInput = {
  readonly viewportHeight: number;
  readonly handleHeight: number;
  readonly headerHeight: number;
  readonly bodyHeight: number;
  readonly footerHeight: number;
  readonly viewportGap?: number;
  /** Total vertical extent of a parallel footer panel, including its insets. */
  readonly asideHeight?: number;
};

export type BottomSheetMetrics = {
  readonly naturalHeight: number;
  readonly maximumHeight: number;
  readonly contentOverflows: boolean;
  readonly canResize: boolean;
};

export function calculateBottomSheetMetrics({
  viewportHeight,
  handleHeight,
  headerHeight,
  bodyHeight,
  footerHeight,
  viewportGap = SHEET_TOP_GAP,
  asideHeight = 0,
}: BottomSheetMetricsInput): BottomSheetMetrics {
  const maximumHeight = Math.max(0, Math.floor(viewportHeight - viewportGap));
  const measuredHeight = Math.ceil(
    Math.max(handleHeight + headerHeight + bodyHeight + footerHeight, asideHeight),
  );
  const contentOverflows = measuredHeight > maximumHeight;
  const naturalHeight = contentOverflows
    ? maximumHeight
    : Math.min(maximumHeight, Math.max(MIN_SHEET_HEIGHT, measuredHeight));

  return {
    naturalHeight,
    maximumHeight,
    contentOverflows,
    canResize: !contentOverflows && maximumHeight - naturalHeight > MIN_RESIZE_DISTANCE,
  };
}
