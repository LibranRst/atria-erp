import { workspaceHref } from "@/lib/navigation/workspace-routes";
import { redirect } from "next/navigation";

import { resolveHomeDestination } from "@/features/navigation/server/home-destination";
import { requireServerSession } from "@/lib/server/session";
import { resolveActor } from "@/server/actor";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly surface?: string }>;
}): Promise<never> {
  await requireServerSession();

  const actor = await resolveActor();
  if (!actor) redirect("/login");

  const destination = await resolveHomeDestination(actor);
  const query = await searchParams;
  redirect(query.surface === "mobile" ? workspaceHref(destination, "mobile", true) : destination);
}
