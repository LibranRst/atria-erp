import { and, eq, ne } from "drizzle-orm";

import { db } from "@backend/db";
import { account, auditLog, session, user } from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import type { Actor } from "@backend/server/actor";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  changeOwnPasswordSchema,
  type ChangeOwnPasswordInput,
} from "@atria/core/validations/profile";

/**
 * Ganti kata sandi mandiri.
 *
 * Bentuknya mencerminkan `changeTemporaryPasswordUseCase` dengan satu perbedaan
 * yang disengaja: sesi yang sedang dipakai **dipertahankan**. Jalur kata sandi
 * sementara menghapus seluruh sesi karena formulirnya memang mengakhiri dengan
 * `signOut()`; di sini pengguna baru saja mengetik kata sandi barunya dan tidak
 * ada alasan memintanya login ulang di perangkat yang sama.
 *
 * `auth.api.changePassword` sengaja tidak dipakai. Ia menaruh penulisan audit di
 * luar transaksi, sehingga kata sandi bisa berganti sementara jejaknya hilang.
 * Yang diambil dari Better Auth hanya hashing-nya.
 */
export async function changeOwnPasswordUseCase(
  actor: Actor,
  input: ChangeOwnPasswordInput,
): Promise<ActionResponse<{ readonly changed: true }>> {
  const validation = changeOwnPasswordSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Password tidak valid.",
      },
    };

  const credential = await db.query.account.findFirst({
    where: and(eq(account.userId, actor.userId), eq(account.providerId, "credential")),
  });
  if (!credential?.password)
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Credential user tidak ditemukan." },
    };

  const context = await auth.$context;
  const valid = await context.password.verify({
    hash: credential.password,
    password: validation.data.currentPassword,
  });
  if (!valid)
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Password saat ini tidak sesuai." },
    };

  const newHash = await context.password.hash(validation.data.newPassword);
  await db.transaction(async (tx) => {
    await tx
      .update(account)
      .set({ password: newHash, updatedAt: new Date() })
      .where(eq(account.id, credential.id));
    await tx.update(user).set({ updatedAt: new Date() }).where(eq(user.id, actor.userId));
    // Sesi pemanggil dikecualikan; sisanya dicabut. Bila `sessionId` kosong —
    // sesi tidak terbaca sama sekali — predikat ini mencabut semuanya, arah
    // gagal yang aman.
    await tx
      .delete(session)
      .where(and(eq(session.userId, actor.userId), ne(session.id, actor.sessionId)));
    await tx.insert(auditLog).values({
      userId: actor.userId,
      action: "CHANGE_OWN_PASSWORD",
      targetTable: "user",
      targetId: actor.userId,
      newState: JSON.stringify({ passwordChangedAt: new Date().toISOString() }),
    });
  });

  return { success: true, data: { changed: true } };
}
