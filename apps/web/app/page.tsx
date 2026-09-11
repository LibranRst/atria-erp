import { redirect } from "next/navigation";

import { resolveHomeDestination } from "@/features/navigation/server/home-destination";
import { requireServerSession } from "@/lib/server/session";
import { resolveActor } from "@/server/actor";

export const dynamic = "force-dynamic";

export default async function Home(): Promise<never> {
  await requireServerSession();

  const actor = await resolveActor();
  if (!actor) redirect("/login");

  const destination = await resolveHomeDestination(actor);
  redirect(destination);
}
