import { projectCost } from "@backend/db/schema";
import { submitExpenseBatchTx } from "./submit-expense-batch";
import type { Actor } from "@backend/server/actor";
import {
  submitFieldRequestSchema,
  type SubmitFieldRequestInput,
} from "@atria/core/validations/finance";
import { type FinanceTransaction } from "./mutation-access";

export async function submitFieldRequestTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: SubmitFieldRequestInput,
): Promise<typeof projectCost.$inferSelect> {
  const data = submitFieldRequestSchema.parse(input);
  const { projectId, receiptImageUrl, ...item } = data;
  const costs = await submitExpenseBatchTx(tx, actor, {
    projectId,
    receiptImageUrl,
    items: [item],
  });
  return costs[0];
}
