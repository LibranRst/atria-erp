import "server-only";

import { createTRPCRouter } from "@/server/trpc/init";
import { administrationRouter } from "@/server/trpc/routers/administration";
import { aiRouter } from "@/server/trpc/routers/ai";
import { financeRouter } from "@/server/trpc/routers/finance";
import { mediaRouter } from "@/server/trpc/routers/media";
import { projectRouter } from "@/server/trpc/routers/project";
import { screenRouter } from "@/server/trpc/routers/screen";

/**
 * Router akar. Namespace-nya mencerminkan domain di `app/actions/**` satu
 * lawan satu supaya reviewer bisa membandingkan keduanya langsung.
 *
 * Klien native hanya mengimpor TIPE-nya (`import type { AppRouter }`), yang
 * dihapus total saat kompilasi — Metro tidak pernah melihat modul ini.
 */
export const appRouter = createTRPCRouter({
  administration: administrationRouter,
  ai: aiRouter,
  finance: financeRouter,
  media: mediaRouter,
  project: projectRouter,
  screen: screenRouter,
});

export type AppRouter = typeof appRouter;
