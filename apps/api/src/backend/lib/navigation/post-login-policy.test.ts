import { expect, test } from "bun:test";
import { postLoginDestination } from "./post-login-policy";

test("login deep links preserve drawer IDs and mandatory gates", () => {
  expect(postLoginDestination("/ledger", "/projects/p?tab=rab#review", false)).toBe(
    "/projects/p?tab=rab#review",
  );
  expect(postLoginDestination("/onboarding?step=welcome", "/admin/projects/p", false)).toBe(
    "/onboarding?step=welcome",
  );
  expect(postLoginDestination("/profile/password", "/admin/ledger", false)).toBe(
    "/profile/password",
  );
});
test("login uses canonical URLs independent of retired desktop permission", () => {
  for (const path of ["https://example.com", "//example.com", "/api/trpc", "/unknown"])
    expect(postLoginDestination("/ledger", path, false)).toBe("/ledger");
  expect(postLoginDestination("/ledger", "/admin/projects/p?tab=rap", false)).toBe(
    "/projects/p?tab=rap",
  );
  expect(postLoginDestination("/ledger", "/admin/projects/p?tab=rap", true)).toBe(
    "/projects/p?tab=rap&surface=mobile",
  );
});
