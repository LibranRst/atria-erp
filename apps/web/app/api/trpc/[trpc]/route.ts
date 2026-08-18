import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { createTRPCContext } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/root";

/**
 * Jembatan HTTP untuk klien native — React Native tidak bisa memanggil Server
 * Action. Route ini dibatasi secara sadar: ia hanya mengekspos prosedur yang
 * mendelegasikan ke use-case di `server/usecases/**`, tidak pernah memuat
 * logika bisnis, dan tidak pernah menyentuh Drizzle langsung.
 */
function handler(request: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: createTRPCContext,
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(`tRPC ${path ?? "<no-path>"}:`, error.message);
          }
        : undefined,
  });
}

export { handler as GET, handler as POST };
