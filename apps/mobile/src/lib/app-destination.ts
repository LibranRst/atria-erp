import { cashActivityDetailRequestSchema } from "@atria/core/activity-detail/validation";

export type NativeDestination =
  | {
      readonly pathname:
        | "/ledger"
        | "/projects"
        | "/expenses"
        | "/approvals"
        | "/expenses/new"
        | "/modal/project"
        | "/modal/account"
        | "/modal/activity"
        | "/modal/approval";
      readonly params?: Readonly<Record<string, string>>;
    }
  | { readonly pathname: "/projects/[projectId]"; readonly params: { readonly projectId: string } };

export type AppDestination =
  | { readonly kind: "native"; readonly href: NativeDestination }
  | { readonly kind: "web"; readonly path: string };

const WEB_PATHS = new Set([
  "/ledger",
  "/projects",
  "/expenses",
  "/expenses/new",
  "/approvals",
  "/materials",
  "/materials/opening",
  "/reconciliation",
  "/settings",
  "/settings/budget",
  "/settings/categories",
  "/settings/library",
  "/settings/materials",
  "/profile",
  "/profile/password",
  "/notifications",
  "/onboarding",
  "/onboarding/review",
  "/ai",
  "/setup",
]);
const LEDGER_TABS = new Set(["overview", "approvals", "budget", "cash", "accounts", "materials"]);

/** Konteks tujuan dipertahankan; layar yang belum diport memakai bridge web eksplisit. */
export function resolveAppDestination(
  destination: string,
  preferWeb = false,
): AppDestination | null {
  if (!destination.startsWith("/") || destination.startsWith("//") || /[\\\r\n]/.test(destination))
    return null;
  const url = new URL(destination, "https://atria.invalid");
  const projectMatch = /^\/projects\/([^/]+)$/.exec(url.pathname);
  const detailRoute = url.pathname === "/modal/activity" || url.pathname === "/modal/approval";
  if (!WEB_PATHS.has(url.pathname) && !projectMatch && !detailRoute) return null;
  if ([...url.searchParams.keys()].some((key) => /token|authorization|password/i.test(key)))
    return null;
  if (preferWeb)
    return detailRoute ? null : { kind: "web", path: `${url.pathname}${url.search}${url.hash}` };
  const keys = [...url.searchParams.keys()];
  if (url.pathname === "/modal/activity") {
    const parsed = cashActivityDetailRequestSchema.safeParse({
      kind: url.searchParams.get("kind"),
      id: url.searchParams.get("id"),
    });
    return parsed.success && keys.every((key) => key === "kind" || key === "id")
      ? { kind: "native", href: { pathname: "/modal/activity", params: parsed.data } }
      : null;
  }
  if (url.pathname === "/modal/approval") {
    const approval = url.searchParams.get("approval");
    return approval &&
      approval.length <= 200 &&
      !/[\\\r\n]/.test(approval) &&
      keys.every((key) => key === "approval")
      ? { kind: "native", href: { pathname: "/modal/approval", params: { approval } } }
      : null;
  }
  const tab = url.searchParams.get("tab");
  const account = url.searchParams.get("account");
  if (
    url.pathname === "/ledger" &&
    tab === "accounts" &&
    account?.trim() &&
    keys.every((key) => key === "tab" || key === "account")
  ) {
    return { kind: "native", href: { pathname: "/modal/account", params: { account } } };
  }
  if (
    url.pathname === "/ledger" &&
    keys.every((key) => key === "tab") &&
    (!tab || LEDGER_TABS.has(tab))
  ) {
    return { kind: "native", href: { pathname: "/ledger", ...(tab ? { params: { tab } } : {}) } };
  }
  if (
    url.pathname === "/projects" &&
    url.searchParams.get("new-project") === "true" &&
    keys.length === 1
  ) {
    return { kind: "native", href: { pathname: "/modal/project" } };
  }
  if (
    (url.pathname === "/expenses" &&
      url.searchParams.get("new-expense") === "true" &&
      keys.length === 1) ||
    (url.pathname === "/expenses/new" && keys.length === 0)
  ) {
    return { kind: "native", href: { pathname: "/expenses/new" } };
  }
  if (
    (url.pathname === "/projects" ||
      url.pathname === "/expenses" ||
      url.pathname === "/approvals") &&
    keys.length === 0
  ) {
    return { kind: "native", href: { pathname: url.pathname } };
  }
  if (projectMatch?.[1] && keys.every((key) => key === "tab") && (!tab || tab === "overview")) {
    let projectId: string;
    try {
      projectId = decodeURIComponent(projectMatch[1]);
    } catch {
      return null;
    }
    if (/[\/\\\r\n]/.test(projectId)) return null;
    return { kind: "native", href: { pathname: "/projects/[projectId]", params: { projectId } } };
  }
  return { kind: "web", path: `${url.pathname}${url.search}${url.hash}` };
}
