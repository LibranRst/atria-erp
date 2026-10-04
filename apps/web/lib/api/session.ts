import "server-only";

import type { ServerSession } from "@atria/api/contract";
import { z } from "zod";

import { getBackendConnection } from "./config";
import { BackendTransportError, backendRequestHeaders } from "./http";

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

/** Web has no server auth instance. Session validation belongs to Better Auth in the API. */
export async function readBackendSession(requestHeaders: Headers): Promise<ServerSession> {
  const connection = getBackendConnection();
  let response: Response;
  let body: unknown;
  try {
    response = await fetch(
      new URL("/api/auth/get-session?disableCookieCache=true", connection.origin),
      {
        headers: backendRequestHeaders(requestHeaders),
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(connection.timeoutMs),
      },
    );
    if (response.status === 401) return null;
    if (!response.ok) {
      throw new BackendTransportError("Sesi belum dapat diperiksa.", "SESSION_UNAVAILABLE");
    }
    body = await response.json();
  } catch (error) {
    if (error instanceof BackendTransportError) throw error;
    throw new BackendTransportError("Sesi belum dapat diperiksa.", "SESSION_UNAVAILABLE");
  }
  const parsed = sessionSchema.safeParse(body);
  if (!parsed.success) {
    throw new BackendTransportError("Respons sesi API tidak valid.", "BAD_SESSION_RESPONSE");
  }
  // Auth's JSON endpoint emits date strings; the schema revives the API's
  // declared session type at this untyped HTTP boundary.
  return parsed.data as ServerSession;
}
