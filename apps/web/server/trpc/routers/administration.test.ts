import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { TRPCError } from "@trpc/server";

import type { Actor } from "@/server/actor";
import { createTRPCRouter } from "@/server/trpc/init";
import { activeProcedure, protectedProcedure } from "@/server/trpc/procedures";
import { changeTemporaryPasswordSchema } from "@atria/core/validations/administration";

/**
 * P2.1 memberi satu pengecualian sempit pada gerbang `mustChangePassword`:
 * akun yang wajib mengganti kata sandi harus bisa memanggil tepat satu mutation
 * untuk keluar dari kondisinya, tanpa memperoleh akses ke apa pun yang lain.
 *
 * Test ini menjaga kedua sisi pengecualian itu sekaligus — kalau `changeTemporaryPassword`
 * pindah ke `activeProcedure`, akun baru akan buntu; kalau prosedur operasional
 * pindah ke `protectedProcedure`, gerbangnya bocor.
 */

const APP_ROOT = path.resolve(import.meta.dir, "..", "..", "..");

const temporaryPasswordActor: Actor = {
  userId: "44444444-4444-4444-4444-444444444444",
  roleId: "00000000-0000-0000-0000-000000000003",
  roleName: "PROJECT_MANAGER",
  name: "Staf Baru",
  email: "staf.baru@dekoria.com",
  isActive: true,
  mustChangePassword: true,
  developerActorUserId: null,
};

/**
 * Cermin bentuk router asli: mutation password memakai `protectedProcedure`,
 * prosedur operasional memakai `activeProcedure`.
 */
const router = createTRPCRouter({
  changeTemporaryPassword: protectedProcedure
    .input(changeTemporaryPasswordSchema)
    .mutation(() => ({ success: true as const, data: { changed: true as const } })),
  operational: activeProcedure.query(() => "ok"),
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

describe("administration.changeTemporaryPassword transport", () => {
  test("menolak request tanpa sesi", async () => {
    const error = await expectTRPCError(
      callerFor(null).changeTemporaryPassword({
        currentPassword: "sementara123",
        newPassword: "Pribadi#2026",
      }),
    );

    expect(error.code).toBe("UNAUTHORIZED");
  });

  test("mengizinkan akun mustChangePassword memanggil mutation password", async () => {
    await expect(
      callerFor(temporaryPasswordActor).changeTemporaryPassword({
        currentPassword: "sementara123",
        newPassword: "Pribadi#2026",
      }),
    ).resolves.toEqual({ success: true, data: { changed: true } });
  });

  test("akun yang sama tetap ditolak pada prosedur operasional", async () => {
    const error = await expectTRPCError(callerFor(temporaryPasswordActor).operational());

    expect(error.code).toBe("FORBIDDEN");
    expect(error.message).toBe("MUST_CHANGE_PASSWORD");
  });

  test("menolak password baru yang sama dengan password sementara", async () => {
    const error = await expectTRPCError(
      callerFor(temporaryPasswordActor).changeTemporaryPassword({
        currentPassword: "Pribadi#2026",
        newPassword: "Pribadi#2026",
      }),
    );

    expect(error.code).toBe("BAD_REQUEST");
  });

  test("menolak password baru yang tidak memenuhi kebijakan Zod", async () => {
    const error = await expectTRPCError(
      callerFor(temporaryPasswordActor).changeTemporaryPassword({
        currentPassword: "sementara123",
        newPassword: "pendek",
      }),
    );

    expect(error.code).toBe("BAD_REQUEST");
  });
});

describe("administration router wiring", () => {
  const routerSource = readFileSync(
    path.join(APP_ROOT, "server/trpc/routers/administration.ts"),
    "utf8",
  );

  test("mutation password memakai protectedProcedure, bukan activeProcedure", () => {
    expect(routerSource).toContain("protectedProcedure");
    expect(routerSource).not.toContain("activeProcedure.");
  });

  test("prosedur layar operasional tetap memakai activeProcedure", () => {
    const screenSource = readFileSync(path.join(APP_ROOT, "server/trpc/routers/screen.ts"), "utf8");
    const operationalProcedures = [...screenSource.matchAll(/:\s*(\w+Procedure)/g)].map(
      (match) => match[1],
    );

    expect(operationalProcedures.length).toBeGreaterThan(0);
    expect([...new Set(operationalProcedures)]).toEqual(["activeProcedure"]);
  });
});
