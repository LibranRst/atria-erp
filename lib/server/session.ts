import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export type ServerSession = Awaited<ReturnType<typeof auth.api.getSession>>;
export type RequiredServerSession = NonNullable<ServerSession>;

export async function getServerSession(): Promise<ServerSession> {
  try {
    return await auth.api.getSession({
      headers: {
        cookie: (await cookies()).toString(),
      },
    });
  } catch (error) {
    console.error("Failed to read Better Auth session:", error);
    return null;
  }
}

export async function requireServerSession(
  redirectTo = "/login",
): Promise<RequiredServerSession> {
  const session = await getServerSession();
  if (!session?.user) {
    redirect(redirectTo);
  }
  return session;
}
