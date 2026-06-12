import { auth } from "@/lib/auth";
import { resolveRoleName } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";

export default async function Home(): Promise<never> {
  // 1. Get session
  const session = await auth.api.getSession({
    headers: {
      cookie: (await (await import("next/headers")).cookies()).toString(),
    },
  });

  if (!session || !session.user) {
    redirect("/login");
  }

  // 2. Resolve role
  const roleName = await resolveRoleName(session.user.roleId);

  // 3. Redirect based on role
  if (roleName === "OWNER" || roleName === "FINANCE_ADMIN") {
    redirect("/ledger");
  } else {
    redirect("/projects");
  }
}
