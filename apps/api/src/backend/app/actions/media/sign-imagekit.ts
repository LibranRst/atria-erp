import { resolveActor } from "@backend/server/actor";
import { signImagekitUseCase } from "@backend/server/usecases/media/sign-imagekit";
import type { ImageKitSignature } from "@backend/server/usecases/media/sign-imagekit";
import type { ActionResponse } from "@atria/core/types/action-response";

/**
 * Pembungkus tipis di atas `signImagekitUseCase`. Logikanya dipakai bersama
 * prosedur tRPC supaya unggahan kamera dari klien native memakai jalur
 * penandatanganan yang sama.
 */
export async function signImagekit(): Promise<ActionResponse<ImageKitSignature>> {
  const actor = await resolveActor();
  if (!actor) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Harap login kembali." },
    };
  }

  return signImagekitUseCase();
}
