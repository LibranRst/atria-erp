import { cookies } from "next/headers";
import { auth } from "@/lib/auth";

export async function getAdministrationActor(): Promise<{
  id: string;
  roleId: string;
} | null> {
  const authSession = await auth.api.getSession({
    headers: { cookie: (await cookies()).toString() },
  });
  return authSession?.user ? { id: authSession.user.id, roleId: authSession.user.roleId } : null;
}

export function cleanAdministrationValue(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
