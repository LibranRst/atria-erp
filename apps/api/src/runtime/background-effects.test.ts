import { expect, test } from "bun:test";
import { BackgroundEffects } from "./background-effects";

test("effect/reporting failure is contained and pending work drains", async (): Promise<void> => {
  let delivered = 0;
  let failures = 0;
  const effects = new BackgroundEffects((): void => {
    failures += 1;
    throw new Error("reporting unavailable");
  });
  effects.schedule([
    async (): Promise<void> => {
      delivered += 1;
    },
    async (): Promise<void> => {
      throw new Error("delivery retry required");
    },
  ]);
  expect(await effects.drain(500)).toBe(true);
  expect(delivered).toBe(1);
  expect(failures).toBe(1);
});
