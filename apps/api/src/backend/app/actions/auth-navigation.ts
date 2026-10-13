import { resolveHomeDestination } from "@backend/features/navigation/server/home-destination";
import { z } from "zod";
import { postLoginDestination } from "@backend/lib/navigation/post-login-policy";
import { resolveActor } from "@backend/server/actor";

/**
 * Menyelesaikan rute tujuan pengalihan setelah autentikasi berhasil.
 *
 * Mengembalikan rute langsung (misal: `/onboarding?step=welcome` untuk Owner
 * pertama kali, atau `/ledger`) sehingga navigasi login bisa langsung menuju ke
 * halaman target tanpa harus singgah di `/` dan memicu transisi ganda.
 */
const navigationInput = z
  .object({ returnTo: z.string().max(4096).optional(), surface: z.literal("mobile").optional() })
  .optional();

export async function getPostLoginRedirectDestination(input?: unknown): Promise<string> {
  const parsed = navigationInput.safeParse(input);
  const hints = parsed.success ? parsed.data : undefined;
  const actor = await resolveActor();
  if (!actor) return "/login";
  const home =
    actor.mustChangePassword && !actor.developerActorUserId
      ? "/profile/password"
      : await resolveHomeDestination(actor);
  return postLoginDestination(home, hints?.returnTo, hints?.surface === "mobile");
}
