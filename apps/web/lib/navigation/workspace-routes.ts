/** Presentation-only URL mapping. It never grants access to a route or a project. */
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
  presentation: WorkspacePresentation,
  nativeBridge = false,
): string {
  if (!href.startsWith("/") || href.startsWith("//") || /[\\\r\n]/.test(href)) return href;
  const url = new URL(href, "https://atria.invalid");
  if (!isWorkspacePath(url.pathname) && url.pathname !== "/admin" && url.pathname !== "/")
    return href;
  const canonical = canonicalWorkspacePath(url.pathname);
  url.pathname =
    presentation === "desktop" ? (canonical === "/" ? "/admin" : `/admin${canonical}`) : canonical;
  if (nativeBridge) url.searchParams.set("surface", "mobile");
  else if (url.searchParams.get("surface") === "mobile") url.searchParams.delete("surface");
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
  if (input.nativeBridge) return workspaceHref(input.href, "mobile", true);
  if (!input.canUseDesktop) return input.href;
  if (input.preference === "mobile") return workspaceHref(input.href, "mobile");
  if (input.preference === "desktop" || (input.automaticEnabled && input.viewportWidth >= 1024)) {
    return workspaceHref(input.href, "desktop");
  }
  return input.href;
}

/** History updates obey the current surface even when a caller uses a canonical URL. */
export function workspaceHistoryHref(nextHref: string, currentHref: string): string {
  const current = new URL(currentHref, "https://atria.invalid");
  const presentation =
    current.pathname === "/admin" || current.pathname.startsWith("/admin/") ? "desktop" : "mobile";
  return workspaceHref(nextHref, presentation, current.searchParams.get("surface") === "mobile");
}
