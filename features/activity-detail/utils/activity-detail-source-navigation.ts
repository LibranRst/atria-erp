type ActivityDetailSourceNavigationContext = {
  readonly sourceHref: string;
  readonly pathname: string;
  readonly activeTab: string | null;
};

export function isActivityDetailSourceRepresentedInCurrentContext({
  sourceHref,
  pathname,
  activeTab,
}: ActivityDetailSourceNavigationContext): boolean {
  try {
    const sourceUrl = new URL(sourceHref, "http://localhost");

    if (sourceUrl.pathname === pathname) return true;

    return (
      pathname.startsWith("/projects/") &&
      activeTab === "expenses" &&
      sourceUrl.pathname === "/expenses" &&
      sourceUrl.searchParams.get("tab") === "field-claims"
    );
  } catch {
    return false;
  }
}
