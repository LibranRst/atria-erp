import { expect, test } from "bun:test";
import {
  workspaceHref,
  workspaceHistoryHref,
  resolveWorkspacePresentation,
  shallowQueryHref,
} from "./workspace-routes";

test("one canonical URL retains every project ID, query and fragment", () => {
  const href = "/projects/p-123?tab=budget&invoice=i-1#allocation";
  expect(workspaceHref(href, "desktop")).toBe(href);
  expect(workspaceHref(`/admin${href}`, "mobile")).toBe(href);
  expect(workspaceHistoryHref("/admin/ledger?tab=budget#risk", "/ledger")).toBe(
    "/ledger?tab=budget#risk",
  );
});

test("native fallback is pinned without granting access or rewriting public routes", () => {
  expect(resolveWorkspacePresentation(1440, true)).toBe("mobile");
  expect(resolveWorkspacePresentation(1024)).toBe("desktop");
  expect(resolveWorkspacePresentation(1023)).toBe("mobile");
  expect(workspaceHref("/projects/p-123?surface=mobile#budget", "desktop")).toBe(
    "/projects/p-123?surface=mobile#budget",
  );
  expect(workspaceHistoryHref("/ledger?tab=cash", "/projects?surface=mobile")).toBe(
    "/ledger?tab=cash&surface=mobile",
  );
  expect(workspaceHref("/profile/password", "desktop", true)).toBe("/profile/password");
});

test("query-only links on client-read routes stay on the page without an RSC round-trip", () => {
  expect(shallowQueryHref("/ledger?tab=cash", "https://app.test/ledger")).toBe("/ledger?tab=cash");
  expect(
    shallowQueryHref("/ledger?tab=accounts&account=a-1", "https://app.test/ledger?tab=cash"),
  ).toBe("/ledger?tab=accounts&account=a-1");
  expect(shallowQueryHref("/projects/p-1?tab=budget", "https://app.test/projects/p-1")).toBe(
    "/projects/p-1?tab=budget",
  );
  expect(shallowQueryHref("/ledger?tab=cash", "https://app.test/ledger?surface=mobile")).toBe(
    "/ledger?tab=cash&surface=mobile",
  );
});

test("route changes, server-read queries and repeated URLs keep a normal router navigation", () => {
  expect(shallowQueryHref("/expenses?tab=bills", "https://app.test/ledger")).toBeNull();
  expect(shallowQueryHref("/projects/p-2", "https://app.test/projects/p-1")).toBeNull();
  expect(shallowQueryHref("/settings?tab=setup", "https://app.test/settings")).toBeNull();
  expect(shallowQueryHref("/onboarding?step=2", "https://app.test/onboarding?step=1")).toBeNull();
  expect(shallowQueryHref("/ledger?tab=cash", "https://app.test/ledger?tab=cash")).toBeNull();
  expect(
    shallowQueryHref("https://evil.test/ledger?tab=cash", "https://app.test/ledger"),
  ).toBeNull();
  expect(shallowQueryHref("//evil.test/ledger", "https://app.test/ledger")).toBeNull();
});
