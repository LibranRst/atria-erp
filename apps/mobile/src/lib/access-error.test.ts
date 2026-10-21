import { expect, test } from "bun:test";
import { isAccessRevoked } from "./access-error";

test("refetch authorization failure mencabut affordance cached; offline tetap bisa membaca cache", () => {
  expect(isAccessRevoked({ data: { code: "UNAUTHORIZED" } })).toBe(true);
  expect(isAccessRevoked({ data: { code: "FORBIDDEN" } })).toBe(true);
  expect(isAccessRevoked(new Error("Network request failed"))).toBe(false);
  expect(isAccessRevoked({ data: { code: "INTERNAL_SERVER_ERROR" } })).toBe(false);
});
