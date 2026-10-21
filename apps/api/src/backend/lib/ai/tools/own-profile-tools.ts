import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { resolveActor, type Actor } from "@backend/server/actor";
import { ownProfileInputSchema } from "@atria/core/ai/own-profile";
import {
  prepareOwnProfile,
  ownProfileContext,
} from "@backend/server/usecases/ai/own-profile-context";
import { OwnProfileError } from "@backend/server/usecases/profile/update-own-profile";
import type { AiToolContext } from "./context";
async function current(context: AiToolContext): Promise<Actor> {
  const actor = await resolveActor();
  if (!actor || actor.userId !== context.userId)
    throw new OwnProfileError("FORBIDDEN", "Sesi tidak valid.");
  return actor;
}
function failed(e: unknown): { readonly error: string } {
  return {
    error:
      e instanceof OwnProfileError
        ? e.message
        : "Profil atau pilihan foto belum dapat dibaca. Coba lagi.",
  };
}
export function buildOwnProfileTools(context: AiToolContext): ToolSet {
  return {
    getOwnProfileContext: tool({
      description:
        "Read only the actual session user's name/photo and bounded owned private chat image choices (JPEG/PNG/WebP≤8MB,20/page,1-character search). Any role/dataScope can manage its OWN profile with use:ai_chat; never require manage:users or target another user. Use actual attachment IDs from explicit human-selected uploads/this result; never silently choose latest/first when unclear, infer identity from a photo, invent a name or accept remote URLs. For no uploaded image ask the user to attach it in the composer. Existing name/photo, email, password, role and security are separate; do not show credentials.",
      inputSchema: z
        .object({
          photoQuery: z.string().trim().min(1).max(100).optional(),
          offset: z.number().int().min(0).max(100000).default(0),
        })
        .strict(),
      execute: async (input) => {
        try {
          return {
            ...(await ownProfileContext(await current(context), input)),
            instruction:
              "Tanyakan perubahan yang diminta. Untuk foto pilih lampiran milik user secara eksplisit; gunakan proposeOwnProfile untuk preview saja, tombol Simpan manusia untuk menerapkan. Foto sumber chat tetap privat; salinan foto profil dibuat setelah Simpan.",
          };
        } catch (e: unknown) {
          return failed(e);
        }
      },
    }),
    proposeOwnProfile: tool({
      description:
        "Read-only immutable OWN profile preview, name optionally changed and photo KEEP(default)/REMOVE/REPLACE using an actual owned private chat attachment ID. Call getOwnProfileContext first; preserve omitted name/photo, ask user which image if ambiguous. Only the session user, even for Owner; no userId/email/password/roles/grants/status fields or arbitrary URLs. Human must press Simpan profil; verbal approval never changes data. Photos remain private drafts until explicit Save creates a square avatar copy; model/preview never uploads a public image. No-op requires no save. Stale/expired/removed photos require a fresh proposal. No finance/stock/security changes.",
      inputSchema: ownProfileInputSchema,
      execute: async (input) => {
        try {
          return { proposal: await prepareOwnProfile(await current(context), input) };
        } catch (e: unknown) {
          return failed(e);
        }
      },
    }),
  };
}
