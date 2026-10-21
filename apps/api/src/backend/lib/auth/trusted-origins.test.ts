import { describe, expect, test } from "bun:test";
import { configuredAuthOrigins } from "./trusted-origins";

describe("independent browser auth origins", (): void => {
  test("admin is separately trusted without adding localhost to production", (): void => {
    expect(configuredAuthOrigins({}, true)).toContain("http://localhost:3002");
    expect(configuredAuthOrigins({}, false)).toEqual([]);
    expect(
      configuredAuthOrigins(
        {
          WEB_ORIGIN: "https://atria.example.test",
          ADMIN_ORIGIN: "https://admin.example.test",
          API_PUBLIC_URL: "https://api.example.test",
        },
        false,
      ),
    ).toEqual([
      "https://api.example.test",
      "https://atria.example.test",
      "https://admin.example.test",
    ]);
  });

  test("malformed optional origins are ignored and configured values normalize to origins", (): void => {
    expect(configuredAuthOrigins({ ADMIN_ORIGIN: "invalid" }, false)).toEqual([]);
    expect(
      configuredAuthOrigins({ ADMIN_ORIGIN: "https://admin.example.test/projects" }, false),
    ).toEqual(["https://admin.example.test"]);
  });
});
