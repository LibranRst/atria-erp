import { describe, expect, test } from "bun:test";
import {
  sheetBodyHeight,
  sheetBottomClearance,
  sheetDismissalDecision,
  sheetFocusedInputScrollDelta,
  sheetFooterPadding,
  sheetScrollBounds,
  sheetClampScrollOffset,
  sheetContentMinimumHeight,
  sheetEffectiveBottomInset,
  sheetScrollTarget,
  sheetReadingRestoreOffset,
  restoreSheetReadingPosition,
} from "./sheet-state";

// Replay the installed Fabric scrollTo command's raw-inset clamp. UIKit's
// adjusted header inset is absent from this calculation; overflow bypasses it.
function replayFabricScrollCommand({
  target,
  contentHeight,
  viewportHeight,
  rawTopInset,
  rawBottomInset,
  overflowEnabled,
}: {
  readonly target: number;
  readonly contentHeight: number;
  readonly viewportHeight: number;
  readonly rawTopInset: number;
  readonly rawBottomInset: number;
  readonly overflowEnabled: boolean;
}): number {
  if (overflowEnabled) return target;
  const minimum = Math.min(-rawTopInset, 0);
  const maximum =
    minimum +
    Math.max(contentHeight - viewportHeight + rawBottomInset + Math.max(rawTopInset, 0), 0.01);
  return Math.min(maximum, Math.max(minimum, target));
}

describe("sheet bottom inset ownership", () => {
  test("safe area and declared content inset remain when no keyboard owns the viewport", () => {
    expect(sheetEffectiveBottomInset({ safeAreaInset: 34, keyboardVisible: false })).toBe(34);
    expect(
      sheetEffectiveBottomInset({
        safeAreaInset: 34,
        declaredInset: 48,
        nativeInset: 405,
        keyboardOverlap: 405,
        keyboardVisible: false,
      }),
    ).toBe(48);
  });

  test("visible keyboard overlap remains reserved while native inset reporting catches up", () => {
    for (const nativeInset of [0, 320, 405])
      expect(
        sheetEffectiveBottomInset({
          safeAreaInset: 34,
          nativeInset,
          keyboardOverlap: 405,
          keyboardVisible: true,
        }),
      ).toBe(405);
  });

  test("a visible keyboard keeps the larger native or measured overlap without adding safe area twice", () => {
    expect(
      sheetEffectiveBottomInset({
        safeAreaInset: 34,
        declaredInset: 48,
        nativeInset: 405,
        keyboardOverlap: 331,
        keyboardVisible: true,
      }),
    ).toBe(405);
  });

  test("hidden keyboard scroll and measure reports cannot alternately shrink the captured viewport floor", () => {
    const geometry = { viewportHeight: 812, topInset: 70, readingOffset: 120 };
    for (const nativeInset of [405, 390, 34, 0]) {
      const scrollInset = sheetEffectiveBottomInset({
        safeAreaInset: 34,
        nativeInset,
        keyboardVisible: false,
        keyboardOverlap: 405,
      });
      const measuredInset = sheetEffectiveBottomInset({
        safeAreaInset: 34,
        nativeInset: 0,
        keyboardVisible: false,
        keyboardOverlap: 0,
      });
      expect(scrollInset).toBe(measuredInset);
      expect(sheetContentMinimumHeight({ ...geometry, bottomInset: scrollInset })).toBe(898);
      expect(sheetContentMinimumHeight({ ...geometry, bottomInset: measuredInset })).toBe(898);
    }
  });
});

describe("native form content extent before client-mode changes", () => {
  const geometry = { viewportHeight: 812, topInset: 70, bottomInset: 34 };

  test("a short form covers the visible viewport beneath adjusted system insets", () => {
    expect(sheetContentMinimumHeight(geometry)).toBe(708);
    expect(sheetContentMinimumHeight({ ...geometry, readingOffset: -120 })).toBe(708);
    expect(sheetContentMinimumHeight({ viewportHeight: 80, topInset: 70, bottomInset: 34 })).toBe(
      0,
    );
  });

  test("new-to-existing content shrink preserves the legal resting offset without a restore command", () => {
    const captured = -70;
    const minimum = sheetContentMinimumHeight({ ...geometry, readingOffset: captured });
    const commands: number[] = [];
    for (const naturalHeight of [1201, 589, 577]) {
      const contentHeight = Math.max(naturalHeight, minimum);
      const bounds = sheetScrollBounds({ ...geometry, contentHeight });
      const nativeOffset = replayFabricScrollCommand({
        target: sheetClampScrollOffset(captured, bounds),
        contentHeight,
        viewportHeight: geometry.viewportHeight,
        rawTopInset: 0,
        rawBottomInset: 0,
        overflowEnabled: true,
      });
      expect(nativeOffset).toBe(captured);
      restoreSheetReadingPosition({
        captured,
        current: nativeOffset,
        bounds,
        screenReaderEnabled: false,
        scrollTo: (offset) => commands.push(offset),
        restoreAccessibilityFocus: () => undefined,
      });
    }
    expect(commands).toEqual([]);
  });

  test("a positive reading offset reserves only its visible viewport instead of the old content peak", () => {
    const captured = 120;
    const minimum = sheetContentMinimumHeight({ ...geometry, readingOffset: captured });
    expect(minimum).toBe(898);
    expect(minimum).toBeLessThan(1201);
    expect(
      sheetClampScrollOffset(captured, sheetScrollBounds({ ...geometry, contentHeight: 589 })),
    ).toBe(-70);
    const commands: number[] = [];
    for (const naturalHeight of [1201, 589, 577]) {
      const contentHeight = Math.max(naturalHeight, minimum);
      const bounds = sheetScrollBounds({ ...geometry, contentHeight });
      const nativeOffset = replayFabricScrollCommand({
        target: sheetClampScrollOffset(captured, bounds),
        contentHeight,
        viewportHeight: geometry.viewportHeight,
        rawTopInset: 0,
        rawBottomInset: 0,
        overflowEnabled: true,
      });
      expect(nativeOffset).toBe(captured);
      restoreSheetReadingPosition({
        captured,
        current: nativeOffset,
        bounds,
        screenReaderEnabled: false,
        scrollTo: (offset) => commands.push(offset),
        restoreAccessibilityFocus: () => undefined,
      });
    }
    expect(commands).toEqual([]);
  });

  test("the floor follows the current viewport and keyboard bottom inset", () => {
    expect(sheetContentMinimumHeight({ ...geometry, bottomInset: 405 })).toBe(337);
    expect(sheetContentMinimumHeight({ ...geometry, viewportHeight: 430 })).toBe(326);
  });
});

describe("adjusted native scroll bounds", () => {
  test("a short body has one resting position below its floating header", () => {
    const bounds = sheetScrollBounds({
      contentHeight: 589,
      viewportHeight: 812,
      topInset: 70,
      bottomInset: 34,
    });
    expect(bounds).toEqual({ minimum: -70, maximum: -70 });
    expect(sheetClampScrollOffset(620, bounds)).toBe(-70);
  });

  test("safe-area and keyboard bottom insets extend the reachable content end", () => {
    const geometry = { contentHeight: 1201, viewportHeight: 812, topInset: 70 };
    const resting = sheetScrollBounds({ ...geometry, bottomInset: 34 });
    const keyboard = sheetScrollBounds({ ...geometry, bottomInset: 405 });
    expect(resting).toEqual({ minimum: -70, maximum: 423 });
    expect(keyboard).toEqual({ minimum: -70, maximum: 794 });
    expect(sheetClampScrollOffset(620, resting)).toBe(423);
    expect(sheetClampScrollOffset(620, keyboard)).toBe(620);
  });

  test("native overflow preserves a valid negative reading offset that Fabric otherwise clamps to zero", () => {
    for (const contentHeight of [589, 1201]) {
      const viewportHeight = 812;
      const commands: number[] = [];
      restoreSheetReadingPosition({
        captured: -70,
        current: -68,
        bounds: sheetScrollBounds({ contentHeight, viewportHeight, topInset: 70, bottomInset: 34 }),
        screenReaderEnabled: false,
        scrollTo: (offset) => commands.push(offset),
        restoreAccessibilityFocus: () => undefined,
      });
      expect(commands).toEqual([-70]);
      const target = commands[0];
      if (target === undefined) throw new Error("Expected a reading-position restore command.");
      const native = {
        target,
        contentHeight,
        viewportHeight,
        rawTopInset: 0,
        rawBottomInset: 0,
      };
      expect(replayFabricScrollCommand({ ...native, overflowEnabled: false })).toBeCloseTo(0);
      expect(replayFabricScrollCommand({ ...native, overflowEnabled: true })).toBe(-70);
    }
  });

  test("overflow-enabled commands cannot preserve a positive offset beyond newly shortened content", () => {
    const geometry = { contentHeight: 978, viewportHeight: 812, topInset: 70, bottomInset: 34 };
    const target = sheetClampScrollOffset(620, sheetScrollBounds(geometry));
    expect(target).toBe(200);
    expect(
      replayFabricScrollCommand({
        target,
        contentHeight: geometry.contentHeight,
        viewportHeight: geometry.viewportHeight,
        rawTopInset: 0,
        rawBottomInset: 0,
        overflowEnabled: true,
      }),
    ).toBe(200);
  });
});

describe("client selector reading-position return", () => {
  test("native touch dismissal never repairs a changed offset when scroll restoration is disabled", () => {
    const commands: string[] = [];
    restoreSheetReadingPosition({
      captured: -70,
      current: -180,
      restoreScroll: false,
      screenReaderEnabled: false,
      scrollTo: (offset) => commands.push(`scroll:${offset}`),
      restoreAccessibilityFocus: () => commands.push("focus"),
    });
    expect(commands).toEqual([]);
  });

  test("native assistive dismissal returns focus without a post-layout scroll correction", () => {
    const commands: string[] = [];
    restoreSheetReadingPosition({
      captured: -70,
      current: -180,
      restoreScroll: false,
      screenReaderEnabled: true,
      scrollTo: (offset) => commands.push(`scroll:${offset}`),
      restoreAccessibilityFocus: () => commands.push("focus"),
    });
    expect(commands).toEqual(["focus"]);
  });

  test("touch selection with an unchanged offset sends no native scroll or AX-focus commands", () => {
    const commands: string[] = [];
    restoreSheetReadingPosition({
      captured: -70,
      current: -70,
      screenReaderEnabled: false,
      scrollTo: (offset) => commands.push(`scroll:${offset}`),
      restoreAccessibilityFocus: () => commands.push("focus"),
    });
    expect(commands).toEqual([]);
  });
  test("screen-reader return preserves reading offset before returning assistive focus", () => {
    const commands: string[] = [];
    restoreSheetReadingPosition({
      captured: -70,
      current: 0,
      screenReaderEnabled: true,
      scrollTo: (offset) => commands.push(`scroll:${offset}`),
      restoreAccessibilityFocus: () => commands.push("focus"),
    });
    expect(commands).toEqual(["scroll:-70", "focus"]);
  });
  test("existing/new client layout swap does not rewrite an unchanged native offset", () => {
    expect(sheetReadingRestoreOffset(-70, -70)).toBeNull();
    expect(sheetReadingRestoreOffset(160, 160.25)).toBeNull();
  });
  test("a presenter-caused offset change still returns to the captured reading position", () => {
    expect(sheetReadingRestoreOffset(-70, 0)).toBe(-70);
    expect(sheetReadingRestoreOffset(160, 248)).toBe(160);
  });
  test("a captured offset outside the shrunken content returns only to its reachable bottom", () => {
    const commands: number[] = [];
    restoreSheetReadingPosition({
      captured: 620,
      current: 250,
      bounds: { minimum: -70, maximum: 280 },
      screenReaderEnabled: false,
      scrollTo: (offset) => commands.push(offset),
      restoreAccessibilityFocus: () => undefined,
    });
    expect(commands).toEqual([280]);
  });
  test("a native shrink already at the reachable bottom sends no redundant restore", () => {
    const commands: number[] = [];
    restoreSheetReadingPosition({
      captured: 620,
      current: 280,
      bounds: { minimum: -70, maximum: 280 },
      screenReaderEnabled: false,
      scrollTo: (offset) => commands.push(offset),
      restoreAccessibilityFocus: () => undefined,
    });
    expect(commands).toEqual([]);
  });
  test("an unchanged captured offset still corrects overscroll after content shrinks", () => {
    const commands: number[] = [];
    restoreSheetReadingPosition({
      captured: 620,
      current: 620,
      bounds: { minimum: -70, maximum: 280 },
      screenReaderEnabled: false,
      scrollTo: (offset) => commands.push(offset),
      restoreAccessibilityFocus: () => undefined,
    });
    expect(commands).toEqual([280]);
  });
  test("restoration cannot move above the adjusted safe-area resting offset", () => {
    const commands: number[] = [];
    restoreSheetReadingPosition({
      captured: -120,
      current: 0,
      bounds: { minimum: -70, maximum: 280 },
      screenReaderEnabled: false,
      scrollTo: (offset) => commands.push(offset),
      restoreAccessibilityFocus: () => undefined,
    });
    expect(commands).toEqual([-70]);
  });
});

describe("floating header field clearance", () => {
  test("the first field may rest at the automatic negative header inset", () => {
    expect(sheetScrollTarget({ offset: -56, delta: -12, topInset: 56 })).toBe(-56);
    expect(sheetScrollTarget({ offset: 0, delta: -56, topInset: 56 })).toBe(-56);
  });
  test("focusing a lower field subtracts header occlusion before scrolling", () => {
    expect(sheetScrollTarget({ offset: 100, delta: 300 - 56 - 12, topInset: 56 })).toBe(332);
    expect(sheetScrollTarget({ offset: 100, delta: -500 })).toBe(0);
  });
  test("overflow-enabled focus commands stay within the reachable content range", () => {
    expect(sheetScrollTarget({ offset: 250, delta: 120, topInset: 70, maximumOffset: 280 })).toBe(
      280,
    );
    expect(sheetScrollTarget({ offset: 50, delta: -200, topInset: 70, maximumOffset: 280 })).toBe(
      -70,
    );
  });
});

describe("floating footer scroll clearance", () => {
  test("the captured Project scroll limit must allow its last field above the footer", () => {
    // iOS 26.5: viewport 812, wrapper 744, offset 225/225, end 772, footer top 732.
    const reserve = sheetBottomClearance({
      footerHeight: 98,
      viewportTop: 86,
      viewportHeight: 812,
      footerTop: 732,
    });
    const replayedEnd = 772 - (reserve - 110);
    expect(replayedEnd).toBeLessThanOrEqual(720);
  });
  test("matching native and layout bounds keep ordinary footer spacing", () => {
    expect(
      sheetBottomClearance({
        footerHeight: 98,
        viewportTop: 86,
        viewportHeight: 744,
        footerTop: 732,
      }),
    ).toBe(110);
  });
  test("keyboard insets already reserved by the native scroll must not be counted twice", () => {
    expect(
      sheetBottomClearance({
        footerHeight: 72,
        viewportTop: 86,
        viewportHeight: 812,
        footerTop: 409,
        bottomInset: 405,
      }),
    ).toBe(96);
  });
  test("keyboard-owned space is excluded while native inset reporting catches up", () => {
    expect(
      sheetBottomClearance({
        footerHeight: 72,
        viewportTop: 0,
        viewportHeight: 812,
        footerTop: 409,
        bottomInset: 0,
        keyboardTop: 481,
      }),
    ).toBe(84);
  });
});

describe("content growth preserves the sheet reading position", () => {
  test("an oversized textarea does not alternate whole-frame top and bottom reveals", () => {
    for (const inputTop of [80, -198])
      expect(
        sheetFocusedInputScrollDelta({
          inputTop,
          inputHeight: 900,
          viewportTop: 0,
          headerHeight: 56,
          footerTop: 714,
        }),
      ).toBe(0);
  });
  test("the first native measurement cannot reduce an existing footer reserve", () => {
    // Captured iOS 26.5 growth trace: native viewport 812, footer top 714,
    // footer height 98, header 56. The provisional reserve was 166 before
    // native measurement replaced it with 110, shrinking the scroll range.
    const initialPadding = sheetFooterPadding({ footerHeight: 98, headerHeight: 56 });
    const measuredPadding = sheetFooterPadding({
      footerHeight: 98,
      headerHeight: 56,
      measuredClearance: 110,
      previousPadding: initialPadding,
    });
    expect(measuredPadding).toBeGreaterThanOrEqual(initialPadding);
  });

  test("a temporary footer relayout does not shrink the previous native reserve", () => {
    // The same native geometry briefly reported footer height 94 rather than
    // 98. Dropping the reserve from 110 to 106 must not move settled content.
    expect(
      sheetFooterPadding({
        footerHeight: 94,
        headerHeight: 56,
        measuredClearance: 106,
        previousPadding: 110,
      }),
    ).toBeGreaterThanOrEqual(110);
  });

  test("a fully visible input does not move only to recreate footer breathing room", () => {
    expect(
      sheetFocusedInputScrollDelta({
        inputTop: 500,
        inputHeight: 213,
        viewportTop: 0,
        headerHeight: 56,
        footerTop: 714,
      }),
    ).toBe(0);
  });

  test("a visible input below the header does not move only to recreate label breathing room", () => {
    expect(
      sheetFocusedInputScrollDelta({
        inputTop: 70,
        inputHeight: 52,
        viewportTop: 0,
        headerHeight: 56,
        footerTop: 714,
      }),
    ).toBe(0);
  });

  test("an input actually occluded by the footer still requests a reveal", () => {
    expect(
      sheetFocusedInputScrollDelta({
        inputTop: 680,
        inputHeight: 60,
        viewportTop: 0,
        headerHeight: 56,
        footerTop: 714,
      }),
    ).toBeGreaterThan(0);
  });

  test("an input actually occluded by the header still requests a reveal", () => {
    expect(
      sheetFocusedInputScrollDelta({
        inputTop: 40,
        inputHeight: 52,
        viewportTop: 0,
        headerHeight: 56,
        footerTop: 714,
      }),
    ).toBeLessThan(0);
  });
});

const phone = { viewportHeight: 874, topInset: 62, headerHeight: 56 };
describe("native sheet body geometry", () => {
  test("provisional loading measurements do not lock the ready sheet to a false peak", () => {
    const provisionalHeight = sheetBodyHeight({
      ...phone,
      contentHeight: 620,
      contentPhase: "loading",
    });
    expect(
      sheetBodyHeight({ ...phone, contentHeight: 0, provisionalHeight, readyMeasured: false }),
    ).toBe(620);
    const firstReady = sheetBodyHeight({ ...phone, contentHeight: 320, provisionalHeight });
    expect(firstReady).toBe(320);
    expect(sheetBodyHeight({ ...phone, contentHeight: 280, previousHeight: firstReady })).toBe(320);
  });
  test("a short body includes footer clearance without occupying the full screen", () => {
    expect(sheetBodyHeight({ ...phone, contentHeight: 120 + 96 })).toBe(216);
  });
  test("long forms start bounded before loading or measurement", () => {
    expect(sheetBodyHeight({ ...phone, contentHeight: 0, sizing: "maximum" })).toBe(744);
    expect(sheetBodyHeight({ ...phone, contentHeight: 2200 })).toBe(744);
  });
  test("loading, dynamic fields, inline errors and removal cannot shrink a session", () => {
    let peak = sheetBodyHeight({ ...phone, contentHeight: 280 });
    peak = sheetBodyHeight({ ...phone, contentHeight: 480, previousHeight: peak });
    peak = sheetBodyHeight({ ...phone, contentHeight: 528, previousHeight: peak });
    expect(sheetBodyHeight({ ...phone, contentHeight: 200, previousHeight: peak })).toBe(528);
    expect(sheetBodyHeight({ ...phone, contentHeight: 200 })).toBe(200);
  });
  test("rotation can clamp a previous peak, and large font content scrolls", () => {
    expect(
      sheetBodyHeight({
        viewportHeight: 430,
        topInset: 0,
        headerHeight: 44,
        contentHeight: 900,
        previousHeight: 744,
      }),
    ).toBe(374);
  });
  test("a compact 568pt viewport reserves both system chrome and sheet clearance", () => {
    expect(
      sheetBodyHeight({ viewportHeight: 568, topInset: 20, headerHeight: 56, contentHeight: 1800 }),
    ).toBe(480);
  });
});
describe("shared dismissal policy", () => {
  test("clean closes and dirty asks before leaving", () => {
    expect(sheetDismissalDecision({ dirty: false, pending: false })).toBe("close");
    expect(sheetDismissalDecision({ dirty: true, pending: false })).toBe("confirm");
  });
  test("save, submission, upload and OCR block both clean and dirty dismissal", () => {
    for (const dirty of [false, true])
      expect(sheetDismissalDecision({ dirty, pending: true })).toBe("block");
  });
});
