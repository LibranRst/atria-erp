import type { ServerSession } from "@atria/api/contract";
import { z } from "zod";
import type { BackendConnection } from "./config";
import { BackendTransportError, backendRequestHeaders, type BackendFetch } from "./http";

const authDate = z.union([z.string().datetime({ offset: true }), z.date()]).pipe(z.coerce.date());
const sessionSchema = z
  .object({
    user: z
      .object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        emailVerified: z.boolean(),
        image: z.string().nullish(),
        roleId: z.string(),
        isActive: z.boolean(),
        mustChangePassword: z.boolean(),
        createdAt: authDate,
        updatedAt: authDate,
      })
      .passthrough(),
    session: z
      .object({
        id: z.string(),
        userId: z.string(),
        token: z.string(),
        expiresAt: authDate,
        createdAt: authDate,
        updatedAt: authDate,
        ipAddress: z.string().nullish(),
        userAgent: z.string().nullish(),
        developerActorUserId: z.string().nullish(),
      })
      .passthrough(),
  })
  .nullable();

/** Auth remains API-owned; the frontend validates the no-store HTTP session response. */
export async function readBackendSession(input: {
  readonly connection: BackendConnection;
  readonly headers: Headers;
  readonly fetcher?: BackendFetch;
}): Promise<ServerSession> {
  let response: Response;
  let body: unknown;
  try {
    response = await (input.fetcher ?? fetch)(
      new URL("/api/auth/get-session?disableCookieCache=true", input.connection.origin),
      {
        headers: backendRequestHeaders(input.headers),
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(input.connection.timeoutMs),
      },
    );
    if (response.status === 401) return null;
    if (!response.ok)
      throw new BackendTransportError("Sesi belum dapat diperiksa.", "SESSION_UNAVAILABLE");
    body = await response.json();
  } catch (error: unknown) {
    if (error instanceof BackendTransportError) throw error;
    throw new BackendTransportError("Sesi belum dapat diperiksa.", "SESSION_UNAVAILABLE");
  }
  const parsed = sessionSchema.safeParse(body);
  if (!parsed.success)
    throw new BackendTransportError("Respons sesi API tidak valid.", "BAD_SESSION_RESPONSE");
  // Better Auth's JSON dates are revived by the schema at this untyped HTTP boundary.
  return parsed.data as ServerSession;
}
