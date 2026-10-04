import { createTRPCRouter } from "@backend/server/trpc/init";
import { protectedProcedure } from "@backend/server/trpc/procedures";
import { changeTemporaryPasswordUseCase } from "@backend/server/usecases/administration/change-temporary-password";
import { changeTemporaryPasswordSchema } from "@atria/core/validations/administration";

/**
 * Cerminan `app/actions/administration-*.ts` untuk klien native.
 *
 * `changeTemporaryPassword` sengaja memakai `protectedProcedure`, BUKAN
 * `activeProcedure`. Akun dengan `mustChangePassword=true` harus bisa memanggil
 * tepat prosedur ini untuk keluar dari kondisinya; `activeProcedure` akan
 * menolaknya dengan `MUST_CHANGE_PASSWORD` dan membuat akun itu buntu di
 * perangkat. Seluruh prosedur operasional lain tetap `activeProcedure`, jadi
 * akun tersebut tidak memperoleh akses tambahan apa pun dari pengecualian ini.
 */
export const administrationRouter = createTRPCRouter({
  changeTemporaryPassword: protectedProcedure
    .input(changeTemporaryPasswordSchema)
    .mutation(({ ctx, input }) => changeTemporaryPasswordUseCase(ctx.actor!, input)),
});
