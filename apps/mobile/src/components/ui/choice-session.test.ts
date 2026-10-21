import { describe, expect, test } from "bun:test";
import { beginChoiceSession, closeChoiceSession, completeChoiceSession } from "./choice-session";
describe("native choice presenter sessions", () => {
  test("late seventh option cannot replace an open or exiting popover", () => {
    const opened = beginChoiceSession({ visible: false, kind: null }, "menu");
    expect(beginChoiceSession(opened, "search").kind).toBe("menu");
    const exiting = closeChoiceSession(opened);
    expect(exiting.kind).toBe("menu");
    expect(beginChoiceSession(exiting, "search").kind).toBe("menu");
  });
  test("policy is recomputed only after actual dismissal", () => {
    const closed = completeChoiceSession(
      closeChoiceSession(beginChoiceSession({ visible: false, kind: null }, "menu")),
    );
    expect(beginChoiceSession(closed, "search")).toEqual({ visible: true, kind: "search" });
  });
  test("a stale dismissal cannot clear a reopened presenter", () => {
    const reopened = beginChoiceSession({ visible: false, kind: "dialog" }, "search");
    expect(completeChoiceSession(reopened)).toBe(reopened);
  });
});
