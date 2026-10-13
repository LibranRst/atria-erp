import { expect, mock } from "bun:test";
import superjson from "superjson";
import { z } from "zod";
import { postLoginDestination } from "@/lib/navigation/post-login-policy";

const scenario = z
  .enum(["ledger", "onboarding", "password", "anonymous", "mobile", "projects", "other-surface"])
  .parse(process.argv[2]);
const bridgeRequests: Array<{
  readonly method: string;
  readonly path: string;
  readonly operation?: string;
  readonly args: readonly unknown[];
}> = [];
let cookieWrites = 0;
class NavigationSignal extends Error {
  constructor(readonly location: string) {
    super("Fixture navigation");
  }
}
mock.module("next/headers", (): Record<string, unknown> => ({
  headers: async (): Promise<Headers> => new Headers({ origin: "https://fixture-web.invalid" }),
  cookies: async (): Promise<{ toString: () => string; set: () => never }> => ({
    toString: (): string => "better-auth.session_token=fixture-token",
    set: (): never => {
      cookieWrites += 1;
      throw new Error("Home must not mutate a Server Component cookie jar.");
    },
  }),
}));
mock.module("next/navigation", (): Record<string, unknown> => ({
  redirect: (location: string): never => {
    throw new NavigationSignal(location);
  },
  permanentRedirect: (location: string): never => {
    throw new NavigationSignal(location);
  },
  notFound: (): never => {
    throw new Error("Unexpected notFound.");
  },
}));
mock.module("next/cache", (): Record<string, unknown> => ({
  revalidatePath: (): never => {
    throw new Error("Home must not invalidate data.");
  },
}));

const dates = { createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z" };
const session = {
  user: {
    id: "fixture-user",
    name: "Fixture",
    email: "fixture@example.test",
    emailVerified: true,
    image: null,
    roleId: "fixture-role",
    isActive: true,
    mustChangePassword: scenario === "password",
    ...dates,
  },
  session: {
    id: "fixture-session",
    userId: "fixture-user",
    token: "fixture-token",
    expiresAt: "2027-01-01T00:00:00.000Z",
    ...dates,
  },
};
const actor = {
  userId: session.user.id,
  roleId: session.user.roleId,
  roleName: scenario === "projects" ? "PROJECT_MANAGER" : "OWNER",
  name: session.user.name,
  email: session.user.email,
  image: null,
  isActive: true,
  mustChangePassword: session.user.mustChangePassword,
  developerActorUserId: null,
  sessionId: session.session.id,
  dataScope: scenario === "projects" ? "ASSIGNED" : "GLOBAL",
  permissions: [],
};
const home =
  scenario === "onboarding" || scenario === "mobile"
    ? "/onboarding?step=welcome"
    : scenario === "projects"
      ? "/projects"
      : "/ledger";
const navigationInput = z
  .object({ returnTo: z.string().optional(), surface: z.literal("mobile").optional() })
  .optional();
function rpcResponse(data: unknown): Response {
  return new Response(superjson.stringify({ ok: true, data, revalidatePaths: [] }), {
    headers: { "content-type": "application/json" },
  });
}
globalThis.fetch = Object.assign(
  async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.origin !== "https://fixture-api.invalid")
      throw new Error("Network is forbidden outside the fixture API.");
    if (url.pathname === "/api/auth/get-session") {
      bridgeRequests.push({ method: request.method, path: url.pathname, args: [] });
      return Response.json(scenario === "anonymous" ? null : session);
    }
    if (url.pathname !== "/api/internal/web-rpc") throw new Error("Unexpected backend endpoint.");
    const decoded: unknown = superjson.parse(await request.text());
    const body = z.object({ operation: z.string(), args: z.array(z.unknown()) }).parse(decoded);
    bridgeRequests.push({
      method: request.method,
      path: url.pathname,
      operation: body.operation,
      args: body.args,
    });
    expect(request.headers.get("cookie")).toBe("better-auth.session_token=fixture-token");
    expect(init?.cache).toBe("no-store");
    expect(init?.redirect).toBe("manual");
    switch (body.operation) {
      case "server/actor.resolveActor":
        return rpcResponse(scenario === "anonymous" ? null : actor);
      case "features/navigation/server/home-destination.resolveHomeDestination":
        return rpcResponse(home);
      case "app/actions/auth-navigation.getPostLoginRedirectDestination": {
        const hints = navigationInput.parse(body.args[0]);
        const destination =
          scenario === "anonymous"
            ? "/login"
            : scenario === "password"
              ? "/profile/password"
              : home;
        return rpcResponse(
          postLoginDestination(destination, hints?.returnTo, hints?.surface === "mobile"),
        );
      }
      default:
        throw new Error("Unexpected backend operation.");
    }
  },
  {
    preconnect: (): never => {
      throw new Error("Network preconnect is forbidden.");
    },
  },
);
const { default: Home } = await import("../page");
let navigation: NavigationSignal | undefined;
try {
  await Home({
    searchParams: Promise.resolve({
      surface:
        scenario === "mobile" ? "mobile" : scenario === "other-surface" ? "other" : undefined,
    }),
  });
} catch (error: unknown) {
  if (!(error instanceof NavigationSignal)) throw error;
  navigation = error;
}
expect(bridgeRequests).toHaveLength(1);
expect(bridgeRequests[0].operation).toBe(
  "app/actions/auth-navigation.getPostLoginRedirectDestination",
);
expect(bridgeRequests[0].method).toBe("POST");
expect(cookieWrites).toBe(0);
const hints = navigationInput.parse(bridgeRequests[0].args[0]);
expect(hints?.returnTo).toBeUndefined();
expect(hints?.surface).toBe(scenario === "mobile" ? "mobile" : undefined);
const expected =
  scenario === "anonymous"
    ? "/login"
    : scenario === "password"
      ? "/profile/password"
      : scenario === "mobile"
        ? "/onboarding?step=welcome&surface=mobile"
        : home;
expect(navigation?.location).toBe(expected);
console.log("Home navigation fixture passed");
