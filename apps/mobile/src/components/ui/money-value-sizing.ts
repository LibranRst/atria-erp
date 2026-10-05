/** Fit a measured single-line amount in JS; native auto-fit can ignore its scale floor. */
export function fittedMoneyFontSize({
  fontSize,
  availableWidth,
  naturalWidth,
  minimumScale,
}: {
  readonly fontSize: number;
  readonly availableWidth: number;
  readonly naturalWidth?: number;
  readonly minimumScale: number;
}): number {
  if (availableWidth <= 0 || !naturalWidth || naturalWidth <= 0) return fontSize;
  return Math.max(
    fontSize * minimumScale,
    Math.min(fontSize, (fontSize * availableWidth) / naturalWidth),
  );
}
