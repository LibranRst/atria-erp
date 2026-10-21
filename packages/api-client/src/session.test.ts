import { describe, expect, test } from "bun:test";
import type { BackendConnection } from "./config";
import { readBackendSession } from "./session";

const connection: BackendConnection = {
  origin: "http://localhost:3001",
  bridgeSecret: "fixture-bridge-secret",
  timeoutMs: 1000,
};
const timestamp = "2026-10-06T00:00:00.000Z";
const fixture = {
  user: {
    id: "user-id",
    name: "Admin",
    email: "admin@example.test",
    emailVerified: true,
    roleId: "custom-role",
    isActive: true,
    mustChangePassword: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  session: {
    id: "session-id",
    userId: "user-id",
    token: "fixture-token",
    expiresAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
};

describe("shared session HTTP boundary", (): void => {
  test("preserves caller credentials, uses no-store and revives validated session dates", async (): Promise<void> => {
    let calls = 0;
    const session = await readBackendSession({
      connection,
      headers: new Headers({ cookie: "session=fixture", authorization: "Bearer fixture" }),
      fetcher: async (url, init): Promise<Response> => {
        calls += 1;
        expect(String(url)).toBe(
          "http://localhost:3001/api/auth/get-session?disableCookieCache=true",
        );
        expect(new Headers(init?.headers).get("cookie")).toBe("session=fixture");
        expect(new Headers(init?.headers).get("authorization")).toBe("Bearer fixture");
        expect(new Headers(init?.headers).has("x-atria-bridge-secret")).toBe(false);
        expect(init?.cache).toBe("no-store");
        expect(init?.redirect).toBe("manual");
        return Response.json(fixture);
      },
    });
    expect(session?.user.id).toBe("user-id");
    expect(session?.session.createdAt).toEqual(new Date(timestamp));
    expect(calls).toBe(1);
  });

  test("distinguishes anonymous sessions from malformed or unavailable auth without retries", async (): Promise<void> => {
    const input = { connection, headers: new Headers() };
    expect(
      await readBackendSession({
        ...input,
        fetcher: async (): Promise<Response> => Response.json(null),
      }),
    ).toBeNull();
    expect(
      await readBackendSession({
        ...input,
        fetcher: async (): Promise<Response> => new Response(null, { status: 401 }),
      }),
    ).toBeNull();
    await expect(
      readBackendSession({
        ...input,
        fetcher: async (): Promise<Response> => Response.json({ user: fixture.user }),
      }),
    ).rejects.toMatchObject({ code: "BAD_SESSION_RESPONSE" });
    let calls = 0;
    await expect(
      readBackendSession({
        ...input,
        fetcher: async (): Promise<Response> => {
          calls += 1;
          throw new Error("fixture connection failure");
        },
      }),
    ).rejects.toMatchObject({ code: "SESSION_UNAVAILABLE" });
    expect(calls).toBe(1);
  });
});
