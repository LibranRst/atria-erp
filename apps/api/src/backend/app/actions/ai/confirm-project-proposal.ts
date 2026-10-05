import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";
import { resolveActor } from "@backend/server/actor";
import {
  confirmMutation,
  mapConfirmationError,
} from "@backend/server/usecases/ai/confirm-mutation";
import { assertFinancePermission } from "@backend/server/usecases/finance/mutation-access";
import { createProjectTx } from "@backend/server/usecases/project/create-project";
import { setupAiProjectBudgetTx } from "@backend/server/usecases/project/create-budget";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  aiCreateProjectProposalSchema,
  aiSetupBudgetProposalSchema,
} from "@atria/core/validations/ai-proposal";

export async function confirmAiCreateProjectProposal(
  input: unknown,
): Promise<ActionResponse<{ projectId: string; alreadyConfirmed: boolean }>> {
  const actor = await resolveActor();
  if (!actor)
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Silakan masuk kembali." },
    };
  const parsed = aiCreateProjectProposalSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Rincian pembuatan proyek tidak valid." },
    };
  try {
    assertFinancePermission(actor, "create:project");
  } catch (error: unknown) {
    return mapConfirmationError(error);
  }
  const proposal = parsed.data;
  const outcome = await confirmMutation(actor, proposal, "CREATE_PROJECT", async (tx) => {
    const result = await createProjectTx(tx, actor, { ...proposal, status: "DRAFT" });
    return { documentId: result.id, result };
  });
  if (!outcome.success) return outcome;
  revalidatePath("/projects");
  revalidatePath("/ledger");
  return {
    success: true,
    data: { projectId: outcome.data.documentId, alreadyConfirmed: outcome.data.kind === "already" },
  };
}

export async function confirmAiSetupBudgetProposal(
  input: unknown,
): Promise<ActionResponse<{ budgetId: string; alreadyConfirmed: boolean }>> {
  const actor = await resolveActor();
  if (!actor)
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Silakan masuk kembali." },
    };
  const parsed = aiSetupBudgetProposalSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Rincian alokasi budget tidak valid." },
    };
  try {
    assertFinancePermission(actor, "create:budget");
  } catch (error: unknown) {
    return mapConfirmationError(error);
  }
  const proposal = parsed.data;
  const outcome = await confirmMutation(actor, proposal, "SETUP_BUDGET", async (tx) => {
    const result = await setupAiProjectBudgetTx(tx, actor, proposal);
    return { documentId: result.id, result };
  });
  if (!outcome.success) return outcome;
  revalidatePath(`/projects/${proposal.projectId}`);
  revalidatePath("/ledger");
  return {
    success: true,
    data: { budgetId: outcome.data.documentId, alreadyConfirmed: outcome.data.kind === "already" },
  };
}
