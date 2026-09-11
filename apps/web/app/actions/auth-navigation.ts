"use server";

import { resolveHomeDestination } from "@/features/navigation/server/home-destination";
import { resolveActor } from "@/server/actor";

/**
 * Menyelesaikan rute tujuan pengalihan setelah autentikasi berhasil.
 *
 * Mengembalikan rute langsung (misal: `/onboarding?step=welcome` untuk Owner
 * pertama kali, atau `/ledger`) sehingga navigasi login bisa langsung menuju ke
 * halaman target tanpa harus singgah di `/` dan memicu transisi ganda.
 */
export async function getPostLoginRedirectDestination(): Promise<string> {
  const actor = await resolveActor();
  if (!actor) return "/login";
  return resolveHomeDestination(actor);
}
