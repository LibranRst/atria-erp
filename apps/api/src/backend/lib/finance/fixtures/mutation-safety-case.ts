import { PGlite } from "@electric-sql/pglite";
import { expect, mock } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { eq, and } from "drizzle-orm";
import * as schema from "@backend/db/schema";
import { withCommitEffects } from "@backend/lib/db/commit-effects";
import type { PermissionKey } from "@atria/core/auth/permissions";
import { APPROVAL_THRESHOLD_CONFIG_KEYS } from "@atria/core/finance/approval-thresholds";

// All SQL and domain mutations in this process target disposable in-memory Postgres.
const postgres = new PGlite();
const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema));
await postgres.exec(statements.join(";\n"));
await postgres.exec(
  "ALTER TABLE ai_proposal_confirmation ADD CONSTRAINT injected_confirmation_failure CHECK (tool_call_id NOT LIKE 'fail-%')",
);
const database = drizzle(postgres, { schema });
let releasedEffects = 0;
database.transaction = withCommitEffects(
  database.transaction.bind(database),
  (error: unknown): void => {
    throw error;
  },
);
mock.module("@backend/db", () => ({ db: database }));
mock.module("@backend/server/services/notification-service", () => ({
  scheduleNotificationPush: (): void => {
    releasedEffects += 1;
  },
}));
const userId = crypto.randomUUID();
const otherUserId = crypto.randomUUID();
const roleId = crypto.randomUUID();
const assignedRoleId = crypto.randomUUID();
const noneRoleId = crypto.randomUUID();
const ledgerRoleId = crypto.randomUUID();
const ownerRoleId = crypto.randomUUID();
const ownerUserId = crypto.randomUUID();
let sessionRoleId = roleId;
mock.module("@backend/lib/server/session", () => ({
  getServerSession: async (): Promise<unknown> => ({
    user: {
      id: userId,
      roleId: sessionRoleId,
      isActive: true,
      name: "Fixture",
      email: "fixture@example.invalid",
    },
    session: { id: "fixture" },
  }),
  getSessionFromHeaders: async (): Promise<unknown> => ({
    user: {
      id: userId,
      roleId: sessionRoleId,
      isActive: true,
      name: "Fixture",
      email: "fixture@example.invalid",
    },
    session: { id: "fixture" },
  }),
}));
await database
  .insert(schema.tenant)
  .values({ id: schema.INSTANCE_TENANT_ID, name: "Disposable", slug: "disposable" });
await database.insert(schema.role).values([
  { id: roleId, name: "PILOT_FINANCE", dataScope: "GLOBAL" },
  { id: assignedRoleId, name: "ASSIGNED_FINANCE", dataScope: "ASSIGNED" },
  { id: noneRoleId, name: "NO_SCOPE_FINANCE", dataScope: "NONE" },
  { id: ledgerRoleId, name: "LEDGER_ONLY", dataScope: "GLOBAL" },
  { id: ownerRoleId, name: "owner", dataScope: "GLOBAL" },
]);
const permissions: readonly PermissionKey[] = [
  "create:budget",
  "create:project",
  "view:budget",
  "view:profitability",
  "create:cost",
  "view:cost",
  "update:cost",
  "verify:cost",
  "approve:cost",
  "pay:cost",
  "pay:vendor_bill",
  "create:vendor_bill",
  "reconcile:client_invoice",
  "view:client_invoice",
  "view:project",
];
for (const id of [roleId, assignedRoleId, noneRoleId])
  await database
    .insert(schema.rolePermission)
    .values(permissions.map((permissionKey) => ({ roleId: id, permissionKey })));
await database
  .insert(schema.rolePermission)
  .values({ roleId: ledgerRoleId, permissionKey: "reconcile:ledger" });
await database.insert(schema.user).values([
  { id: userId, name: "Fixture", email: "fixture@example.invalid", roleId },
  { id: otherUserId, name: "Other", email: "other@example.invalid", roleId },
  { id: ownerUserId, name: "Owner", email: "owner@example.invalid", roleId: ownerRoleId },
]);
const clientId = crypto.randomUUID();
const assignedProjectId = crypto.randomUUID();
const foreignProjectId = crypto.randomUUID();
const draftProjectId = crypto.randomUUID();
await database
  .insert(schema.client)
  .values({ id: clientId, name: "Client", email: "client@example.invalid", phone: "-" });
await database.insert(schema.project).values([
  {
    id: assignedProjectId,
    clientId,
    name: "Assigned",
    projectManagerId: userId,
    status: "ACTIVE",
    totalContractValue: "100000000.00",
  },
  {
    id: foreignProjectId,
    clientId,
    name: "Foreign",
    projectManagerId: otherUserId,
    status: "ACTIVE",
    totalContractValue: "100000000.00",
  },
  {
    id: draftProjectId,
    clientId,
    name: "Draft",
    projectManagerId: userId,
    status: "DRAFT",
    totalContractValue: "100000000.00",
  },
]);
const expenseCategoryId = crypto.randomUUID();
await database
  .insert(schema.expenseCategory)
  .values({ id: expenseCategoryId, code: "OPERASIONAL", name: "Operasional" });
const budgetId = crypto.randomUUID();
const categoryId = crypto.randomUUID();
await database.insert(schema.projectBudgets).values({
  id: budgetId,
  projectId: assignedProjectId,
  status: "APPROVED",
  contractValue: "100000000.00",
  approvedRabValue: "100000000.00",
  internalBudget: "90000000.00",
  budgetCapRatio: "0.9",
  targetGrossAmount: "10000000.00",
  targetGrossPercentage: "10",
});
await database.insert(schema.projectBudgetCategory).values({
  id: categoryId,
  projectBudgetId: budgetId,
  expenseCategoryId,
  ratioPercentage: "1.0",
  allocatedAmount: "90000000.00",
  remainingAmount: "90000000.00",
});
const bankAccountId = crypto.randomUUID();
await database.insert(schema.bankAccount).values({
  id: bankAccountId,
  name: "Fixture account",
  accountNumber: "FIXTURE-001",
  bankName: "Fixture",
  holderName: "Fixture",
  balance: "50000000.00",
});
const invoiceId = crypto.randomUUID();
const foreignInvoiceId = crypto.randomUUID();
await database.insert(schema.clientInvoice).values([
  {
    id: invoiceId,
    projectId: assignedProjectId,
    invoiceNumber: "FIXTURE-INV",
    amount: "20000000.00",
    status: "UNPAID",
    stage: "DP",
    dueDate: new Date(),
  },
  {
    id: foreignInvoiceId,
    projectId: foreignProjectId,
    invoiceNumber: "FOREIGN-INV",
    amount: "20000000.00",
    status: "UNPAID",
    stage: "DP",
    dueDate: new Date(),
  },
]);
const vendorId = crypto.randomUUID();
const billId = crypto.randomUUID();
const paymentId = crypto.randomUUID();
await database
  .insert(schema.vendor)
  .values({ id: vendorId, name: "Fixture vendor", phone: "-", email: "vendor@example.invalid" });
await database.insert(schema.vendorBill).values({
  id: billId,
  projectId: assignedProjectId,
  projectBudgetCategoryId: categoryId,
  vendorId,
  billNumber: "FIXTURE-VB",
  amount: "1000000.00",
  status: "UNPAID",
  dueDate: new Date(),
});
await database.insert(schema.vendorPayment).values({
  id: paymentId,
  vendorBillId: billId,
  bankAccountId,
  amountPaid: "1000000.00",
  paymentDate: new Date(),
  paidById: otherUserId,
});
const conversationId = crypto.randomUUID();
await database
  .insert(schema.aiConversation)
  .values({ id: conversationId, userId, title: "Fixture" });
const { recordClientPayment } = await import("@backend/app/actions/finance/record-client-payment");
const { payVendorBill } = await import("@backend/app/actions/finance/pay-vendor-bill");
const { scheduleVendorBillPayment } =
  await import("@backend/app/actions/finance/schedule-vendor-bill");
const { submitVendorBill } = await import("@backend/app/actions/finance/submit-vendor-bill");
const { approveVendorPayment } = await import("@backend/app/actions/finance/field-request-review");
const { confirmAiRecordClientPaymentProposal, confirmAiPayVendorBillProposal } =
  await import("@backend/app/actions/ai/confirm-finance-proposal");
const { confirmAiExpenseProposal, confirmAiDisburseExpenseProposal } =
  await import("@backend/app/actions/ai/confirm-expense-proposal");
const { confirmAiSetupBudgetProposal } =
  await import("@backend/app/actions/ai/confirm-project-proposal");
const { confirmAiCreateProjectProposal } =
  await import("@backend/app/actions/ai/confirm-project-proposal");
const { getOwnerBudgetDashboard } = await import("@backend/app/actions/project/excel-budget");
const { submitFieldRequest, verifyFieldRequest, payFieldRequest } =
  await import("@backend/app/actions/finance/field-requests");

async function snapshot(): Promise<unknown> {
  return {
    account: await database.query.bankAccount.findFirst({
      where: eq(schema.bankAccount.id, bankAccountId),
    }),
    ledger: await database.select().from(schema.cashTransaction),
    audit: await database.select().from(schema.auditLog),
    confirmations: await database.select().from(schema.aiProposalConfirmation),
    payments: await database.select().from(schema.clientPayment),
    vendorPayments: await database.select().from(schema.vendorPayment),
    vendorBills: await database.select().from(schema.vendorBill),
    approvals: await database.select().from(schema.approval),
    costs: await database.select().from(schema.projectCost),
    expenses: await database.select().from(schema.projectExpenses),
    categories: await database.select().from(schema.projectBudgetCategory),
    budgets: await database.select().from(schema.projectBudgets),
    projects: await database.select().from(schema.project),
    clients: await database.select().from(schema.client),
    notifications: await database.select().from(schema.notification),
    deliveries: await database.select().from(schema.notificationDelivery),
    effects: releasedEffects,
  };
}
const clientInput = {
  clientInvoiceId: invoiceId,
  bankAccountId,
  amountPaid: 1000000,
  paymentDate: new Date(),
  referenceNumber: "CLIENT-FIXTURE",
};
sessionRoleId = ledgerRoleId;
const beforeDenied = await snapshot();
expect(await recordClientPayment(clientInput)).toMatchObject({
  success: false,
  error: { code: "FORBIDDEN" },
});
expect(await snapshot()).toEqual(beforeDenied);
sessionRoleId = assignedRoleId;
expect(
  await recordClientPayment({ ...clientInput, clientInvoiceId: foreignInvoiceId }),
).toMatchObject({ success: false, error: { code: "FORBIDDEN" } });
expect(await snapshot()).toEqual(beforeDenied);
sessionRoleId = noneRoleId;
expect(await recordClientPayment(clientInput)).toMatchObject({
  success: false,
  error: { code: "FORBIDDEN" },
});
expect(
  await payVendorBill({
    vendorPaymentId: paymentId,
    bankAccountId,
    referenceNumber: "VENDOR-FIXTURE",
  }),
).toMatchObject({ success: false, error: { code: "FORBIDDEN" } });
expect(await snapshot()).toEqual(beforeDenied);
sessionRoleId = assignedRoleId;
expect(await getOwnerBudgetDashboard()).toMatchObject({
  success: false,
  error: { code: "FORBIDDEN" },
});
expect((await recordClientPayment(clientInput)).success).toBe(true);
await database
  .update(schema.project)
  .set({ projectManagerId: otherUserId })
  .where(eq(schema.project.id, assignedProjectId));
const beforeVendorScopeDenials = await snapshot();
expect(
  await payVendorBill({
    vendorPaymentId: paymentId,
    bankAccountId,
    referenceNumber: "FOREIGN-VENDOR",
  }),
).toMatchObject({ success: false, error: { code: "FORBIDDEN" } });
expect(await approveVendorPayment(paymentId)).toMatchObject({
  success: false,
  error: { code: "FORBIDDEN" },
});
expect(
  await scheduleVendorBillPayment({
    vendorBillId: billId,
    bankAccountId,
    paymentDate: new Date(),
    amountPaid: 10000,
  }),
).toMatchObject({ success: false, error: { code: "FORBIDDEN" } });
expect(
  await submitVendorBill({
    vendorId,
    projectId: assignedProjectId,
    projectBudgetCategoryId: categoryId,
    billNumber: "FOREIGN-CREATE",
    amount: 10000,
    dueDate: new Date(),
  }),
).toMatchObject({ success: false, error: { code: "FORBIDDEN" } });
expect(await snapshot()).toEqual(beforeVendorScopeDenials);
await database
  .update(schema.project)
  .set({ projectManagerId: userId })
  .where(eq(schema.project.id, assignedProjectId));

// A failing confirmation insert must roll back money, audit and durable notification effects.
sessionRoleId = roleId;
const paymentProposal = {
  ...clientInput,
  paymentDate: new Date().toISOString(),
  referenceNumber: "AI-CLIENT-FIXTURE",
  conversationId,
  toolCallId: "fail-client-payment",
};
const beforeRollback = await snapshot();
expect((await confirmAiRecordClientPaymentProposal(paymentProposal)).success).toBe(false);
expect(await snapshot()).toEqual(beforeRollback);
const successPayment = { ...paymentProposal, toolCallId: "client-payment" };
const first = await confirmAiRecordClientPaymentProposal(successPayment);
expect(first).toMatchObject({ success: true, data: { alreadyConfirmed: false } });
const afterFirst = await snapshot();
expect(await confirmAiRecordClientPaymentProposal(successPayment)).toMatchObject({
  success: true,
  data: { alreadyConfirmed: true },
});
expect(await snapshot()).toEqual(afterFirst);
expect(releasedEffects).toBeGreaterThan(0);
const vendorProposal = {
  conversationId,
  toolCallId: "fail-vendor-payment",
  vendorPaymentId: paymentId,
  bankAccountId,
  referenceNumber: "AI-VENDOR-FIXTURE",
  amountPaid: 1000000,
};
const beforeVendor = await snapshot();
expect((await confirmAiPayVendorBillProposal(vendorProposal)).success).toBe(false);
expect(await snapshot()).toEqual(beforeVendor);
expect(
  await confirmAiPayVendorBillProposal({ ...vendorProposal, toolCallId: "vendor-payment" }),
).toMatchObject({ success: true, data: { alreadyConfirmed: false } });
const afterVendor = await snapshot();
expect(
  await confirmAiPayVendorBillProposal({ ...vendorProposal, toolCallId: "vendor-payment" }),
).toMatchObject({ success: true, data: { alreadyConfirmed: true } });
expect(await snapshot()).toEqual(afterVendor);

const budgetProposal = {
  conversationId,
  toolCallId: "fail-budget",
  projectId: draftProjectId,
  contractValue: 100000000,
  budgetCapRatio: 0.9,
  categories: [{ expenseCategoryId, ratioPercentage: 1, sortOrder: 0 }],
};
const beforeBudget = await snapshot();
expect((await confirmAiSetupBudgetProposal(budgetProposal)).success).toBe(false);
expect(await snapshot()).toEqual(beforeBudget);
sessionRoleId = noneRoleId;
expect(
  await confirmAiSetupBudgetProposal({ ...budgetProposal, toolCallId: "budget" }),
).toMatchObject({ success: false, error: { code: "FORBIDDEN" } });
sessionRoleId = assignedRoleId;
expect(
  await confirmAiSetupBudgetProposal({
    ...budgetProposal,
    projectId: foreignProjectId,
    toolCallId: "foreign-budget",
  }),
).toMatchObject({ success: false, error: { code: "FORBIDDEN" } });
expect(
  await confirmAiSetupBudgetProposal({ ...budgetProposal, toolCallId: "budget" }),
).toMatchObject({ success: true, data: { alreadyConfirmed: false } });
expect(
  (
    await database
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.action, "AI_PROPOSED_CREATE_PROJECT_BUDGET"))
  ).length,
).toBe(1);

sessionRoleId = roleId;
const projectProposal = {
  conversationId,
  toolCallId: "fail-project",
  name: "Atomic project creation fixture",
  projectManagerId: userId,
  totalContractValue: 10000000,
  newClientName: "Atomic client fixture",
};
const beforeProject = await snapshot();
expect((await confirmAiCreateProjectProposal(projectProposal)).success).toBe(false);
expect(await snapshot()).toEqual(beforeProject);
const createdProject = await confirmAiCreateProjectProposal({
  ...projectProposal,
  toolCallId: "project",
});
expect(createdProject.success).toBe(true);
if (!createdProject.success) throw new Error(JSON.stringify(createdProject.error));
expect(
  (
    await database
      .select()
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.action, "CREATE_PROJECT"),
          eq(schema.auditLog.targetId, createdProject.data.projectId),
        ),
      )
  ).length,
).toBe(1);
const afterProject = await snapshot();
expect(
  await confirmAiCreateProjectProposal({ ...projectProposal, toolCallId: "project" }),
).toMatchObject({ success: true, data: { alreadyConfirmed: true } });
expect(await snapshot()).toEqual(afterProject);

// Settings threshold is frozen in the expense decision, including at payment.
sessionRoleId = roleId;
await database.insert(schema.appConfig).values({
  key: APPROVAL_THRESHOLD_CONFIG_KEYS.fieldCost,
  value: "1000000000",
  updatedById: userId,
});
const submitted = await submitFieldRequest({
  projectId: assignedProjectId,
  projectBudgetCategoryId: categoryId,
  description: "Threshold fixture expense",
  quantity: 1,
  unitPrice: 6000000,
  amount: 6000000,
  stockHandling: "EXPENSE_ONLY",
});
expect(submitted.success).toBe(true);
if (!submitted.success) throw new Error(JSON.stringify(submitted.error));
expect(submitted.data.requiresOwnerApproval).toBe(false);
const verified = await verifyFieldRequest(submitted.data.id);
expect(verified).toMatchObject({
  success: true,
  data: { status: "APPROVED", requiresOwnerApproval: false },
});
await database
  .update(schema.appConfig)
  .set({ value: "0" })
  .where(eq(schema.appConfig.key, APPROVAL_THRESHOLD_CONFIG_KEYS.fieldCost));
expect((await payFieldRequest(submitted.data.id, bankAccountId, "THRESHOLD-FIXTURE")).success).toBe(
  true,
);

const expenseProposal = {
  conversationId,
  toolCallId: "fail-expense",
  projectId: assignedProjectId,
  projectBudgetCategoryId: categoryId,
  description: "AI expense rollback fixture",
  quantity: 1,
  unitPrice: 100000,
  amount: 100000,
};
const beforeExpense = await snapshot();
expect((await confirmAiExpenseProposal(expenseProposal)).success).toBe(false);
expect(await snapshot()).toEqual(beforeExpense);
const createdExpense = await confirmAiExpenseProposal({
  ...expenseProposal,
  toolCallId: "expense",
});
if (!createdExpense.success) throw new Error(JSON.stringify(createdExpense.error));
expect(createdExpense.success).toBe(true);
// Force failure after verification/approval/payout: every step must be rolled back together.
await database
  .update(schema.projectCost)
  .set({ requiresOwnerApproval: false })
  .where(eq(schema.projectCost.id, createdExpense.data.expenseId));
const beforeDisbursement = await snapshot();
expect(
  (
    await confirmAiDisburseExpenseProposal({
      conversationId,
      toolCallId: "fail-disbursement",
      expenseId: createdExpense.data.expenseId,
      bankAccountId,
      referenceNumber: "AI-DISBURSE-FIXTURE",
    })
  ).success,
).toBe(false);
expect(await snapshot()).toEqual(beforeDisbursement);
const disbursementProposal = {
  conversationId,
  toolCallId: "disbursement",
  expenseId: createdExpense.data.expenseId,
  bankAccountId,
  referenceNumber: "AI-DISBURSE-FIXTURE",
};
const paid = await confirmAiDisburseExpenseProposal(disbursementProposal);
expect(paid).toMatchObject({ success: true, data: { alreadyConfirmed: false } });
const afterDisbursement = await snapshot();
const replayed = await confirmAiDisburseExpenseProposal(disbursementProposal);
expect(replayed).toMatchObject({ success: true, data: { alreadyConfirmed: true } });
if (!paid.success || !replayed.success) throw new Error("Disbursement replay failed");
expect(replayed.data.nextBalance).toBe(paid.data.nextBalance);
expect(await snapshot()).toEqual(afterDisbursement);

// Private proof ownership is validated on both save and direct submission.
const attachmentId = crypto.randomUUID();
await database.insert(schema.attachment).values({
  id: attachmentId,
  uploadedById: otherUserId,
  referenceType: "private_expense",
  referenceId: assignedProjectId,
  fileUrl: "https://ik.imagekit.io/test/private-proof.jpg",
  fileName: "proof.jpg",
  mimeType: "image/jpeg",
  fileSize: 10,
  storageFileId: "fixture-private",
});
const protectedUrl = `http://127.0.0.1:3000/api/media/attachments/${attachmentId}`;
const deniedProof = await submitFieldRequest({
  projectId: assignedProjectId,
  projectBudgetCategoryId: categoryId,
  description: "Forbidden proof fixture",
  quantity: 1,
  unitPrice: 10000,
  amount: 10000,
  stockHandling: "EXPENSE_ONLY",
  receiptImageUrl: protectedUrl,
});
expect(deniedProof.success).toBe(false);
const { saveExpenseDraftUseCase } =
  await import("@backend/server/usecases/finance/save-expense-draft");
const { resolveActor } = await import("@backend/server/actor");
const actor = await resolveActor();
if (!actor) throw new Error("Fixture actor missing");
const saved = await saveExpenseDraftUseCase(actor, {
  payload: {
    projectId: assignedProjectId,
    inputMode: "RECEIPT",
    receipt: {
      fileId: attachmentId,
      url: protectedUrl,
      fileName: "proof.jpg",
      mimeType: "image/jpeg",
      size: 10,
    },
    lines: [
      {
        key: "fixture",
        projectBudgetCategoryId: categoryId,
        projectBudgetItemId: "",
        materialId: "",
        projectRapItemId: "",
        projectCategoryPlanItemId: "",
        stockHandling: "EXPENSE_ONLY",
        inventoryLocationId: "",
        quantity: 1,
        unitPrice: 10000,
        amount: 10000,
        description: "Fixture",
      },
    ],
    ocrWarning: null,
  },
});
expect(saved).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
expect((await database.select().from(schema.formDraft)).length).toBe(0);
expect(
  (
    await database
      .select()
      .from(schema.aiProposalConfirmation)
      .where(
        and(
          eq(schema.aiProposalConfirmation.conversationId, conversationId),
          eq(schema.aiProposalConfirmation.userId, userId),
        ),
      )
  ).length,
).toBe(6);
await postgres.close();
console.log("Finance mutation safety checks passed");
