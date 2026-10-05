import { createTRPCRouter } from "@backend/server/trpc/init";
import { administrationRouter } from "@backend/server/trpc/routers/administration";
import { aiRouter } from "@backend/server/trpc/routers/ai";
import { financeRouter } from "@backend/server/trpc/routers/finance";
import { mediaRouter } from "@backend/server/trpc/routers/media";
import { notificationsRouter } from "@backend/server/trpc/routers/notifications";
import { profileRouter } from "@backend/server/trpc/routers/profile";
import { projectRouter } from "@backend/server/trpc/routers/project";
import { screenRouter } from "@backend/server/trpc/routers/screen";

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
  notifications: notificationsRouter,
  profile: profileRouter,
  project: projectRouter,
  screen: screenRouter,
});

export type AppRouter = typeof appRouter;
