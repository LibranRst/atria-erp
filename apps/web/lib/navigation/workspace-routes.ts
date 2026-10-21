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

/**
 * Route yang page server-nya tidak membaca `searchParams`: tab, filter, drawer,
 * dan aksi dibaca klien dari URL. `/settings`, `/onboarding`, `/` dan `/admin`
 * sengaja tidak termasuk karena loader server-nya memakai query.
 */
const CLIENT_QUERY_ROUTES = new Set([
  "/ledger",
  "/projects",
  "/expenses",
  "/approvals",
  "/materials",
  "/reconciliation",
  "/notifications",
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

export function isClientQueryRoute(pathname: string): boolean {
  const path = canonicalWorkspacePath(pathname);
  return CLIENT_QUERY_ROUTES.has(path) || /^\/projects\/[^/]+$/.test(path);
}

/**
 * Tautan yang hanya mengganti query pada route yang sama cukup diterapkan lewat
 * riwayat browser, sama seperti `SegmentedTabs`: data halaman sudah ada di
 * layar, jadi round-trip RSC hanya akan memunculkan skeleton penuh lalu memuat
 * ulang data yang sama. Mengembalikan `null` bila navigasi router biasa tetap
 * diperlukan (route lain, route yang membaca query di server, URL sama).
 */
export function shallowQueryHref(targetHref: string, currentHref: string): string | null {
  if (!targetHref.startsWith("/") || targetHref.startsWith("//") || /[\\\r\n]/.test(targetHref))
    return null;
  const current = new URL(currentHref, "https://atria.invalid");
  const target = new URL(targetHref, current);
  if (canonicalWorkspacePath(target.pathname) !== canonicalWorkspacePath(current.pathname))
    return null;
  if (!isClientQueryRoute(target.pathname)) return null;
  const next = new URL(
    workspaceHistoryHref(`${target.pathname}${target.search}${target.hash}`, currentHref),
    current,
  );
  if (next.pathname === current.pathname && next.search === current.search) return null;
  return `${next.pathname}${next.search}${next.hash}`;
}

export function resolveWorkspacePresentation(
  viewportWidth: number,
  nativeBridge = false,
): WorkspacePresentation {
  return !nativeBridge && viewportWidth >= 1024 ? "desktop" : "mobile";
}
