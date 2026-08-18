import "server-only";

import { initTRPC, TRPCError } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import { ZodError } from "zod";

import { resolveActorFromHeaders } from "@/server/actor";
import type { PermissionKey } from "@atria/core/auth/permissions";

/**
 * `opts.req.headers` membawa cookie (web) maupun `Authorization: Bearer`
 * (klien native). Plugin `bearer()` Better Auth menormalkan keduanya, jadi
 * tidak ada percabangan transport di sini.
 */
export async function createTRPCContext(opts: FetchCreateContextFnOptions) {
  const actor = await resolveActorFromHeaders(opts.req.headers);
  return { actor, headers: opts.req.headers };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

/**
 * `superjson` wajib, bukan opsional: payload action berisi instance `Date`
 * (`createdAt`, `paidAt`, `dueDate`). RSC menserialisasinya transparan, JSON
 * biasa tidak. Uang tetap `numeric(15,2)` → string, jadi tidak ada `bigint`
 * yang menyeberang.
 */
const t = initTRPC
  .context<TRPCContext>()
  .meta<{ permission?: PermissionKey }>()
  .create({
    transformer: superjson,
    errorFormatter: ({ shape, error }) => ({
      ...shape,
      data: {
        ...shape.data,
        zod: error.cause instanceof ZodError ? error.cause.flatten().fieldErrors : null,
      },
    }),
  });

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export { TRPCError };
