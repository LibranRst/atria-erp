import { eq } from "drizzle-orm";

import { db } from "@backend/db";
import { auditLog, user } from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  updateOwnProfileSchema,
  type UpdateOwnProfileInput,
} from "@atria/core/validations/profile";

/**
 * Memperbarui nama tampilan dan foto profil milik pemanggil sendiri.
 *
 * Nama punya dua jalur tulis — jalur ini dan `updateStaffUser` milik admin —
 * dan keduanya menulis `audit_log`, sehingga riwayat sebuah nama tetap utuh dari
 * sisi mana pun ia diubah.
 *
 * `updated: false` bukan kegagalan: ia menandai submit yang tidak mengubah apa
 * pun. Tanpa itu, membuka lalu menyimpan sheet tanpa mengetik apa-apa akan
 * melahirkan satu baris `audit_log` kosong setiap kali — dan `audit_log` di
 * sini adalah alat investigasi finansial, bukan buku harian.
 */
export async function updateOwnProfileUseCase(
  actor: Actor,
  input: UpdateOwnProfileInput,
): Promise<ActionResponse<{ readonly updated: boolean }>> {
  const validation = updateOwnProfileSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Data profil tidak valid.",
      },
    };

  const existing = await db.query.user.findFirst({ where: eq(user.id, actor.userId) });
  if (!existing)
    return { success: false, error: { code: "NOT_FOUND", message: "User tidak ditemukan." } };

  const nextName = validation.data.name;
  // `undefined` berarti foto tidak disentuh; `null` berarti dihapus.
  const imageProvided = validation.data.imageUrl !== undefined;
  const nextImage = imageProvided ? (validation.data.imageUrl ?? null) : existing.image;

  const nameChanged = nextName !== existing.name;
  const imageChanged = imageProvided && nextImage !== existing.image;

  if (!nameChanged && !imageChanged) return { success: true, data: { updated: false } };

  await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({ name: nextName, image: nextImage, updatedAt: new Date() })
      .where(eq(user.id, actor.userId));
    await tx.insert(auditLog).values({
      userId: actor.userId,
      action: "UPDATE_OWN_PROFILE",
      targetTable: "user",
      targetId: actor.userId,
      originalState: JSON.stringify({
        ...(nameChanged ? { name: existing.name } : {}),
        ...(imageChanged ? { image: existing.image } : {}),
      }),
      newState: JSON.stringify({
        ...(nameChanged ? { name: nextName } : {}),
        ...(imageChanged ? { image: nextImage } : {}),
      }),
    });
  });

  return { success: true, data: { updated: true } };
}
