import { expect, test } from "bun:test";
import {
  workspaceHref,
  workspaceHistoryHref,
  resolveWorkspacePresentation,
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
