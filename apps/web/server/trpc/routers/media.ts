import "server-only";

import { createTRPCRouter } from "@/server/trpc/init";
import { activeProcedure } from "@/server/trpc/procedures";
import { signImagekitUseCase } from "@/server/usecases/media/sign-imagekit";

/**
 * Penandatanganan unggahan ImageKit untuk klien native. Alur sesudahnya identik
 * dengan web: klien mengunggah langsung ke ImageKit, lalu URL-nya dikirim ke
 * OCR Gemini.
 */
export const mediaRouter = createTRPCRouter({
  signImagekit: activeProcedure.mutation(() => signImagekitUseCase()),
});
