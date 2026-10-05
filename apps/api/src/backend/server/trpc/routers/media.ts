import { createTRPCRouter } from "@backend/server/trpc/init";
import { activeProcedure } from "@backend/server/trpc/procedures";
import { signImagekitUseCase } from "@backend/server/usecases/media/sign-imagekit";

/**
 * Penandatanganan unggahan ImageKit untuk klien native. Alur sesudahnya identik
 * dengan web: klien mengunggah langsung ke ImageKit, lalu URL-nya dikirim ke
 * OCR Gemini.
 */
export const mediaRouter = createTRPCRouter({
  signImagekit: activeProcedure.mutation(() => signImagekitUseCase()),
});
