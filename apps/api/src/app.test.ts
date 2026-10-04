import { describe, expect, test } from "bun:test";
import superjson from "superjson";
import { createApiApp, type ApiPorts } from "./app";
import { readApiConfig, DEVELOPMENT_BRIDGE_SECRET } from "./config";
import { BackgroundEffects } from "./runtime/background-effects";
import { revalidatePath } from "./runtime/cache";
import { redirect } from "./runtime/navigation";
import { headers } from "./runtime/request-context";
import { WebRpcAuthorizationError } from "./runtime/web-rpc-errors";

function fixture(overrides: Partial<ApiPorts> = {}): ReturnType<typeof createApiApp> {
  const plain = (): Response => new Response("ok");
  return createApiApp(
    readApiConfig({ NODE_ENV: "test" }),
    {
      auth: plain,
      trpc: plain,
      chat: plain,
      notificationStream: plain,
      notificationJob: plain,
      readiness: async (): Promise<void> => undefined,
      isDraining: (): boolean => false,
      isWebOperation: (operation: string): boolean => operation === "fixture",
      invokeWebOperation: async (): Promise<unknown> => {
        revalidatePath("/", "layout");
        return { date: new Date("2026-10-01T00:00:00Z"), cookie: (await headers()).get("cookie") };
      },
      ...overrides,
    },
    new BackgroundEffects((): void => undefined),
  );
}

function request(operation = "fixture", secret = DEVELOPMENT_BRIDGE_SECRET): Request {
  return new Request("http://localhost/api/internal/web-rpc", {
    method: "POST",
    headers: {
      "x-atria-bridge-secret": secret,
      cookie: "session=signed",
      "Content-Type": "application/json",
    },
    body: superjson.stringify({ operation, args: [] }),
  });
}

describe("API transport boundary", (): void => {
  test("bridge rejects missing credentials and unknown operation without invoking", async (): Promise<void> => {
    let calls = 0;
    const app = fixture({ invokeWebOperation: async (): Promise<unknown> => ++calls });
    expect((await app.fetch(request("fixture", ""))).status).toBe(401);
    expect((await app.fetch(request("module.function"))).status).toBe(400);
    expect(calls).toBe(0);
  });

  test("bridge preserves date, caller headers and invalidation type", async (): Promise<void> => {
    const response = await fixture().fetch(request());
    const result = superjson.parse<unknown>(await response.text());
    expect(result).toEqual({
      ok: true,
      data: { date: new Date("2026-10-01T00:00:00Z"), cookie: "session=signed" },
      revalidatePaths: ["/"],
      invalidations: [{ path: "/", type: "layout" }],
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  test("redirects remain explicit web control flow", async (): Promise<void> => {
    const app = fixture({ invokeWebOperation: async (): Promise<unknown> => redirect("/login") });
    const response = await app.fetch(request());
    expect(superjson.parse<unknown>(await response.text())).toMatchObject({
      ok: false,
      control: { type: "redirect", location: "/login" },
    });
  });

  test("backend authorization denials preserve status and error code", async (): Promise<void> => {
    const app = fixture({
      invokeWebOperation: async (): Promise<unknown> => {
        throw new WebRpcAuthorizationError("FORBIDDEN", "Ganti kata sandi terlebih dahulu.");
      },
    });
    const response = await app.fetch(request());
    expect(response.status).toBe(403);
    expect(superjson.parse<unknown>(await response.text())).toEqual({
      ok: false,
      error: { code: "FORBIDDEN", message: "Ganti kata sandi terlebih dahulu." },
    });
  });

  test("health does not query the database; readiness fails closed", async (): Promise<void> => {
    let reads = 0;
    const app = fixture({
      readiness: async (): Promise<void> => {
        reads += 1;
        throw new Error("db unavailable");
      },
    });
    expect((await app.fetch(new Request("http://localhost/health"))).status).toBe(200);
    expect(reads).toBe(0);
    expect((await app.fetch(new Request("http://localhost/ready"))).status).toBe(503);
    expect(reads).toBe(1);
  });

  test("production refuses development bridge secrets and unconfigured origins", (): void => {
    expect(() =>
      readApiConfig({ NODE_ENV: "production", API_BRIDGE_SECRET: DEVELOPMENT_BRIDGE_SECRET }),
    ).toThrow();
  });
});
