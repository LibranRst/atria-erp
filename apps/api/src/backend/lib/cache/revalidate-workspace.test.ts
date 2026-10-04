import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

import { workspaceInvalidationPaths } from "./revalidate-workspace";

test("workspace invalidation preserves IDs and resolves actual dynamic route patterns", () => {
  expect(workspaceInvalidationPaths("/projects/project-123")).toEqual([
    "/projects/project-123",
    "/admin/projects/project-123",
  ]);
  expect(workspaceInvalidationPaths("/projects/[id]", "page")).toEqual([
    "/projects/[id]",
    "/admin/[...workspace]",
  ]);
  expect(workspaceInvalidationPaths("/projects/[id]", "layout")).toEqual([
    "/projects/[id]",
    "/admin",
  ]);
  expect(workspaceInvalidationPaths("/settings/materials")).toEqual([
    "/settings/materials",
    "/admin/settings/materials",
  ]);
  expect(workspaceInvalidationPaths("/admin/onboarding/review")).toEqual([
    "/onboarding/review",
    "/admin/onboarding/review",
  ]);
});

test("root layout invalidation is shared and public/API routes stay unchanged", () => {
  expect(workspaceInvalidationPaths("/", "layout")).toEqual(["/"]);
  expect(workspaceInvalidationPaths("/")).toEqual(["/", "/admin"]);
  expect(workspaceInvalidationPaths("/admin")).toEqual(["/", "/admin"]);
  for (const path of ["/login", "/setup", "/api/trpc", "/admin/unsupported"]) {
    expect(workspaceInvalidationPaths(path)).toEqual([path]);
  }
});

test("server helper forwards page/layout semantics to the cache adapter for both surfaces", async () => {
  // Isolate the cache adapter mock so it cannot change other finance test suites.
  const child = Bun.spawn(
    [
      process.execPath,
      "--preload",
      "./scripts/test-preload.ts",
      "./src/backend/lib/cache/fixtures/revalidate-workspace-case.ts",
    ],
    { cwd: fileURLToPath(new URL("../../../..", import.meta.url)), stdout: "pipe", stderr: "pipe" },
  );
  const [output, error, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect({ code, error, output }).toEqual({
    code: 0,
    error: "",
    output: "Workspace invalidation passed\n",
  });
});
