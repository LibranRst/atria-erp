import { describe, expect, test } from "bun:test";

import {
  computeFollowTarget,
  isUpwardGesture,
  isUpwardScrollKey,
  STREAM_TOP_INSET_PX,
} from "./use-chat-scroll";

const VIEWPORT = { scrollHeight: 2400, clientHeight: 800, topInset: STREAM_TOP_INSET_PX };

describe("following latest question", () => {
  test("stops when the user question reaches the top reading inset", () => {
    expect(computeFollowTarget({ ...VIEWPORT, anchorOffset: 1000 })).toBe(
      1000 - STREAM_TOP_INSET_PX,
    );
  });
  test("longer answers cannot move beyond the same question", () => {
    expect(computeFollowTarget({ ...VIEWPORT, scrollHeight: 5000, anchorOffset: 1000 })).toBe(
      1000 - STREAM_TOP_INSET_PX,
    );
  });
  test("short answers stop at the available bottom and missing anchors fall back safely", () => {
    expect(computeFollowTarget({ ...VIEWPORT, anchorOffset: 2000 })).toBe(1600);
    expect(computeFollowTarget({ ...VIEWPORT, anchorOffset: null })).toBe(1600);
    expect(computeFollowTarget({ ...VIEWPORT, anchorOffset: 20 })).toBe(0);
  });
  test("desktop uses its contextual reading inset", () => {
    expect(computeFollowTarget({ ...VIEWPORT, anchorOffset: 1000, topInset: 16 })).toBe(984);
  });
  test("short content never scrolls to a negative position", () => {
    expect(
      computeFollowTarget({
        scrollHeight: 400,
        clientHeight: 800,
        anchorOffset: null,
        topInset: 72,
      }),
    ).toBe(0);
  });
});

describe("arah gerakan pengguna", () => {
  test("gerakan ke atas menghentikan pengikutan", () => {
    expect(isUpwardGesture(-40)).toBe(true);
  });

  test("gerakan ke bawah tidak menghentikan pengikutan", () => {
    expect(isUpwardGesture(40)).toBe(false);
  });

  test("getaran jari di bawah deadzone diabaikan", () => {
    expect(isUpwardGesture(-1)).toBe(false);
    expect(isUpwardGesture(0)).toBe(false);
  });
});

describe("tombol papan ketik yang menghentikan pengikutan", () => {
  test("panah atas di area percakapan menghentikan pengikutan", () => {
    expect(isUpwardScrollKey("ArrowUp", null)).toBe(true);
    expect(isUpwardScrollKey("PageUp", null)).toBe(true);
    expect(isUpwardScrollKey("Home", null)).toBe(true);
  });

  test("tombol lain tidak berpengaruh", () => {
    expect(isUpwardScrollKey("ArrowDown", null)).toBe(false);
    expect(isUpwardScrollKey("Enter", null)).toBe(false);
  });

  test("panah atas di dalam composer hanya memindahkan kursor teks", () => {
    expect(isUpwardScrollKey("ArrowUp", { tagName: "TEXTAREA", isContentEditable: false })).toBe(
      false,
    );
    expect(isUpwardScrollKey("ArrowUp", { tagName: "INPUT", isContentEditable: false })).toBe(
      false,
    );
    expect(isUpwardScrollKey("ArrowUp", { tagName: "DIV", isContentEditable: true })).toBe(false);
  });

  test("panah atas di gelembung percakapan tetap menghentikan pengikutan", () => {
    expect(isUpwardScrollKey("ArrowUp", { tagName: "DIV", isContentEditable: false })).toBe(true);
  });
});
