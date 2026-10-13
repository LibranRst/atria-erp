import { AdminShell } from "@/components/admin-shell";
import { requireAdminActor } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const actor = await requireAdminActor();
  return <AdminShell actor={actor}>{children}</AdminShell>;
}
