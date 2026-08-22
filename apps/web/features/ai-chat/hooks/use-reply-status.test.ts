import { describe, expect, test } from "bun:test";

import {
  REPLY_STATUS_APPEAR_DELAY_MS,
  REPLY_STATUS_PHASE_STABILITY_MS,
  resolvePresentedReplyPhase,
} from "./use-reply-status";

describe("reply status presentation", () => {
  test("memakai delay tampil dan stabilisasi yang disepakati", () => {
    expect(REPLY_STATUS_APPEAR_DELAY_MS).toBe(180);
    expect(REPLY_STATUS_PHASE_STABILITY_MS).toBe(400);
  });

  test("fetching mengambil alih label pada render yang sama", () => {
    expect(resolvePresentedReplyPhase("fetching", "analyzing", true)).toBe("fetching");
  });

  test("fase lain tetap melewati state stabilisasi", () => {
    expect(resolvePresentedReplyPhase("composing", "analyzing", true)).toBe("analyzing");
    expect(resolvePresentedReplyPhase("fetching", "analyzing", false)).toBe("analyzing");
  });
});
