import { describe, expect, test } from "bun:test";
import {
  workspaceHistoryHref,
  canonicalWorkspacePath,
  isWorkspacePath,
  resolveWorkspaceEntry,
  resolveWorkspacePresentation,
  workspaceHref,
} from "./workspace-routes";

describe("workspace URLs", () => {
  test("preserves project IDs, filters, drawer state and hashes in both directions", () => {
    const source = "/projects/p-1?tab=rab&invoice=inv-1#review";
    expect(workspaceHref(source, "desktop")).toBe(source);
    expect(workspaceHref(`/admin${source}`, "mobile")).toBe(source);
    expect(workspaceHref("/settings?admin=roles&newRole=true", "desktop")).toBe(
      "/settings?admin=roles&newRole=true",
    );
  });
  test("does not map public, API, external or unknown URLs", () => {
    for (const path of [
      "/login",
      "/profile/password",
      "/api/trpc",
      "/setup",
      "/unknown",
      "//example.com",
      "https://example.com",
      "/projects/a/unknown",
    ])
      expect(workspaceHref(path, "desktop")).toBe(path);
    expect(isWorkspacePath("/admin/materials")).toBe(true);
    expect(canonicalWorkspacePath("/admin/projects/a")).toBe("/projects/a");
  });
  test("mapping is idempotent", () => {
    expect(workspaceHref("/admin/ledger?tab=cash", "desktop")).toBe("/ledger?tab=cash");
    expect(workspaceHref("/admin", "mobile")).toBe("/");
  });
});

describe("browser entry policy", () => {
  const defaults = {
    href: "/ledger",
    canUseDesktop: true,
    viewportWidth: 1440,
    preference: null,
    nativeBridge: false,
    automaticEnabled: true,
  } as const;
  test("viewport changes presentation without changing the canonical URL", () => {
    expect(resolveWorkspaceEntry({ ...defaults, viewportWidth: 1023 })).toBe("/ledger");
    expect(resolveWorkspaceEntry({ ...defaults, viewportWidth: 1024 })).toBe("/ledger");
    expect(resolveWorkspacePresentation(1023)).toBe("mobile");
    expect(resolveWorkspacePresentation(1024)).toBe("desktop");
    expect(resolveWorkspacePresentation(1440, true)).toBe("mobile");
  });
  test("retired preferences do not add a second URL", () => {
    expect(resolveWorkspaceEntry({ ...defaults, preference: "mobile" })).toBe("/ledger");
    expect(resolveWorkspaceEntry({ ...defaults, viewportWidth: 390, preference: "desktop" })).toBe(
      "/ledger",
    );
  });
  test("native browser fallback remains mobile even with desktop preference", () => {
    expect(
      resolveWorkspaceEntry({
        ...defaults,
        href: "/admin/projects/a?tab=rab",
        preference: "desktop",
        nativeBridge: true,
      }),
    ).toBe("/projects/a?tab=rab&surface=mobile");
  });
  test("presentation cannot grant access or override password change", () => {
    expect(resolveWorkspaceEntry({ ...defaults, canUseDesktop: false })).toBe("/ledger");
    expect(resolveWorkspaceEntry({ ...defaults, href: "/profile/password" })).toBe(
      "/profile/password",
    );
  });
  test("retired desktop rollout flags no longer alter navigation", () => {
    expect(resolveWorkspaceEntry({ ...defaults, automaticEnabled: false })).toBe("/ledger");
    expect(
      resolveWorkspaceEntry({ ...defaults, automaticEnabled: false, preference: "desktop" }),
    ).toBe("/ledger");
  });
});

test("history tab updates canonicalize old desktop links and retain native hints", () => {
  expect(workspaceHistoryHref("/ledger?tab=budget", "/admin/ledger")).toBe("/ledger?tab=budget");
  expect(workspaceHistoryHref("/ledger", "/admin/ledger?tab=accounts")).toBe("/ledger");
  expect(workspaceHistoryHref("/settings?tab=catalog", "/admin/settings")).toBe(
    "/settings?tab=catalog",
  );
  expect(workspaceHistoryHref("/ledger?tab=cash", "/ledger?surface=mobile")).toBe(
    "/ledger?tab=cash&surface=mobile",
  );
  expect(workspaceHistoryHref("/profile/password", "/admin/profile")).toBe("/profile/password");
});
