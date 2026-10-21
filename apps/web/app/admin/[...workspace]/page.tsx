import { notFound } from "next/navigation";
import { isWorkspacePath, workspaceHref } from "@/lib/navigation/workspace-routes";
import { LegacyWorkspaceRedirect } from "@/components/layout/legacy-workspace-redirect";

type Query = Readonly<Record<string, string | readonly string[] | undefined>>;
export const dynamic = "force-dynamic";

/** Compatibility only: one loader, session and URL for every screen size. */
export default async function LegacyWorkspacePage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly workspace: readonly string[] }>;
  readonly searchParams: Promise<Query>;
}): Promise<React.JSX.Element> {
  const { workspace } = await params;
  const path = `/${workspace.join("/")}`;
  if (!isWorkspacePath(path)) notFound();
  const query = await searchParams;
  const preserved = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") preserved.append(key, value);
    else if (value) for (const item of value) preserved.append(key, item);
  }
  return (
    <LegacyWorkspaceRedirect
      canonicalHref={workspaceHref(
        `/admin${path}${preserved.size ? `?${preserved}` : ""}`,
        "mobile",
      )}
    />
  );
}
