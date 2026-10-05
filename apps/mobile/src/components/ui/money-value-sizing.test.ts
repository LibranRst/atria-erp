import { expect, test } from "bun:test";
import { fittedMoneyFontSize } from "./money-value-sizing";
test("initial or wider layouts retain the focal font instead of shrinking to native 4pt", () => {
  expect(fittedMoneyFontSize({ fontSize: 30, availableWidth: 0, minimumScale: 0.56 })).toBe(30);
  expect(
    fittedMoneyFontSize({
      fontSize: 30,
      availableWidth: 338,
      naturalWidth: 211.62,
      minimumScale: 0.56,
    }),
  ).toBe(30);
});
test("long amounts scale to measured width with a readable lower bound", () => {
  expect(
    fittedMoneyFontSize({
      fontSize: 30,
      availableWidth: 256,
      naturalWidth: 320,
      minimumScale: 0.56,
    }),
  ).toBe(24);
  expect(
    fittedMoneyFontSize({
      fontSize: 30,
      availableWidth: 80,
      naturalWidth: 320,
      minimumScale: 0.56,
    }),
  ).toBeCloseTo(16.8);
});
