import "server-only";

import { publicProcedure, TRPCError } from "@/server/trpc/init";
import { actorCan } from "@/lib/auth/permissions";
import {
  canUseTemporaryPasswordDuringDeveloperSimulation,
  isDeveloperAccountSimulationEnabled,
} from "@atria/core/auth/developer-account-simulation";

/**
 * Prosedur yang mewajibkan sesi valid dan, bila `meta.permission` diisi, izin
 * peran yang sesuai.
 *
 * `UNAUTHORIZED` adalah satu-satunya kegagalan yang dilempar sebagai
 * `TRPCError`, bukan dikembalikan sebagai `ActionResponse`. Itu disengaja:
 * klien native memakainya sebagai satu sinyal terpusat untuk memicu login
 * ulang, alih-alih mencocokkan `error.code` di puluhan call site. Setelah
 * melewati middleware ini, kegagalan bisnis — termasuk `FORBIDDEN` dari dalam
 * use-case — tetap kembali sebagai `ActionResponse` yang resolved.
 */
export const protectedProcedure = publicProcedure
  .use(({ ctx, next }) => {
    if (!ctx.actor || !ctx.actor.isActive) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Sesi tidak valid." });
    }
    return next({ ctx: { ...ctx, actor: ctx.actor } });
  })
  .use(({ ctx, meta, next }) => {
    if (meta?.permission && !actorCan(ctx.actor!, meta.permission)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Peran ${ctx.actor!.roleName} tidak memiliki izin ${meta.permission}`,
      });
    }
    return next();
  });

/**
 * Prosedur yang juga menegakkan gerbang ganti-kata-sandi-sementara.
 *
 * Ini menutup lubang nyata: matcher `proxy.ts` adalah
 * `["/((?!api|_next/static|_next/image|favicon.ico|login|setup).*)"]`, sehingga
 * seluruh `/api/**` dilewati. Gerbang `mustChangePassword` hari ini **hanya**
 * hidup di proxy, jadi tanpa middleware ini pengguna native dengan kata sandi
 * sementara bisa memakai seluruh API. Pengecualian mode simulasi developer
 * dihormati persis seperti di `proxy.ts`.
 */
export const activeProcedure = protectedProcedure.use(({ ctx, next }) => {
  const actor = ctx.actor!;
  const canUseTemporaryPassword = canUseTemporaryPasswordDuringDeveloperSimulation({
    simulationEnabled: isDeveloperAccountSimulationEnabled(),
    developerActorUserId: actor.developerActorUserId,
    effectiveRoleId: actor.roleId,
  });

  if (actor.mustChangePassword && !canUseTemporaryPassword) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "MUST_CHANGE_PASSWORD",
    });
  }

  return next();
});
