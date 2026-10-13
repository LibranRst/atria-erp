import { expect, test } from "bun:test";
import { nextStepAfter } from "./input-request-fields";

test("Next from project name cannot skip an unfilled contract value after visiting later fields", () => {
  expect(nextStepAfter(0, 4, 6)).toBe(1);
});
test("each Next advances exactly one field after revisiting an earlier step", () => {
  expect(nextStepAfter(1, 5, 6)).toBe(2);
  expect(nextStepAfter(2, 5, 6)).toBe(3);
});
