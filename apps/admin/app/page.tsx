import { redirect } from "next/navigation";
import { requireAdminActor } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function HomePage(): Promise<never> {
  const actor = await requireAdminActor();
  redirect(actor.permissions.includes("view:budget") ? "/projects" : "/restricted?reason=module");
}
