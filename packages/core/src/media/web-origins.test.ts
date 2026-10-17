import { expect, test } from "bun:test";
import { additionalWebOriginsSchema, configuredAttachmentOrigins } from "./web-origins";

test("additional origins are exact, normalized and explicitly configured", (): void => {
  expect(additionalWebOriginsSchema.parse(undefined)).toEqual([]);
  expect(
    additionalWebOriginsSchema.parse(" https://old.atria.test/, https://old.atria.test "),
  ).toEqual(["https://old.atria.test"]);
  expect(
    configuredAttachmentOrigins({
      WEB_ORIGIN: "https://new.atria.test",
      API_PUBLIC_URL: "https://api.atria.test",
      WEB_ADDITIONAL_ORIGINS: "https://old.atria.test",
    }),
  ).toEqual(["https://new.atria.test", "https://api.atria.test", "https://old.atria.test"]);
  for (const origin of [
    "https://*.atria.test",
    "https://user:pass@atria.test",
    "https://atria.test/path",
    "https://atria.test?x=1",
    "https://atria.test#hash",
    "atria://",
    "null",
  ]) {
    expect(() => additionalWebOriginsSchema.parse(origin)).toThrow();
  }
});
