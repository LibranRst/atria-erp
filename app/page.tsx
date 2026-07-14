import { resolveRoleName } from "@/lib/auth/permissions";
import { requireServerSession } from "@/lib/server/session";
import { redirect } from "next/navigation";

export default async function Home(): Promise<never> {
  const session = await requireServerSession();

  const roleName = await resolveRoleName(session.user.roleId);

  if (roleName === "OWNER" || roleName === "FINANCE_ADMIN") {
    redirect("/ledger");
  } else if (roleName === "PURCHASING") {
    redirect("/materials");
  } else {
    redirect("/projects");
  }
}
