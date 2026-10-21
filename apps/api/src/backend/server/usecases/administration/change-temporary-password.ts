import { and, eq, ne } from "drizzle-orm";

import { db } from "@backend/db";
import { account, auditLog, session, user } from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import type { Actor } from "@backend/server/actor";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  changeTemporaryPasswordSchema,
  type ChangeTemporaryPasswordInput,
} from "@atria/core/validations/administration";

/**
 * Mengganti kata sandi sementara menjadi kata sandi pribadi.
 *
 * Ini satu-satunya operasi yang boleh dijalankan akun dengan
 * `mustChangePassword=true`. Karena itu prosedur tRPC-nya memakai
 * `protectedProcedure`, bukan `activeProcedure` — kalau memakai `activeProcedure`
 * akun tersebut akan tertahan `MUST_CHANGE_PASSWORD` dan tidak pernah bisa
 * keluar dari kondisinya. Seluruh procedure operasional lain tetap memakai
 * `activeProcedure` sehingga akun itu tidak mendapat akses apa pun selain ini.
 *
 * Identitas selalu datang dari `Actor` yang sudah diselesaikan server, tidak
 * pernah dari argumen klien.
 */
export async function changeTemporaryPasswordUseCase(
  actor: Actor,
  input: ChangeTemporaryPasswordInput,
): Promise<ActionResponse<{ readonly changed: true }>> {
  const validation = changeTemporaryPasswordSchema.safeParse(input);
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
      error: { code: "FORBIDDEN", message: "Password sementara tidak sesuai." },
    };
  const newHash = await context.password.hash(validation.data.newPassword);
  await db.transaction(async (tx) => {
    await tx
      .update(account)
      .set({ password: newHash, updatedAt: new Date() })
      .where(eq(account.id, credential.id));
    await tx
      .update(user)
      .set({ mustChangePassword: false, temporaryPasswordIssuedAt: null, updatedAt: new Date() })
      .where(eq(user.id, actor.userId));
    await tx.delete(session).where(and(eq(session.userId, actor.userId), ne(session.id, "")));
    await tx.insert(auditLog).values({
      userId: actor.userId,
      action: "CHANGE_TEMPORARY_PASSWORD",
      targetTable: "user",
      targetId: actor.userId,
      newState: JSON.stringify({ mustChangePassword: false }),
    });
  });
  return { success: true, data: { changed: true } };
}
