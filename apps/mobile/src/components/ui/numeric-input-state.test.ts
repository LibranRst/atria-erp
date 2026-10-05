import { describe, expect, test } from "bun:test";
import { numericDraftHasUncommittedEdits, parseNumericDraft } from "./numeric-input-state";

describe("editable numeric control drafts", () => {
  test("empty and partial decimal text do not become persisted zero/previous values", () => {
    for (const raw of ["", "-", ".", ",", "1.", "1,"])
      expect(parseNumericDraft(raw).kind).toBe("incomplete");
    expect(numericDraftHasUncommittedEdits("", 1)).toBe(true);
    expect(numericDraftHasUncommittedEdits("1,", 1)).toBe(true);
  });
  test("decimal comma and a leading separator produce the user's complete amount", () => {
    expect(parseNumericDraft("1,25", { min: 0.01 })).toEqual({ kind: "valid", value: 1.25 });
    expect(parseNumericDraft(".5")).toEqual({ kind: "valid", value: 0.5 });
    expect(numericDraftHasUncommittedEdits("01,25", 1.25)).toBe(false);
  });
  test("invalid text and bounds stay drafts while exact boundaries are accepted", () => {
    for (const raw of ["1,2,3", "1e2", "abc", "-1", "11"])
      expect(parseNumericDraft(raw, { min: 0, max: 10 }).kind).toBe("invalid");
    expect(parseNumericDraft("0", { min: 0, max: 10 })).toEqual({ kind: "valid", value: 0 });
    expect(parseNumericDraft("10", { min: 0, max: 10 })).toEqual({ kind: "valid", value: 10 });
    expect(numericDraftHasUncommittedEdits("2", 1)).toBe(true);
  });
  test("strictly positive quantities accept any positive fraction without coercing zero", () => {
    expect(parseNumericDraft("0", { strictlyPositive: true }).kind).toBe("invalid");
    expect(parseNumericDraft("0,0001", { strictlyPositive: true })).toEqual({
      kind: "valid",
      value: 0.0001,
    });
  });
});
