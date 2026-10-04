import { expect, test } from "bun:test";
import { postLoginDestination } from "./post-login-policy";

test("login deep links preserve drawer IDs and mandatory gates", () => {
  expect(postLoginDestination("/ledger", "/admin/projects/p?tab=rab#review", false, true)).toBe(
    "/admin/projects/p?tab=rab#review",
  );
  expect(postLoginDestination("/onboarding?step=welcome", "/admin/projects/p", false, true)).toBe(
    "/onboarding?step=welcome",
  );
  expect(postLoginDestination("/profile/password", "/admin/ledger", false, true)).toBe(
    "/profile/password",
  );
});
test("login cannot redirect outside known workspaces or grant desktop", () => {
  for (const path of ["https://example.com", "//example.com", "/api/trpc", "/unknown"])
    expect(postLoginDestination("/ledger", path, false, true)).toBe("/ledger");
  expect(postLoginDestination("/ledger", "/admin/projects/p?tab=rap", false, false)).toBe(
    "/projects/p?tab=rap",
  );
  expect(postLoginDestination("/ledger", "/admin/projects/p?tab=rap", true, true)).toBe(
    "/projects/p?tab=rap&surface=mobile",
  );
});
