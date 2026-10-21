import { authorizedPrivateAttachment } from "../media/private-attachments";
import { and, eq, inArray, asc } from "drizzle-orm";
import { db } from "@backend/db";
import {
  projectCost,
  bankAccount,
  approval,
  cashTransaction,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { actorCan } from "@backend/lib/auth/permissions";
import type { Actor } from "@backend/server/actor";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { decideExpenseApproval } from "@atria/core/finance/expense-approval-rule";
import {
  expenseBatchActionInputSchema,
  expenseBatchActionPermissions,
  expenseBatchActionProposalSchema,
  EXPENSE_BATCH_ACTION_KIND,
  type ExpenseBatchActionInput,
  type ExpenseBatchActionProposal,
} from "@atria/core/ai/expense-batch";
import { readExpenseContext, expenseHash, type ExpenseReader } from "./expense-batch-context";
import { FinanceInputError } from "./finance-input-context";
export function assertExpenseActionRights(
  actor: Pick<Actor, "permissions" | "dataScope">,
  input: ExpenseBatchActionInput,
): void {
  if (
    !actorCan(actor, "use:ai_chat") ||
    !actorCan(actor, "view:project") ||
    !actorCan(actor, "view:cost") ||
    actor.dataScope === "NONE" ||
    expenseBatchActionPermissions(input.action).some((p) => !actorCan(actor, p))
  )
    throw new FinanceInputError(
      "FORBIDDEN",
      "Akses review atau tindakan pengeluaran tidak tersedia.",
    );
}
export async function prepareExpenseBatchAction(
  actor: Pick<Actor, "userId" | "permissions" | "dataScope">,
  raw: ExpenseBatchActionInput,
  reader: ExpenseReader = db,
): Promise<ExpenseBatchActionProposal> {
  const input = expenseBatchActionInputSchema.parse(raw);
  assertExpenseActionRights(actor, input);
  const c = await readExpenseContext(actor, input.projectId, reader);
  if (c.project.status !== "ACTIVE")
    throw new FinanceInputError("CONFLICT", "Pengeluaran hanya diproses pada proyek aktif.");
  const costs = await reader.query.projectCost.findMany({
    where: and(
      eq(projectCost.tenantId, INSTANCE_TENANT_ID),
      eq(projectCost.projectId, input.projectId),
      inArray(projectCost.id, input.costIds),
    ),
    with: { requestedBy: { columns: { name: true } } },
    orderBy: [asc(projectCost.id)],
  });
  if (costs.length !== input.costIds.length)
    throw new FinanceInputError(
      "FORBIDDEN",
      "Sebagian pengeluaran tidak tersedia dalam proyek ini.",
    );
  const approvals = await reader.query.approval.findMany({
    where: and(
      eq(approval.tenantId, INSTANCE_TENANT_ID),
      eq(approval.referenceType, "project_cost"),
      inArray(approval.referenceId, input.costIds),
    ),
    orderBy: [asc(approval.id)],
  });
  let account: typeof bankAccount.$inferSelect | null = null;
  if (input.action === "PAY")
    account =
      (await reader.query.bankAccount.findFirst({
        where: and(
          eq(bankAccount.id, input.bankAccountId!),
          eq(bankAccount.tenantId, INSTANCE_TENANT_ID),
          eq(bankAccount.isActive, true),
        ),
      })) ?? null;
  const total = costs.reduce((sum, x) => sum + Number(x.amount), 0);
  if (input.action === "PAY" && (!account || Number(account.balance) < total))
    throw new FinanceInputError(
      "CONFLICT",
      "Rekening tidak tersedia atau saldo tidak cukup untuk seluruh baris.",
    );
  if (input.action === "PAY") {
    const refs = input.references!.map((r) => r.referenceNumber);
    const duplicate = await reader.query.cashTransaction.findFirst({
      where: and(
        eq(cashTransaction.bankAccountId, input.bankAccountId!),
        inArray(cashTransaction.bankReference, refs),
      ),
    });
    if (duplicate)
      throw new FinanceInputError(
        "CONFLICT",
        "Referensi bank sudah tercatat. Periksa pembayaran sebelumnya.",
      );
  }
  const receipts = new Map<string, { url: string; fileName: string } | null>();
  const rows: ExpenseBatchActionProposal["rows"] = [];
  for (const cost of costs) {
    const expected =
      input.action === "VERIFY" ? "SUBMITTED" : input.action === "PAY" ? "APPROVED" : "VERIFIED";
    if (cost.status !== expected)
      throw new FinanceInputError(
        "CONFLICT",
        `Pengeluaran ${cost.description} harus ${formatBusinessLabel(expected)} sebelum tindakan ini.`,
      );
    if (input.action === "APPROVE" && cost.requestedById === actor.userId)
      throw new FinanceInputError(
        "FORBIDDEN",
        "Pengaju tidak dapat menyetujui sendiri melalui AI. Gunakan pemeriksa lain.",
      );
    const a = approvals.find((a) => a.referenceId === cost.id);
    if (
      input.action === "PAY" &&
      (cost.requiresOwnerApproval || cost.budgetOverrun) &&
      a?.status !== "APPROVED"
    )
      throw new FinanceInputError(
        "CONFLICT",
        "Persetujuan Owner belum lengkap untuk seluruh baris.",
      );
    const category = c.categories.find((x) => x.id === cost.projectBudgetCategoryId);
    if (!category) throw new FinanceInputError("CONFLICT", "Kategori pengeluaran tidak tersedia.");
    const overrun = decideExpenseApproval({
      amount: Number(cost.amount),
      allocatedAmount: Number(category.allocatedAmount),
      actualAmount: Number(category.actualAmount),
      otherPendingAmount: Math.max(0, Number(category.pendingAmount) - Number(cost.amount)),
    }).isOverrun;
    const after =
      input.action === "VERIFY"
        ? cost.requiresOwnerApproval || cost.budgetOverrun || overrun
          ? "VERIFIED"
          : "APPROVED"
        : input.action === "PAY"
          ? "PAID"
          : input.action === "APPROVE"
            ? "APPROVED"
            : "REJECTED";
    let receipt: { url: string; fileName: string } | null = null;
    if (cost.receiptImageUrl) {
      if (!receipts.has(cost.receiptImageUrl)) {
        try {
          const proof = await authorizedPrivateAttachment(
            actor,
            cost.receiptImageUrl,
            "expense",
            reader,
          );
          receipts.set(cost.receiptImageUrl, {
            url: cost.receiptImageUrl,
            fileName: proof.fileName,
          });
        } catch {
          receipts.set(cost.receiptImageUrl, null);
        }
      }
      receipt = receipts.get(cost.receiptImageUrl) ?? null;
    }
    rows.push({
      id: cost.id,
      title: cost.description,
      receipt,
      facts: [
        { label: "Pengaju", value: cost.requestedBy.name, money: false },
        { label: "Jumlah", value: Number(cost.quantity), money: false },
        { label: "Harga satuan", value: Number(cost.unitPrice), money: true },
        { label: "Kategori", value: category.expenseCategory.name, money: false },
        { label: "Nominal", value: Number(cost.amount), money: true },
        { label: "Status saat ini", value: formatBusinessLabel(cost.status), money: false },
        { label: "Setelah tindakan", value: formatBusinessLabel(after), money: false },
        ...(input.action === "PAY"
          ? [
              {
                label: "Referensi bank",
                value: input.references!.find((r) => r.costId === cost.id)!.referenceNumber,
                money: false,
              },
            ]
          : []),
      ],
    });
  }
  const summary: ExpenseBatchActionProposal["summary"] = [
    { label: "Baris diproses", value: costs.length, money: false },
    { label: "Total nominal", value: total, money: true },
    ...(input.notes ? [{ label: "Alasan keputusan", value: input.notes, money: false }] : []),
  ];
  if (account)
    summary.push(
      { label: "Rekening", value: `${account.bankName} · ${account.name}`, money: false },
      { label: "Saldo sebelum", value: Number(account.balance), money: true },
      { label: "Saldo setelah", value: Number(account.balance) - total, money: true },
    );
  return expenseBatchActionProposalSchema.parse({
    kind: EXPENSE_BATCH_ACTION_KIND,
    input,
    title: {
      VERIFY: "Verifikasi pengeluaran",
      APPROVE: "Persetujuan pengeluaran",
      REJECT: "Penolakan pengeluaran",
      PAY: "Pembayaran pengeluaran",
    }[input.action],
    projectName: c.project.name,
    expectedContext: expenseHash({
      project: c.project,
      costs,
      approvals,
      categories: c.categories,
      account,
    }),
    effect:
      input.action === "PAY"
        ? "Konfirmasi mencatat seluruh pencairan terpilih dan mengurangi saldo kas. Ini pencatatan Atria, bukan transfer ke bank; stok tetap."
        : "Seluruh baris diproses dalam satu transaksi. Verifikasi/keputusan tidak mencairkan kas dan tidak mengulangi pergerakan stok saat submit.",
    rows,
    summary,
    budget: actorCan(actor, "view:budget")
      ? c.categories
          .filter((cat) => costs.some((cost) => cost.projectBudgetCategoryId === cat.id))
          .map((cat) => ({
            name: cat.expenseCategory.name,
            allocated: Number(cat.allocatedAmount),
            actual: Number(cat.actualAmount),
            pending: Number(cat.pendingAmount),
          }))
      : [],
  });
}
