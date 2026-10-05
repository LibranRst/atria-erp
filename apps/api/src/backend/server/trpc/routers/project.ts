import { createTRPCRouter } from "@backend/server/trpc/init";
import { activeProcedure } from "@backend/server/trpc/procedures";
import { createProjectUseCase } from "@backend/server/usecases/project/create-project";
import { getProjectFormBootstrap } from "@backend/server/usecases/project/project-form-bootstrap";
import { updateProjectUseCase } from "@backend/server/usecases/project/update-project";
import {
  createProjectSchema,
  projectFormBootstrapSchema,
  updateProjectIdentitySchema,
} from "@atria/core/validations/project";

/** Transport native untuk identitas proyek; logika bisnis tetap milik use-case. */
export const projectRouter = createTRPCRouter({
  bootstrap: activeProcedure
    .input(projectFormBootstrapSchema)
    .query(({ ctx, input }) => getProjectFormBootstrap(ctx.actor!, input)),
  create: activeProcedure
    .input(createProjectSchema)
    .mutation(({ ctx, input }) => createProjectUseCase(ctx.actor!, input)),
  update: activeProcedure.input(updateProjectIdentitySchema).mutation(async ({ ctx, input }) => {
    const bootstrap = await getProjectFormBootstrap(ctx.actor!, { projectId: input.id });
    if (bootstrap.status !== "ready" || !bootstrap.project) {
      return {
        success: false as const,
        error: {
          code: bootstrap.status === "notFound" ? "NOT_FOUND" : "FORBIDDEN",
          message:
            bootstrap.status === "notFound"
              ? "Proyek tidak ditemukan."
              : "Anda hanya dapat memperbarui proyek yang berada dalam cakupan Anda.",
        },
      };
    }

    return updateProjectUseCase(ctx.actor!, {
      ...input,
      coverImageUrl: bootstrap.project.coverImageUrl ?? "",
      financialHealth: bootstrap.project.financialHealth,
      status: bootstrap.project.status,
    });
  }),
});
