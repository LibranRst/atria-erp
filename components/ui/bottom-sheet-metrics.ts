export const SHEET_TOP_GAP = 8;
export const MIN_SHEET_HEIGHT = 196;
export const MIN_RESIZE_DISTANCE = 56;

export type BottomSheetMetricsInput = {
  readonly viewportHeight: number;
  readonly handleHeight: number;
  readonly headerHeight: number;
  readonly bodyHeight: number;
  readonly footerHeight: number;
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
}: BottomSheetMetricsInput): BottomSheetMetrics {
  const maximumHeight = Math.max(
    MIN_SHEET_HEIGHT,
    Math.floor(viewportHeight - SHEET_TOP_GAP),
  );
  const measuredHeight = Math.ceil(
    handleHeight + headerHeight + bodyHeight + footerHeight,
  );
  const contentOverflows = measuredHeight > maximumHeight;
  const naturalHeight = contentOverflows
    ? maximumHeight
    : Math.min(
        maximumHeight,
        Math.max(MIN_SHEET_HEIGHT, measuredHeight),
      );

  return {
    naturalHeight,
    maximumHeight,
    contentOverflows,
    canResize:
      !contentOverflows &&
      maximumHeight - naturalHeight > MIN_RESIZE_DISTANCE,
  };
}
