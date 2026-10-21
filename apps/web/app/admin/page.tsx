import { workspaceHref } from "@/lib/navigation/workspace-routes";
import { LegacyWorkspaceRedirect } from "@/components/layout/legacy-workspace-redirect";
import { getPostLoginRedirectDestination } from "@/app/actions/auth-navigation";

export const dynamic = "force-dynamic";

export default async function LegacyWorkspaceHome({
  searchParams,
}: {
  readonly searchParams: Promise<Readonly<Record<string, string | readonly string[] | undefined>>>;
}): Promise<React.JSX.Element> {
  const query = await searchParams;
  // The root alias resolves the existing account/onboarding/home policy first,
  // avoiding a second server redirect at `/` that would discard the fragment.
  const home = await getPostLoginRedirectDestination(
    query.surface === "mobile" ? { surface: "mobile" } : undefined,
  );
  const destination = new URL(home, "https://atria.invalid");
  const preserved = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") preserved.append(key, value);
    else if (value) for (const item of value) preserved.append(key, item);
  }
  for (const key of new Set(preserved.keys())) {
    // Mandatory home gate parameters (for example onboarding step) win.
    if (destination.searchParams.has(key)) continue;
    for (const value of preserved.getAll(key)) destination.searchParams.append(key, value);
  }
  return (
    <LegacyWorkspaceRedirect
      canonicalHref={workspaceHref(`${destination.pathname}${destination.search}`, "mobile")}
    />
  );
}
