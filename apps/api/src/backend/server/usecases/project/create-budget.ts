import { auditLog, projectBudgets } from "@backend/db/schema";
import { insertCanonicalProjectBudgetTx } from "@backend/lib/budget/project-budget-creation";
import type { Actor } from "@backend/server/actor";
import {
  assertFinancePermission,
  lockFinanceProject,
  type FinanceTransaction,
} from "@backend/server/usecases/finance/mutation-access";
import {
  aiSetupBudgetProposalSchema,
  type AiSetupBudgetProposalInput,
} from "@atria/core/validations/ai-proposal";
import { eq } from "drizzle-orm";

export async function setupAiProjectBudgetTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: AiSetupBudgetProposalInput,
): Promise<typeof projectBudgets.$inferSelect> {
  const data = aiSetupBudgetProposalSchema.parse(input);
  assertFinancePermission(actor, "create:budget");
  await lockFinanceProject(tx, actor, data.projectId);
  const existing = await tx.query.projectBudgets.findFirst({
    where: eq(projectBudgets.projectId, data.projectId),
  });
  if (existing) throw new Error("FORBIDDEN: Budget utama proyek sudah tersedia.");
  const budget = await insertCanonicalProjectBudgetTx({
    tx,
    projectId: data.projectId,
    contractValue: data.contractValue,
    allocation: { budgetCapRatio: data.budgetCapRatio, categories: data.categories },
    notes: data.notes ?? "Alokasi awal disiapkan melalui Asisten AI",
  });
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "AI_PROPOSED_CREATE_PROJECT_BUDGET",
    targetTable: "project_budgets",
    targetId: budget.id,
    newState: JSON.stringify(budget),
  });
  return budget;
}
