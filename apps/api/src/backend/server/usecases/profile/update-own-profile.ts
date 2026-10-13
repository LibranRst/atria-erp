import { eq } from "drizzle-orm";
import { db } from "@backend/db";
import { auditLog, user, role } from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import type { FinanceTransaction } from "../finance/mutation-access";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  updateOwnProfileSchema,
  type UpdateOwnProfileInput,
} from "@atria/core/validations/profile";
export class OwnProfileError extends Error {
  constructor(
    readonly code:
      "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR" | "TRANSACTION_FAILED",
    message: string,
  ) {
    super(message);
  }
}
export async function lockOwnProfileTx(
  tx: FinanceTransaction,
  actor: Actor,
): Promise<typeof user.$inferSelect> {
  const [r] = await tx.select().from(role).where(eq(role.id, actor.roleId)).for("share");
  if (!r || !actor.isActive)
    throw new OwnProfileError("FORBIDDEN", "Akun tidak tersedia dalam sesi Anda.");
  const [u] = await tx.select().from(user).where(eq(user.id, actor.userId)).for("update");
  if (
    !u ||
    !u.isActive ||
    u.roleId !== actor.roleId ||
    (u.mustChangePassword && !actor.developerActorUserId)
  )
    throw new OwnProfileError(
      "FORBIDDEN",
      "Sesi atau akses akun berubah. Periksa akun lalu masuk kembali.",
    );
  return u;
}
/** One locked own-user writer for web, native and reviewed AI changes. Omitted photo is preserved. */
export async function updateOwnProfileTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: UpdateOwnProfileInput,
): Promise<{ readonly updated: boolean; readonly auditId: string | null }> {
  const validation = updateOwnProfileSchema.safeParse(input);
  if (!validation.success)
    throw new OwnProfileError(
      "VALIDATION_ERROR",
      validation.error.issues[0]?.message ?? "Data profil tidak valid.",
    );
  const existing = await lockOwnProfileTx(tx, actor),
    name = validation.data.name;
  const photoProvided = validation.data.imageUrl !== undefined,
    image = photoProvided ? (validation.data.imageUrl ?? null) : existing.image;
  const nameChanged = name !== existing.name,
    imageChanged = photoProvided && image !== existing.image;
  if (!nameChanged && !imageChanged) return { updated: false, auditId: null };
  await tx
    .update(user)
    .set({ name, image, updatedAt: new Date() })
    .where(eq(user.id, actor.userId));
  const [audit] = await tx
    .insert(auditLog)
    .values({
      userId: actor.userId,
      action: "UPDATE_OWN_PROFILE",
      targetTable: "user",
      targetId: actor.userId,
      originalState: JSON.stringify({
        ...(nameChanged ? { name: existing.name } : {}),
        ...(imageChanged ? { image: existing.image } : {}),
      }),
      newState: JSON.stringify({
        ...(nameChanged ? { name } : {}),
        ...(imageChanged ? { image } : {}),
      }),
    })
    .returning({ id: auditLog.id });
  if (!audit) throw new OwnProfileError("TRANSACTION_FAILED", "Profil belum tercatat. Coba lagi.");
  return { updated: true, auditId: audit.id };
}
export async function updateOwnProfileUseCase(
  actor: Actor,
  input: UpdateOwnProfileInput,
): Promise<ActionResponse<{ readonly updated: boolean }>> {
  try {
    const result = await db.transaction((tx) => updateOwnProfileTx(tx, actor, input));
    return { success: true, data: { updated: result.updated } };
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        code: error instanceof OwnProfileError ? error.code : "TRANSACTION_FAILED",
        message:
          error instanceof OwnProfileError
            ? error.message
            : "Profil belum dapat disimpan. Coba lagi.",
      },
    };
  }
}
