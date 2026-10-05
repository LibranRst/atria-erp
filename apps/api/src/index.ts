import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createApiApp } from "./app";
import { readApiConfig } from "./config";
import { BackgroundEffects } from "./runtime/background-effects";
import { db, pool } from "@backend/db";
import { auth } from "@backend/lib/auth";
import { appRouter } from "@backend/server/trpc/root";
import { createTRPCContext } from "@backend/server/trpc/init";
import { invokeWebOperation, isWebOperation } from "@backend/server/web-rpc/registry";
import { POST as chat } from "@backend/app/api/ai/chat/route";
import { GET as notificationStream } from "@backend/app/api/notifications/stream/route";
import { POST as notificationJob } from "@backend/app/api/internal/notifications/route";
import { handleMediaRequest } from "@backend/app/api/media/route";

const config = readApiConfig(process.env);
const effects = new BackgroundEffects((error: unknown): void => {
  console.error("API committed background effect failed", error);
});
let draining = false;
const app = createApiApp(
  config,
  {
    auth: (request: Request): Promise<Response> => auth.handler(request),
    trpc: (request: Request): Promise<Response> =>
      fetchRequestHandler({
        endpoint: "/api/trpc",
        req: request,
        router: appRouter,
        createContext: createTRPCContext,
      }),
    chat,
    media: handleMediaRequest,
    notificationStream,
    notificationJob,
    invokeWebOperation,
    isWebOperation,
    readiness: async (): Promise<void> => {
      await db.query.tenant.findFirst({ columns: { id: true } });
    },
    isDraining: (): boolean => draining,
  },
  effects,
);

const server = Bun.serve({
  hostname: config.HOST,
  port: config.PORT,
  idleTimeout: 60,
  fetch: app.fetch,
});
console.info(`Atria API listening on ${server.url.origin}`);

async function shutdown(): Promise<void> {
  if (draining) return;
  draining = true;
  const deadline = Date.now() + 30_000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve): void => {
    timer = setTimeout((): void => {
      void server.stop(true);
      resolve();
    }, 30_000);
  });
  await Promise.race([server.stop(false), timeout]);
  clearTimeout(timer);
  const completed = await effects.drain(Math.max(1, deadline - Date.now()));
  if (!completed) console.error("API shutdown timed out; durable outbox remains recoverable.");
  await pool.end();
  process.exit(0);
}
process.on("SIGTERM", (): void => {
  void shutdown();
});
process.on("SIGINT", (): void => {
  void shutdown();
});
