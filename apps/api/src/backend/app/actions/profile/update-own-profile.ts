import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";

import { resolveActor } from "@backend/server/actor";
import { updateOwnProfileUseCase } from "@backend/server/usecases/profile/update-own-profile";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { UpdateOwnProfileInput } from "@atria/core/validations/profile";

/**
 * Pembungkus tipis di atas `updateOwnProfileUseCase`.
 *
 * Identitas SELALU diselesaikan di sini dari sesi, tidak pernah diterima sebagai
 * argumen — modul `"use server"` adalah endpoint HTTP, jadi parameter aktor akan
 * bisa dipalsukan klien. Prosedur tRPC memanggil use-case yang sama dengan actor
 * bearer, sehingga web dan native berbagi satu badan transaksi.
 */
export async function updateOwnProfile(
  input: UpdateOwnProfileInput,
): Promise<ActionResponse<{ readonly updated: boolean }>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };

  const result = await updateOwnProfileUseCase(actor, input);
  // Halaman profil dirender server; tanpa ini nama lama bertahan sampai
  // navigasi berikutnya. Submit yang tidak mengubah apa pun tidak perlu
  // membatalkan cache.
  if (result.success && result.data.updated) {
    revalidatePath("/profile");
    revalidatePath("/", "layout");
  }
  return result;
}
