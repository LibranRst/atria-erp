import { expect, mock } from "bun:test";

const calls: Array<{ readonly path: string; readonly type?: "page" | "layout" }> = [];
mock.module("@runtime/cache", () => ({
  revalidatePath(path: string, type?: "page" | "layout"): void {
    calls.push({ path, type });
  },
}));
const { revalidateWorkspacePath } = await import("../revalidate-workspace");
revalidateWorkspacePath("/projects/[id]", "page");
revalidateWorkspacePath("/settings", "layout");
revalidateWorkspacePath("/", "layout");
expect(calls).toEqual([
  { path: "/projects/[id]", type: "page" },
  { path: "/admin/[...workspace]", type: "page" },
  { path: "/settings", type: "layout" },
  { path: "/admin/settings", type: "layout" },
  { path: "/", type: "layout" },
]);
console.log("Workspace invalidation passed");
