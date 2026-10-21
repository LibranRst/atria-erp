import { expect, test } from "bun:test";
import { deriveNativeShadow } from "./native-shadow-tokens";

test("native floating follows the semantic outer shadow rather than the inset rim", (): void => {
  expect(
    deriveNativeShadow("inset 0 1px 0 0 rgb(255 255 255 / 0.12), 0 14px 34px rgb(24 24 23 / 0.18)"),
  ).toEqual({
    shadowColor: "#181817",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 17,
    elevation: 17,
  });
});

test("negative sheet offsets and changes to token blur/opacity survive generation", (): void => {
  expect(deriveNativeShadow("0 -24px 80px rgb(0 0 0 / 0.28)")).toEqual({
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -24 },
    shadowOpacity: 0.28,
    shadowRadius: 40,
    elevation: 40,
  });
  expect(deriveNativeShadow("0 3px 8px rgb(24 24 23 / 0.05)").shadowRadius).toBe(4);
});

test("unsupported formats fail instead of introducing fallback shadow constants", (): void => {
  expect(() => deriveNativeShadow("inset 0 1px 0 0 rgb(255 255 255 / 0.12)")).toThrow();
  expect(() => deriveNativeShadow("0 1px 2px 5px rgb(24 24 23 / 0.05)")).toThrow();
});
