import { canonicalWorkspacePath, isWorkspacePath } from "./workspace-routes";

const ACCOUNT_GATES = new Set(["/login", "/setup", "/profile/password"]);

/** Only validated canonical workspace destinations can replace a historical link. */
export function legacyWorkspaceRedirectHref(canonicalHref: string, hash: string): string | null {
  if (
    !canonicalHref.startsWith("/") ||
    canonicalHref.startsWith("//") ||
    /[\\\r\n]/.test(canonicalHref)
  )
    return null;
  const url = new URL(canonicalHref, "https://atria.invalid");
  if (
    canonicalWorkspacePath(url.pathname) !== url.pathname ||
    (!isWorkspacePath(url.pathname) && url.pathname !== "/" && !ACCOUNT_GATES.has(url.pathname))
  )
    return null;
  // Fragments never reach the server. Assigning URL.hash keeps it a fragment,
  // including punctuation or encoded content, rather than a new destination.
  if (hash) url.hash = hash;
  return `${url.pathname}${url.search}${url.hash}`;
}
