import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { randomUUID } from "node:crypto";
import superjson from "superjson";
import { z } from "zod";
import type { ApiConfig } from "./config";
import { BackgroundEffects } from "./runtime/background-effects";
import { RedirectControl, NotFoundControl } from "./runtime/navigation";
import { requireRequestContext, withRequestContext } from "./runtime/request-context";
import { WebRpcAuthorizationError } from "./runtime/web-rpc-errors";

export type ApiPorts = {
  readonly auth: (request: Request) => Response | Promise<Response>;
  readonly trpc: (request: Request) => Response | Promise<Response>;
  readonly chat: (request: Request) => Response | Promise<Response>;
  readonly notificationStream: (request: Request) => Response | Promise<Response>;
  readonly notificationJob: (request: Request) => Response | Promise<Response>;
  readonly media?: (request: Request) => Response | Promise<Response>;
  readonly isWebOperation: (operation: string) => boolean;
  readonly invokeWebOperation: (operation: string, args: readonly unknown[]) => Promise<unknown>;
  readonly readiness: () => Promise<void>;
  readonly isDraining: () => boolean;
};

const bridgeInput = z
  .object({ operation: z.string().min(1).max(500), args: z.array(z.unknown()) })
  .strict();

function validBridgeSecret(actual: string | undefined, expected: string): boolean {
  const supplied = Buffer.from(actual ?? "");
  const configured = Buffer.from(expected);
  return supplied.length === configured.length && timingSafeEqual(supplied, configured);
}

function bridgeResponse(value: unknown, status = 200): Response {
  return new Response(superjson.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function createApiApp(config: ApiConfig, ports: ApiPorts, effects: BackgroundEffects): Hono {
  const app = new Hono();
  app.use("*", async (context, next): Promise<void> => {
    const requestId = randomUUID();
    const started = performance.now();
    context.header("x-request-id", requestId);
    context.header("x-content-type-options", "nosniff");
    context.header("x-frame-options", "DENY");
    await next();
    if (context.res.status >= 500)
      console.error("API request failed", {
        requestId,
        method: context.req.method,
        path: context.req.path,
        status: context.res.status,
        durationMs: Math.round(performance.now() - started),
      });
  });
  app.use(
    "/api/*",
    bodyLimit({
      maxSize: 12 * 1024 * 1024,
      onError: (context): Response =>
        context.json({ error: "Ukuran permintaan melebihi batas." }, 413),
    }),
  );
  app.use("*", async (context, next): Promise<Response> => {
    const execution = await withRequestContext(context.req.raw, async (): Promise<Response> => {
      await next();
      return context.res;
    });
    effects.schedule(execution.afterEffects);
    return execution.value;
  });
  app.use(
    "/api/*",
    cors({
      origin: (origin: string): string | undefined =>
        [
          new URL(config.WEB_ORIGIN).origin,
          new URL(config.API_PUBLIC_URL).origin,
          ...config.WEB_ADDITIONAL_ORIGINS,
        ].includes(origin)
          ? origin
          : undefined,
      credentials: true,
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "X-Atria-Bridge-Secret",
        "X-Atria-Upload-Ticket",
      ],
      exposeHeaders: ["set-auth-token", "x-conversation-id", "x-request-id"],
      allowMethods: ["GET", "POST", "OPTIONS"],
    }),
  );

  app.get("/health", (context): Response => context.json({ status: "ok", service: "atria-api" }));
  app.get("/ready", async (context): Promise<Response> => {
    if (ports.isDraining()) return context.json({ status: "draining" }, 503);
    try {
      await ports.readiness();
      return context.json({ status: "ready" });
    } catch {
      return context.json({ status: "unavailable" }, 503);
    }
  });

  app.on(["GET", "POST"], "/api/auth/*", (context): Response | Promise<Response> =>
    ports.auth(context.req.raw),
  );
  app.on(["GET", "POST"], "/api/trpc/*", (context): Response | Promise<Response> =>
    ports.trpc(context.req.raw),
  );
  app.post("/api/ai/chat", (context): Response | Promise<Response> => ports.chat(context.req.raw));
  app.on(["GET", "POST"], "/api/media/*", (context): Response | Promise<Response> =>
    ports.media
      ? ports.media(context.req.raw)
      : context.json({ error: "Lampiran tidak tersedia." }, 404),
  );
  app.get("/api/notifications/stream", (context): Response | Promise<Response> =>
    ports.notificationStream(context.req.raw),
  );
  app.on(["GET", "POST"], "/api/internal/notifications", (context): Response | Promise<Response> =>
    ports.notificationJob(context.req.raw),
  );

  app.post("/api/internal/web-rpc", async (context): Promise<Response> => {
    if (!validBridgeSecret(context.req.header("x-atria-bridge-secret"), config.API_BRIDGE_SECRET)) {
      return bridgeResponse(
        { ok: false, error: { code: "UNAUTHORIZED", message: "Akses bridge ditolak." } },
        401,
      );
    }
    let input: unknown;
    try {
      input = superjson.parse(await context.req.text());
    } catch {
      return bridgeResponse(
        { ok: false, error: { code: "VALIDATION_ERROR", message: "Payload bridge tidak valid." } },
        400,
      );
    }
    const parsed = bridgeInput.safeParse(input);
    if (!parsed.success || !ports.isWebOperation(parsed.data.operation)) {
      return bridgeResponse(
        {
          ok: false,
          error: { code: "VALIDATION_ERROR", message: "Operasi bridge tidak tersedia." },
        },
        400,
      );
    }
    try {
      const data = await ports.invokeWebOperation(parsed.data.operation, parsed.data.args);
      const invalidations = [...requireRequestContext().invalidations.values()];
      const revalidatePaths = [...new Set(invalidations.map((item): string => item.path))];
      return bridgeResponse({ ok: true, data, revalidatePaths, invalidations });
    } catch (error: unknown) {
      if (error instanceof WebRpcAuthorizationError) {
        return bridgeResponse(
          { ok: false, error: { code: error.code, message: error.message } },
          error.code === "UNAUTHORIZED" ? 401 : 403,
        );
      }
      if (error instanceof RedirectControl) {
        return bridgeResponse({
          ok: false,
          error: { message: error.message },
          control: { type: "redirect", location: error.location, permanent: error.permanent },
        });
      }
      if (error instanceof NotFoundControl) {
        return bridgeResponse({
          ok: false,
          error: { message: error.message },
          control: { type: "notFound" },
        });
      }
      console.error("API web bridge failed", error);
      return bridgeResponse(
        {
          ok: false,
          error: { code: "INTERNAL_SERVER_ERROR", message: "Operasi belum dapat diproses." },
        },
        500,
      );
    }
  });
  app.onError((error, context): Response => {
    console.error("API request failed", error);
    return context.json({ error: "Operasi belum dapat diproses." }, 500);
  });
  return app;
}
