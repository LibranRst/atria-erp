import { currentRequestContext } from "./request-context";

export function revalidatePath(path: string, type?: "page" | "layout"): void {
  const context = currentRequestContext();
  if (context) context.invalidations.set(`${type ?? ""}:${path}`, { path, type });
}

/** Authenticated API reads have no shared data cache; tags require no API-side work. */
export function revalidateTag(_tag: string, _profile?: string | { expire?: number }): void {}

export function updateTag(_tag: string): void {}
