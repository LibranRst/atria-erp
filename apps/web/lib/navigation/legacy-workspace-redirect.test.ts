import { expect, test } from "bun:test";
import { legacyWorkspaceRedirectHref } from "./legacy-workspace-redirect";

test("legacy replacement explicitly carries the browser fragment with IDs and query", () => {
  expect(legacyWorkspaceRedirectHref("/projects/p-1?tab=budget&invoice=i-2", "#review")).toBe(
    "/projects/p-1?tab=budget&invoice=i-2#review",
  );
  expect(legacyWorkspaceRedirectHref("/projects?filter=ACTIVE&surface=mobile", "#review")).toBe(
    "/projects?filter=ACTIVE&surface=mobile#review",
  );
  expect(legacyWorkspaceRedirectHref("/?surface=mobile", "#review")).toBe(
    "/?surface=mobile#review",
  );
  expect(legacyWorkspaceRedirectHref("/projects", "#https://example.com")).toBe(
    "/projects#https://example.com",
  );
  expect(legacyWorkspaceRedirectHref("/profile/password", "#review")).toBe(
    "/profile/password#review",
  );
});

test("legacy replacement cannot leave canonical internal workspace destinations", () => {
  for (const href of [
    "https://example.com",
    "//example.com",
    "/\\example.com",
    "/admin/projects",
    "/api/trpc",
    "/unknown",
    "/projects\r\nhttps://example.com",
  ])
    expect(legacyWorkspaceRedirectHref(href, "#review")).toBeNull();
});
