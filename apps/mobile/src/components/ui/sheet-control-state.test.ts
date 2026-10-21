import { describe, expect, test } from "bun:test";
import { createSheetControlState } from "./sheet-control-state";
import { numericDraftHasUncommittedEdits, parseNumericDraft } from "./numeric-input-state";

describe("registered control validation and dismissal state", () => {
  test("raw edits remain dirty and block submit even when the persisted form payload is clean", () => {
    const state = createSheetControlState();
    let raw = "1";
    let persisted = 1;
    const unregister = state.registerControl("quantity", {
      validate: (): string | null => {
        const result = parseNumericDraft(raw, { min: 0.01 });
        return result.kind === "valid" ? null : result.error;
      },
      hasUncommittedEdits: (): boolean => numericDraftHasUncommittedEdits(raw, persisted),
    });
    let notices = 0;
    const unsubscribe = state.subscribeControlState(() => notices++);
    raw = "";
    state.notifyControlState();
    expect(persisted).toBe(1);
    expect(state.hasUncommittedEdits()).toBe(true);
    expect(Object.keys(state.validateControls())).toEqual(["quantity"]);
    raw = "1,5";
    persisted = 1.5;
    state.notifyControlState();
    expect(state.hasUncommittedEdits()).toBe(false);
    expect(state.validateControls()).toEqual({});
    expect(notices).toBe(2);
    unsubscribe();
    unregister();
    expect(state.validateControls()).toEqual({});
  });
  test("a stale unmount cannot unregister the replacement control", () => {
    const state = createSheetControlState();
    const first = state.registerControl("quantity", {
      validate: () => "Old",
      hasUncommittedEdits: () => false,
    });
    const second = state.registerControl("quantity", {
      validate: () => "Current",
      hasUncommittedEdits: () => true,
    });
    first();
    expect(state.validateControls()).toEqual({ quantity: "Current" });
    expect(state.hasUncommittedEdits()).toBe(true);
    second();
    expect(state.hasUncommittedEdits()).toBe(false);
  });
});
