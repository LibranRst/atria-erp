import { describe, expect, test } from "bun:test";
import {
  workspaceHistoryHref,
  canonicalWorkspacePath,
  isWorkspacePath,
  resolveWorkspaceEntry,
  workspaceHref,
} from "./workspace-routes";

describe("workspace URLs", () => {
  test("preserves project IDs, filters, drawer state and hashes in both directions", () => {
    const source = "/projects/p-1?tab=rab&invoice=inv-1#review";
    expect(workspaceHref(source, "desktop")).toBe(`/admin${source}`);
    expect(workspaceHref(`/admin${source}`, "mobile")).toBe(source);
    expect(workspaceHref("/settings?admin=roles&newRole=true", "desktop")).toBe(
      "/admin/settings?admin=roles&newRole=true",
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
    expect(workspaceHref("/admin/ledger?tab=cash", "desktop")).toBe("/admin/ledger?tab=cash");
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
  test("automatic entry uses 1024px boundary", () => {
    expect(resolveWorkspaceEntry({ ...defaults, viewportWidth: 1023 })).toBe("/ledger");
    expect(resolveWorkspaceEntry({ ...defaults, viewportWidth: 1024 })).toBe("/admin/ledger");
  });
  test("manual choice takes precedence over viewport", () => {
    expect(resolveWorkspaceEntry({ ...defaults, preference: "mobile" })).toBe("/ledger");
    expect(resolveWorkspaceEntry({ ...defaults, viewportWidth: 390, preference: "desktop" })).toBe(
      "/admin/ledger",
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
  test("rollout flag leaves manual desktop entry available", () => {
    expect(resolveWorkspaceEntry({ ...defaults, automaticEnabled: false })).toBe("/ledger");
    expect(
      resolveWorkspaceEntry({ ...defaults, automaticEnabled: false, preference: "desktop" }),
    ).toBe("/admin/ledger");
  });
});

test("history tab updates cannot leave the current desktop or native surface", () => {
  expect(workspaceHistoryHref("/ledger?tab=budget", "/admin/ledger")).toBe(
    "/admin/ledger?tab=budget",
  );
  expect(workspaceHistoryHref("/ledger", "/admin/ledger?tab=accounts")).toBe("/admin/ledger");
  expect(workspaceHistoryHref("/settings?tab=catalog", "/admin/settings")).toBe(
    "/admin/settings?tab=catalog",
  );
  expect(workspaceHistoryHref("/ledger?tab=cash", "/ledger?surface=mobile")).toBe(
    "/ledger?tab=cash&surface=mobile",
  );
  expect(workspaceHistoryHref("/profile/password", "/admin/profile")).toBe("/profile/password");
});
