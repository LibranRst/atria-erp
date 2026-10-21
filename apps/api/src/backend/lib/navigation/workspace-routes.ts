/** Canonical workspace URLs. Viewport presentation never authorizes data or changes routes. */
export type WorkspacePresentation = "mobile" | "desktop";

const ROOTS = new Set([
  "/ledger",
  "/projects",
  "/expenses",
  "/approvals",
  "/materials",
  "/reconciliation",
  "/settings",
  "/profile",
  "/notifications",
  "/ai",
  "/onboarding",
]);
const CHILDREN = new Set([
  "/expenses/new",
  "/materials/opening",
  "/settings/budget",
  "/settings/categories",
  "/settings/library",
  "/settings/materials",
  "/onboarding/review",
]);

export function canonicalWorkspacePath(pathname: string): string {
  if (pathname === "/admin") return "/";
  return pathname.startsWith("/admin/") ? pathname.slice(6) : pathname;
}

export function isWorkspacePath(pathname: string): boolean {
  const path = canonicalWorkspacePath(pathname);
  return ROOTS.has(path) || CHILDREN.has(path) || /^\/projects\/[^/]+$/.test(path);
}

export function workspaceHref(
  href: string,
  _presentation: WorkspacePresentation,
  nativeBridge = false,
): string {
  if (!href.startsWith("/") || href.startsWith("//") || /[\\\r\n]/.test(href)) return href;
  const url = new URL(href, "https://atria.invalid");
  if (!isWorkspacePath(url.pathname) && url.pathname !== "/admin" && url.pathname !== "/")
    return href;
  const canonical = canonicalWorkspacePath(url.pathname);
  url.pathname = canonical;
  if (nativeBridge) url.searchParams.set("surface", "mobile");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function resolveWorkspaceEntry(input: {
  readonly href: string;
  readonly canUseDesktop: boolean;
  readonly viewportWidth: number;
  readonly preference: WorkspacePresentation | null;
  readonly nativeBridge: boolean;
  readonly automaticEnabled: boolean;
}): string {
  return workspaceHref(input.href, "mobile", input.nativeBridge);
}

/** History updates preserve a native fallback hint and never add a presentation prefix. */
export function workspaceHistoryHref(nextHref: string, currentHref: string): string {
  const current = new URL(currentHref, "https://atria.invalid");
  return workspaceHref(nextHref, "mobile", current.searchParams.get("surface") === "mobile");
}

export function resolveWorkspacePresentation(
  viewportWidth: number,
  nativeBridge = false,
): WorkspacePresentation {
  return !nativeBridge && viewportWidth >= 1024 ? "desktop" : "mobile";
}
