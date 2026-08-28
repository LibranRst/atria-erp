import "server-only";

import { createTRPCRouter } from "@/server/trpc/init";
import { activeProcedure } from "@/server/trpc/procedures";
import { changeOwnPasswordUseCase } from "@/server/usecases/profile/change-own-password";
import { updateOwnProfileUseCase } from "@/server/usecases/profile/update-own-profile";
import {
  changeOwnPasswordSchema,
  updateOwnProfileSchema,
} from "@atria/core/validations/profile";

/**
 * Cerminan `app/actions/profile/**` untuk klien native.
 *
 * Keduanya `activeProcedure`, bukan `protectedProcedure`: akun dengan kata sandi
 * sementara punya jalurnya sendiri (`administration.changeTemporaryPassword`)
 * dan tidak boleh melewatinya lewat pintu ini.
 */
export const profileRouter = createTRPCRouter({
  updateOwnProfile: activeProcedure
    .input(updateOwnProfileSchema)
    .mutation(({ ctx, input }) => updateOwnProfileUseCase(ctx.actor!, input)),
  changeOwnPassword: activeProcedure
    .input(changeOwnPasswordSchema)
    .mutation(({ ctx, input }) => changeOwnPasswordUseCase(ctx.actor!, input)),
});
