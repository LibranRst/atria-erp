import { ROLE_PERMISSIONS } from "@atria/core/auth/permissions";
import { describe, expect, test } from "bun:test";
import { TRPCError } from "@trpc/server";

import type { Actor } from "@/server/actor";
import { createTRPCRouter } from "@/server/trpc/init";
import { activeProcedure, protectedProcedure } from "@/server/trpc/procedures";

/**
 * Gerbang `mustChangePassword` hari ini hanya hidup di `proxy.ts`, dan matcher
 * proxy mengecualikan seluruh `/api/**`. Artinya klien native bisa memakai API
 * dengan kata sandi sementara kecuali `activeProcedure` menahannya. Tidak ada
 * test lain di repo ini yang menutup celah itu, jadi test ini sengaja spesifik.
 */

const baseActor: Actor = {
  userId: "11111111-1111-1111-1111-111111111111",
  roleId: "00000000-0000-0000-0000-000000000001",
  roleName: "OWNER",
  name: "Ronald",
  email: "ronald@dekoria.com",
  isActive: true,
  mustChangePassword: false,
  sessionId: "test-session",
  permissions: ROLE_PERMISSIONS["OWNER"] ?? [],
  dataScope: "GLOBAL",
  developerActorUserId: null,
};

const router = createTRPCRouter({
  guarded: activeProcedure.query(() => "ok"),
  permissioned: protectedProcedure.meta({ permission: "pay:cost" }).query(() => "ok"),
});

function callerFor(actor: Actor | null) {
  return router.createCaller({ actor, headers: new Headers() });
}

async function expectTRPCError(promise: Promise<unknown>): Promise<TRPCError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(TRPCError);
    return error as TRPCError;
  }
  throw new Error("Diharapkan TRPCError, tetapi panggilan berhasil.");
}

describe("tRPC procedure guards", () => {
  test("menolak sesi yang tidak ada dengan UNAUTHORIZED", async () => {
    const error = await expectTRPCError(callerFor(null).guarded());
    expect(error.code).toBe("UNAUTHORIZED");
  });

  test("meloloskan aktor aktif tanpa kewajiban ganti kata sandi", async () => {
    await expect(callerFor(baseActor).guarded()).resolves.toBe("ok");
  });

  test("memblokir aktor yang wajib mengganti kata sandi sementara", async () => {
    const error = await expectTRPCError(
      callerFor({ ...baseActor, mustChangePassword: true }).guarded(),
    );

    expect(error.code).toBe("FORBIDDEN");
    expect(error.message).toBe("MUST_CHANGE_PASSWORD");
  });

  test("menolak peran tanpa izin yang diminta", async () => {
    const error = await expectTRPCError(
      callerFor({ ...baseActor, roleName: "PROJECT_MANAGER" }).permissioned(),
    );

    expect(error.code).toBe("FORBIDDEN");
    expect(error.message).toContain("pay:cost");
  });

  test("meloloskan peran yang memiliki izin", async () => {
    await expect(callerFor(baseActor).permissioned()).resolves.toBe("ok");
  });
});
