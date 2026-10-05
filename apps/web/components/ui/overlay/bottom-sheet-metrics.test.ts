import { describe, expect, test } from "bun:test";

import { calculateBottomSheetMetrics } from "./bottom-sheet-metrics";

describe("calculateBottomSheetMetrics", () => {
  test("keeps short content at its natural height without overflow", () => {
    expect(
      calculateBottomSheetMetrics({
        viewportHeight: 844,
        handleHeight: 20,
        headerHeight: 56,
        bodyHeight: 120,
        footerHeight: 76,
      }),
    ).toEqual({
      naturalHeight: 272,
      maximumHeight: 836,
      contentOverflows: false,
      canResize: true,
    });
  });

  test("allows medium content to resize between natural and full height", () => {
    const metrics = calculateBottomSheetMetrics({
      viewportHeight: 844,
      handleHeight: 20,
      headerHeight: 56,
      bodyHeight: 430,
      footerHeight: 92,
    });

    expect(metrics.naturalHeight).toBe(598);
    expect(metrics.maximumHeight).toBe(836);
    expect(metrics.contentOverflows).toBe(false);
    expect(metrics.canResize).toBe(true);
  });

  test("caps long content at the viewport and enables body overflow", () => {
    expect(
      calculateBottomSheetMetrics({
        viewportHeight: 667,
        handleHeight: 20,
        headerHeight: 56,
        bodyHeight: 900,
        footerHeight: 88,
      }),
    ).toEqual({
      naturalHeight: 659,
      maximumHeight: 659,
      contentOverflows: true,
      canResize: false,
    });
  });

  test("uses the latest viewport height when the keyboard reduces space", () => {
    const beforeKeyboard = calculateBottomSheetMetrics({
      viewportHeight: 844,
      handleHeight: 20,
      headerHeight: 56,
      bodyHeight: 420,
      footerHeight: 88,
    });
    const withKeyboard = calculateBottomSheetMetrics({
      viewportHeight: 470,
      handleHeight: 20,
      headerHeight: 56,
      bodyHeight: 420,
      footerHeight: 88,
    });

    expect(beforeKeyboard.contentOverflows).toBe(false);
    expect(withKeyboard.maximumHeight).toBe(462);
    expect(withKeyboard.contentOverflows).toBe(true);
  });

  test("does not enforce the normal minimum over a landscape keyboard viewport", () => {
    const metrics = calculateBottomSheetMetrics({
      viewportHeight: 170,
      handleHeight: 20,
      headerHeight: 56,
      bodyHeight: 420,
      footerHeight: 88,
    });
    expect(metrics.maximumHeight).toBe(162);
    expect(metrics.naturalHeight).toBe(162);
    expect(metrics.contentOverflows).toBe(true);
  });
});
