import { headers } from "@runtime/request-context";
import { redirect } from "@runtime/navigation";
import { cache } from "@runtime/react-cache";

import { auth } from "@backend/lib/auth";

export type ServerSession = Awaited<ReturnType<typeof auth.api.getSession>>;
export type RequiredServerSession = NonNullable<ServerSession>;

/**
 * Jalur tunggal pembacaan sesi.
 *
 * Menerima `Headers` apa pun, sehingga cookie (web) dan
 * `Authorization: Bearer` (klien native) diproses plugin yang sama tanpa
 * percabangan di sisi pemanggil. Penting: objek `Headers` yang utuh harus
 * diteruskan — bentuk `{ cookie }` polos akan menjatuhkan header authorization
 * dan membuat plugin `bearer()` tidak pernah terpakai.
 */
export async function getSessionFromHeaders(requestHeaders: Headers): Promise<ServerSession> {
  try {
    return await auth.api.getSession({ headers: requestHeaders });
  } catch (error) {
    console.error("Failed to read Better Auth session:", error);
    return null;
  }
}

// Share one pending lookup (including anonymous results) only within the active
// RequestContext. Explicit header reads remain uncached for read-after-write.
const readRequestSession = cache(async (): Promise<ServerSession> => {
  return getSessionFromHeaders(await headers());
});

/**
 * Compatibility entry for extracted actions/loaders. Read the complete HTTP
 * header set from API request context, preserving native bearer credentials.
 */
export async function getServerSession(): Promise<ServerSession> {
  return readRequestSession();
}

/**
 * Compatibility loaders return explicit portable redirect control flow;
 * the web transport translates it into its framework's redirect behavior.
 */
export async function requireServerSession(redirectTo = "/login"): Promise<RequiredServerSession> {
  const session = await getServerSession();
  if (!session?.user) {
    redirect(redirectTo);
  }
  return session;
}
