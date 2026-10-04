import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";

import type { SubmittedExpenseDraft } from "@backend/app/actions/finance/expense-draft-types";
import { resolveActor } from "@backend/server/actor";
import { submitExpenseDraftUseCase } from "@backend/server/usecases/finance/submit-expense-draft";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { SubmitExpenseDraftInput } from "@atria/core/validations/expense-draft";

export async function submitExpenseDraft(
  input: SubmitExpenseDraftInput,
): Promise<ActionResponse<SubmittedExpenseDraft>> {
  const actor = await resolveActor();
  if (!actor) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." },
    };
  }

  const result = await submitExpenseDraftUseCase(actor, input);
  if (result.success) {
    revalidatePath("/expenses");
    revalidatePath(`/projects/${result.data.projectId}`);
  }
  return result;
}
