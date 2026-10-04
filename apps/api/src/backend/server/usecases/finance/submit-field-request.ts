import { thresholdCentsToRupiah } from "@atria/core/finance/approval-thresholds";
import { assertExpenseAttachment } from "./expense-attachment";
import { auditLog, projectCost } from "@backend/db/schema";
import { createSubmittedFieldRequestTx } from "@backend/app/actions/finance/field-request-submit";
import { assertProjectStatusIsOperational } from "@backend/lib/auth/scoping";
import { readApprovalThresholds } from "@backend/lib/finance/approval-thresholds";
import type { Actor } from "@backend/server/actor";
import {
  submitFieldRequestSchema,
  type SubmitFieldRequestInput,
} from "@atria/core/validations/finance";
import {
  assertFinancePermission,
  lockFinanceProject,
  type FinanceTransaction,
} from "./mutation-access";

export async function submitFieldRequestTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: SubmitFieldRequestInput,
): Promise<typeof projectCost.$inferSelect> {
  const data = submitFieldRequestSchema.parse(input);
  assertFinancePermission(actor, "create:cost");
  const currentProject = await lockFinanceProject(tx, actor, data.projectId);
  assertProjectStatusIsOperational(currentProject.status);
  await assertExpenseAttachment(actor, data.projectId, data.receiptImageUrl, undefined, tx);
  const created = await createSubmittedFieldRequestTx(tx, {
    projectId: data.projectId,
    requestedById: actor.userId,
    receiptImageUrl: data.receiptImageUrl,
    item: data,
    ownerApprovalThreshold: thresholdCentsToRupiah(
      (await readApprovalThresholds(tx)).fieldCostCents,
    ),
  });
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "SUBMIT_FIELD_REQUEST",
    targetTable: "project_cost",
    targetId: created.id,
    newState: JSON.stringify(created),
  });
  return created;
}
