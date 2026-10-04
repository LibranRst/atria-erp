import { redirect } from "next/navigation";
import { resolveActor } from "@/server/actor";
import { actorCan } from "@/lib/auth/permissions";
import { resolveHomeDestination } from "@/features/navigation/server/home-destination";
import { availableAdminNavigation, canAccessAdminPath } from "@/lib/navigation/admin-navigation";
import { workspaceHref } from "@/lib/navigation/workspace-routes";
import { PageState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminHome({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly surface?: string }>;
}): Promise<React.JSX.Element> {
  if ((await searchParams).surface === "mobile") redirect("/?surface=mobile");
  const actor = await resolveActor();
  if (!actor) redirect("/login");
  if (!actorCan(actor, "use:desktop_admin"))
    return (
      <PageState
        kind="restricted"
        title="Akses desktop dibatasi"
        description="Peran Anda belum memiliki akses desktop."
      />
    );
  const home = await resolveHomeDestination(actor);
  if (canAccessAdminPath(home, actor.permissions)) redirect(workspaceHref(home, "desktop"));
  const first = availableAdminNavigation(actor.permissions)[0];
  if (first) redirect(first.href);
  return (
    <PageState
      kind="restricted"
      title="Belum ada modul yang dapat dibuka"
      description="Akses desktop sudah aktif. Minta Owner memberikan izin modul yang diperlukan untuk pekerjaan Anda."
    />
  );
}
