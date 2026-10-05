import { expect, mock } from "bun:test";
import superjson from "superjson";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { NextRequest } from "next/server";

const revalidations: Array<{ path: string; type?: "page" | "layout" }> = [];
const cookieWrites: ResponseCookie[] = [];
class NavigationSignal extends Error {
  constructor(
    readonly type: string,
    readonly location?: string,
  ) {
    super(type);
  }
}
mock.module("next/cache", () => ({
  revalidatePath(path: string, type?: "page" | "layout"): void {
    revalidations.push({ path, type });
  },
}));
mock.module("next/headers", () => ({
  async headers(): Promise<Headers> {
    return new Headers({
      cookie: "session=original",
      origin: "http://localhost:3000",
      authorization: "Bearer original",
    });
  },
  async cookies(): Promise<{ toString: () => string; set: (cookie: ResponseCookie) => void }> {
    return {
      toString: (): string => "session=original",
      set: (cookie: ResponseCookie): void => {
        cookieWrites.push(cookie);
      },
    };
  },
}));
mock.module("next/navigation", () => ({
  redirect(location: string): never {
    throw new NavigationSignal("redirect", location);
  },
  permanentRedirect(location: string): never {
    throw new NavigationSignal("permanentRedirect", location);
  },
  notFound(): never {
    throw new NavigationSignal("notFound");
  },
}));

let envelope: unknown = { ok: true, data: { success: true }, revalidatePaths: [] };
const authDates = { createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z" };
const validSession = {
  user: {
    id: "user-1",
    name: "Test",
    email: "test@example.com",
    emailVerified: true,
    image: null,
    roleId: "role-1",
    isActive: true,
    mustChangePassword: false,
    ...authDates,
  },
  session: {
    id: "session-1",
    userId: "user-1",
    token: "token",
    expiresAt: "2026-10-02T00:00:00.000Z",
    ...authDates,
  },
};
let sessionBody: unknown = validSession;
let expectedCookie = "session=original";
let sessionReads = 0;
const cookieHeaders = new Headers();
cookieHeaders.append(
  "set-cookie",
  "better-auth.session_token=changed; Path=/; HttpOnly; SameSite=Lax",
);
cookieHeaders.append("set-cookie", "better-auth.session_data=; Max-Age=0; Path=/; HttpOnly");
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch(request: Request): Response {
    expect(request.headers.get("cookie")).toBe(expectedCookie);
    expect(request.headers.get("authorization")).toBe("Bearer original");
    expect(request.headers.get("origin")).toBe("http://localhost:3000");
    if (new URL(request.url).pathname === "/api/auth/get-session") {
      sessionReads += 1;
      expect(new URL(request.url).searchParams.get("disableCookieCache")).toBe("true");
      return Response.json(sessionBody);
    }
    expect(request.headers.get("x-atria-bridge-secret")).toBe("test-only-secret");
    return new Response(superjson.stringify(envelope), { headers: cookieHeaders });
  },
});
process.env.API_ORIGIN = `http://127.0.0.1:${server.port}`;
process.env.API_BRIDGE_SECRET = "test-only-secret";

try {
  const { callBackend, callBackendAction } = await import("../backend");
  const { readBackendSession } = await import("../session");
  const operation = "app/actions/finance/get-dashboard-stats.getDashboardStats";
  await callBackend(operation, []);
  expect(cookieWrites).toEqual([]); // Server-rendered reads do not mutate cookie headers.

  envelope = {
    ok: true,
    data: { success: true },
    revalidatePaths: ["/should-not-use-legacy-path"],
    invalidations: [
      { path: "/", type: "layout" },
      { path: "/projects/[id]", type: "page" },
      { path: "/projects/[id]", type: "page" },
    ],
  };
  await callBackend(operation, [], { allowCookieWrites: true });
  expect(cookieWrites.map((cookie: ResponseCookie): string => cookie.name)).toEqual([
    "better-auth.session_token",
    "better-auth.session_data",
  ]);
  expect(cookieWrites[1].maxAge).toBe(0);
  expect(revalidations).toEqual([
    { path: "/", type: "layout" },
    { path: "/projects/[id]", type: "page" },
  ]);

  revalidations.length = 0;
  envelope = {
    ok: true,
    data: { success: false, error: { code: "FORBIDDEN", message: "Denied" } },
    revalidatePaths: ["/ledger"],
  };
  await callBackend(operation, []);
  expect(revalidations).toEqual([]);

  envelope = { ok: false, error: { code: "FORBIDDEN", message: "Denied" } };
  await expect(callBackend(operation, [])).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(revalidations).toEqual([]);
  expect(await callBackendAction(operation, [])).toEqual({
    success: false,
    error: { code: "FORBIDDEN", message: "Denied" },
  });
  envelope = { ok: false, error: { code: "UNAUTHORIZED", message: "Session expired" } };
  expect(await callBackendAction(operation, [])).toEqual({
    success: false,
    error: { code: "UNAUTHORIZED", message: "Session expired" },
  });
  expect(revalidations).toEqual([]);
  for (const permanent of [false, true]) {
    envelope = {
      ok: false,
      error: { message: "Navigation" },
      control: { type: "redirect", location: "/login", permanent },
    };
    await expect(callBackend(operation, [])).rejects.toMatchObject({
      type: permanent ? "permanentRedirect" : "redirect",
      location: "/login",
    });
    await expect(callBackendAction(operation, [])).rejects.toMatchObject({
      type: permanent ? "permanentRedirect" : "redirect",
      location: "/login",
    });
  }
  envelope = { ok: false, error: { message: "Missing" }, control: { type: "notFound" } };
  await expect(callBackend(operation, [])).rejects.toMatchObject({ type: "notFound" });
  await expect(callBackendAction(operation, [])).rejects.toMatchObject({ type: "notFound" });

  const headers = new Headers({
    cookie: "session=original",
    origin: "http://localhost:3000",
    authorization: "Bearer original",
  });
  const session = await readBackendSession(headers);
  expect(session?.session.expiresAt).toEqual(new Date("2026-10-02T00:00:00.000Z"));
  expect(session?.user.createdAt).toEqual(new Date(authDates.createdAt));
  sessionBody = null;
  expect(await readBackendSession(headers)).toBeNull();
  sessionBody = { user: { id: "untrusted" }, session: {} };
  await expect(readBackendSession(headers)).rejects.toMatchObject({ code: "BAD_SESSION_RESPONSE" });

  const { proxy } = await import("../../../proxy");
  const readsBeforeMissingCookie = sessionReads;
  const anonymous = await proxy(new NextRequest("http://localhost:3000/projects?surface=mobile"));
  expect(anonymous.status).toBe(307);
  const loginURL = new URL(anonymous.headers.get("location") ?? "");
  expect(loginURL.pathname).toBe("/login");
  expect(loginURL.searchParams.get("returnTo")).toBe("/projects?surface=mobile");
  expect(loginURL.searchParams.get("surface")).toBe("mobile");
  expect(sessionReads).toBe(readsBeforeMissingCookie);
  expectedCookie = "__Secure-better-auth.session_token=secure-session";
  const pageRequest = new NextRequest("https://localhost:3000/projects", {
    headers: { ...Object.fromEntries(headers), cookie: expectedCookie },
  });
  sessionBody = validSession;
  expect((await proxy(pageRequest)).headers.get("x-middleware-next")).toBe("1");
  sessionBody = null;
  expect(new URL((await proxy(pageRequest)).headers.get("location") ?? "").pathname).toBe("/login");
  sessionBody = { ...validSession, user: { ...validSession.user, isActive: false } };
  expect(new URL((await proxy(pageRequest)).headers.get("location") ?? "").pathname).toBe("/login");
  process.env.ATRIA_DEV_ACCOUNT_SWITCHER_ENABLED = "false";
  sessionBody = { ...validSession, user: { ...validSession.user, mustChangePassword: true } };
  expect(new URL((await proxy(pageRequest)).headers.get("location") ?? "").pathname).toBe(
    "/profile/password",
  );
  sessionBody = { user: {}, session: {} };
  const unavailable = await proxy(pageRequest);
  expect(unavailable.status).toBe(503);
  expect(unavailable.headers.get("cache-control")).toBe("no-store");
  process.env.API_ORIGIN = "http://127.0.0.1:1";
  expect(await callBackendAction(operation, [])).toEqual({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "API belum dapat dihubungi. Periksa status data sebelum mengulangi tindakan.",
    },
  });
  expect(revalidations).toEqual([]);
  console.log("Backend web adapter passed");
} finally {
  server.stop(true);
}
