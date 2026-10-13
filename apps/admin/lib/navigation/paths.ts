const localBase = "https://atria-admin.invalid";

function localURL(href: string): URL | null {
  if (!href.startsWith("/") || href.startsWith("//") || /[\\\r\n]/.test(href)) return null;
  if (/%(?:00|0a|0d|5c)/i.test(href)) return null;
  try {
    const url = new URL(href, localBase);
    return url.origin === localBase ? url : null;
  } catch {
    return null;
  }
}

/** Canonical backend URLs are interpreted in this frontend, preserving IDs/query/hash. */
export function adminLocalHref(href: string): string | null {
  const url = localURL(href);
  if (!url) return null;
  if (url.pathname === "/admin") url.pathname = "/";
  else if (url.pathname.startsWith("/admin/")) url.pathname = url.pathname.slice(6);
  if (url.pathname === "/profile/password") url.pathname = "/change-password";
  if (url.pathname === "/profile") url.pathname = "/account";
  if (url.pathname === "/onboarding/review") {
    url.pathname = "/onboarding";
    url.searchParams.set("flow", "review");
  }
  if (url.pathname === "/ledger" || url.pathname === "/budget" || url.pathname === "/")
    url.pathname = "/projects";
  if (url.searchParams.get("surface") === "mobile") url.searchParams.delete("surface");
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Phase-one return destinations are explicitly local, with authorization still server-owned. */
export function safeAdminReturnTo(href: string | undefined): string {
  const canonical = href ? adminLocalHref(href) : null;
  if (!canonical) return "/projects";
  const pathname = new URL(canonical, localBase).pathname;
  if (
    pathname === "/projects" ||
    pathname.startsWith("/projects/") ||
    pathname === "/change-password" ||
    pathname === "/account" ||
    pathname === "/onboarding"
  )
    return canonical;
  return "/projects";
}

export interface AdminInvalidation {
  readonly path: string;
  readonly type?: "page" | "layout";
}

/** API invalidations describe domain views; each frontend owns its route interpretation. */
export function adminInvalidations(input: AdminInvalidation): readonly AdminInvalidation[] {
  if (input.path === "/" || input.path === "/admin" || input.path === "/admin/[...workspace]")
    return [{ path: "/", type: "layout" }];
  const canonical = adminLocalHref(input.path);
  if (!canonical) return [];
  const path = new URL(canonical, localBase).pathname.replace(/\[id\]/g, "[projectId]");
  if (path === "/projects") return [{ path, type: input.type }];
  if (path === "/account") return [{ path, type: input.type }];
  if (/^\/projects\/[^/]+$/.test(path))
    return [
      { path, type: input.type },
      { path: `${path}/budget`, type: input.type },
    ];
  if (/^\/projects\/[^/]+\/budget$/.test(path)) return [{ path, type: input.type }];
  // Other modules still run in web during phase one; do not invent admin routes.
  return [];
}
