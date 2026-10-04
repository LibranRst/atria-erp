import "server-only";

import { revalidatePath } from "next/cache";
import { canonicalWorkspacePath, isWorkspacePath } from "@/lib/navigation/workspace-routes";

type RevalidationType = "page" | "layout";

/** Preserve project IDs and route patterns while invalidating both presentations. */
export function workspaceInvalidationPaths(
  path: string,
  type?: RevalidationType,
): readonly string[] {
  // The root layout already covers both complete subtrees, including auth state.
  if (path === "/" && type === "layout") return [path];
  if (path === "/" || path === "/admin") return ["/", "/admin"];

  const canonicalPath = canonicalWorkspacePath(path);
  if (!isWorkspacePath(canonicalPath)) return [path];

  // Admin detail routes are served by one catch-all. A legacy dynamic page
  // pattern must invalidate that actual route pattern, not an invented one.
  const desktopPath =
    canonicalPath.includes("[") && type
      ? type === "layout"
        ? "/admin"
        : "/admin/[...workspace]"
      : `/admin${canonicalPath}`;
  return [canonicalPath, desktopPath];
}

/** Server Actions share data; their invalidation must reach mobile and desktop routes. */
export function revalidateWorkspacePath(path: string, type?: RevalidationType): void {
  for (const target of workspaceInvalidationPaths(path, type)) {
    revalidatePath(target, type);
  }
}
