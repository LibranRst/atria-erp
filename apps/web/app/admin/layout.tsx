import { resolveActor } from "@/server/actor";
import { actorCan } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { PageState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const actor = await resolveActor();
  if (!actor) redirect("/login");
  if (!actorCan(actor, "use:desktop_admin"))
    return (
      <PageState
        kind="restricted"
        title="Akses desktop dibatasi"
        description="Minta Owner mengaktifkan akses workspace desktop untuk peran Anda."
      />
    );
  // A layout boundary makes the presentation explicit for independently streamed
  // and prefetched route content as well as the root client shell.
  return (
    <WorkspacePresentationProvider presentation="desktop">{children}</WorkspacePresentationProvider>
  );
}
