import { and, asc, eq, inArray, ne } from "drizzle-orm";
import {
  INSTANCE_TENANT_ID,
  vendorBill,
  vendorPayment,
  stockMovement,
  projectExpenses,
  projectBudgetCategory,
  vendor,
  auditLog,
  expenseCategory,
  projectBudgets,
} from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import { assertProjectStatusIsOperational } from "@backend/lib/auth/scoping";
import { syncProjectBudgetCategory } from "@backend/lib/budget/budget-sync";
import { parseNumericToCents } from "@atria/core/finance/money-minor";
import {
  vendorBillCorrectionInputSchema,
  type VendorBillCorrectionInput,
} from "@atria/core/ai/procurement-warehouse";
import { lockFinanceProject, type FinanceTransaction } from "./mutation-access";

export class VendorBillCorrectionError extends Error {
  constructor(
    readonly code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR",
    message: string,
  ) {
    super(message);
  }
}
export function assertVendorBillCorrectionRights(actor: Actor): void {
  if (
    !actor.isActive ||
    actor.dataScope === "NONE" ||
    !actorCan(actor, "view:vendor_bill") ||
    !actorCan(actor, "update:vendor_bill")
  )
    throw new VendorBillCorrectionError(
      "FORBIDDEN",
      "Akses baca dan koreksi tagihan vendor diperlukan.",
    );
}
export function vendorBillCorrectionBlocked(status: string, projectStatus: string): string | null {
  if (status === "VOID") return "Tagihan dibatalkan tidak dapat dikoreksi.";
  if (!["UNPAID", "OVERDUE", "PARTIALLY_PAID", "PAID"].includes(status))
    return "Status tagihan ini tidak mengizinkan koreksi.";
  try {
    assertProjectStatusIsOperational(projectStatus);
    return null;
  } catch {
    return "Proyek sudah terkunci atau tidak operasional. Koreksi tagihan belum dapat disimpan.";
  }
}
export async function readVendorBillCorrectionSourceTx(
  tx: FinanceTransaction,
  actor: Actor,
  billId: string,
): Promise<{
  bill: typeof vendorBill.$inferSelect;
  project: Awaited<ReturnType<typeof lockFinanceProject>>;
  supplier: typeof vendor.$inferSelect;
  category: typeof projectBudgetCategory.$inferSelect & {
    expenseCategory: typeof expenseCategory.$inferSelect;
    budget: typeof projectBudgets.$inferSelect;
  };
  expenses: (typeof projectExpenses.$inferSelect)[];
  payments: (typeof vendorPayment.$inferSelect)[];
  movements: (typeof stockMovement.$inferSelect)[];
  completed: number;
  scheduled: number;
  received: number;
  amountBlocked: string | null;
}> {
  assertVendorBillCorrectionRights(actor);
  const [bill] = await tx
    .select()
    .from(vendorBill)
    .where(and(eq(vendorBill.id, billId), eq(vendorBill.tenantId, INSTANCE_TENANT_ID)))
    .for("update");
  if (!bill)
    throw new VendorBillCorrectionError(
      "NOT_FOUND",
      "Tagihan vendor tidak ditemukan dalam akses Anda.",
    );
  const proj = await lockFinanceProject(tx, actor, bill.projectId);
  if (proj.tenantId !== INSTANCE_TENANT_ID)
    throw new VendorBillCorrectionError("FORBIDDEN", "Proyek di luar tenant aktif.");
  const [supplier] = await tx
    .select()
    .from(vendor)
    .where(and(eq(vendor.id, bill.vendorId), eq(vendor.tenantId, INSTANCE_TENANT_ID)))
    .for("update");
  const category = await tx.query.projectBudgetCategory.findFirst({
    where: and(
      eq(projectBudgetCategory.id, bill.projectBudgetCategoryId),
      eq(projectBudgetCategory.tenantId, INSTANCE_TENANT_ID),
    ),
    with: { budget: true, expenseCategory: true },
  });
  if (
    !supplier ||
    !category ||
    category.budget.projectId !== bill.projectId ||
    category.budget.tenantId !== INSTANCE_TENANT_ID
  )
    throw new VendorBillCorrectionError(
      "CONFLICT",
      "Sumber vendor atau kategori tagihan tidak konsisten. Periksa modul pengeluaran.",
    );
  const expenses = await tx.query.projectExpenses.findMany({
    where: eq(projectExpenses.vendorBillId, bill.id),
    orderBy: [asc(projectExpenses.id)],
  });
  const payments = await tx.query.vendorPayment.findMany({
    where: eq(vendorPayment.vendorBillId, bill.id),
    orderBy: [asc(vendorPayment.id)],
  });
  const movements = await tx.query.stockMovement.findMany({
    where: and(
      eq(stockMovement.vendorBillId, bill.id),
      inArray(stockMovement.movementType, [
        "GOODS_RECEIPT",
        "GOODS_RECEIPT_REVERSAL",
        "STOCK_IN",
        "IN",
      ]),
    ),
    orderBy: [asc(stockMovement.id)],
  });
  if (
    expenses.some((e) => e.tenantId !== INSTANCE_TENANT_ID || e.projectId !== bill.projectId) ||
    payments.some((p) => p.tenantId !== INSTANCE_TENANT_ID) ||
    movements.some((m) => m.tenantId !== INSTANCE_TENANT_ID || m.projectId !== bill.projectId)
  )
    throw new VendorBillCorrectionError(
      "CONFLICT",
      "Relasi pembayaran, penerimaan atau pengeluaran tidak konsisten.",
    );
  const sumPayment = (status: string): number =>
    Number(
      payments
        .filter((p) => p.status === status)
        .reduce((sum, p) => sum + parseNumericToCents(p.amountPaid), 0n),
    ) / 100;
  const completed = sumPayment("COMPLETED");
  const scheduled =
    Number(
      payments
        .filter((p) => ["PENDING", "PROCESSING"].includes(p.status))
        .reduce((sum, p) => sum + parseNumericToCents(p.amountPaid), 0n),
    ) / 100;
  const rawReceived = movements.reduce(
    (sum, m) =>
      sum +
      (m.movementType === "GOODS_RECEIPT_REVERSAL" ? -1n : 1n) *
        parseNumericToCents(m.quantity) *
        parseNumericToCents(m.unitCost),
    0n,
  );
  if (rawReceived < 0n)
    throw new VendorBillCorrectionError("CONFLICT", "Nilai penerimaan bersih tidak konsisten.");
  const received = Number((rawReceived + 50n) / 100n) / 100;
  const canonical = expenses.filter((e) =>
    ["VENDOR_BILL", "INVENTORY_PURCHASE"].includes(e.sourceType),
  );
  const source = canonical[0];
  const material = category.expenseCategory.code === "MATERIAL";
  const consistent =
    canonical.length === 1 &&
    source &&
    source.projectBudgetCategoryId === bill.projectBudgetCategoryId &&
    source.projectBudgetId === category.projectBudgetId &&
    source.expenseCategoryId === category.expenseCategoryId &&
    source.vendorId === bill.vendorId &&
    source.materialId === bill.materialId &&
    source.projectRapItemId === bill.projectRapItemId &&
    source.projectCategoryPlanItemId === bill.projectCategoryPlanItemId &&
    Number(source.quantity) === 1 &&
    source.amount === bill.amount &&
    source.unitCost === bill.amount &&
    source.isCashImpact &&
    !source.legacyProjectCostId &&
    !source.stockMovementId &&
    source.sourceType === (material ? "INVENTORY_PURCHASE" : "VENDOR_BILL") &&
    source.status === (material ? "INVENTORY_ASSET" : "APPROVED");
  const amountBlocked =
    bill.status === "VOID"
      ? "Tagihan dibatalkan tidak dapat dikoreksi."
      : bill.status === "PAID"
        ? "Nominal tagihan lunas terkunci. Buat tagihan tambahan untuk biaya baru."
        : bill.status === "PARTIALLY_PAID" && (completed <= 0 || completed >= Number(bill.amount))
          ? "Riwayat pembayaran sebagian belum konsisten. Periksa pembayaran di modul pengeluaran sebelum mengoreksi nominal."
          : payments.some((p) => ["PENDING", "PROCESSING"].includes(p.status))
            ? "Masih ada jadwal pembayaran aktif. Putuskan atau batalkan jadwal sebelum mengoreksi nominal."
            : !consistent
              ? "Sumber pengeluaran tagihan belum konsisten untuk koreksi nominal. Periksa modul pengeluaran."
              : null;
  return {
    bill,
    project: proj,
    supplier,
    category,
    expenses,
    payments,
    movements,
    completed,
    scheduled,
    received,
    amountBlocked,
  };
}
export async function prepareVendorBillCorrectionTx(
  tx: FinanceTransaction,
  actor: Actor,
  raw: VendorBillCorrectionInput,
): Promise<{
  input: VendorBillCorrectionInput;
  source: Awaited<ReturnType<typeof readVendorBillCorrectionSourceTx>>;
  after: {
    billNumber: string;
    amount: string;
    dueDate: Date;
    notes: string | null;
    status: string;
  };
  amountChanged: boolean;
}> {
  const input = vendorBillCorrectionInputSchema.parse(raw);
  const source = await readVendorBillCorrectionSourceTx(tx, actor, input.vendorBillId);
  const blocked = vendorBillCorrectionBlocked(source.bill.status, source.project.status);
  if (blocked) throw new VendorBillCorrectionError("CONFLICT", blocked);
  const after = {
    billNumber: input.patch.billNumber ?? source.bill.billNumber,
    amount: input.patch.amount?.toFixed(2) ?? source.bill.amount,
    dueDate: input.patch.dueDate
      ? new Date(input.patch.dueDate + "T00:00:00Z")
      : source.bill.dueDate,
    notes: input.patch.notes === undefined ? source.bill.notes : input.patch.notes || null,
    status: source.bill.status,
  };
  const amountChanged =
    parseNumericToCents(after.amount) !== parseNumericToCents(source.bill.amount);
  if (amountChanged) {
    if (source.amountBlocked) throw new VendorBillCorrectionError("CONFLICT", source.amountBlocked);
    if (
      parseNumericToCents(after.amount) < parseNumericToCents(source.completed.toFixed(2)) ||
      parseNumericToCents(after.amount) < parseNumericToCents(source.received.toFixed(2))
    )
      throw new VendorBillCorrectionError(
        "CONFLICT",
        "Nominal baru tidak boleh lebih kecil dari pembayaran selesai atau nilai penerimaan bersih. Periksa rinciannya dan ajukan koreksi lain.",
      );
    after.status =
      source.completed === Number(after.amount)
        ? "PAID"
        : source.completed > 0
          ? "PARTIALLY_PAID"
          : source.bill.status === "OVERDUE"
            ? "OVERDUE"
            : "UNPAID";
  }
  if (
    after.billNumber === source.bill.billNumber &&
    after.amount === source.bill.amount &&
    after.dueDate.getTime() === source.bill.dueDate.getTime() &&
    after.notes === source.bill.notes
  )
    throw new VendorBillCorrectionError(
      "VALIDATION_ERROR",
      "Tidak ada perubahan pada tagihan. Sebutkan bagian yang ingin dikoreksi.",
    );
  const duplicate = await tx.query.vendorBill.findFirst({
    where: and(
      eq(vendorBill.tenantId, INSTANCE_TENANT_ID),
      eq(vendorBill.billNumber, after.billNumber),
      ne(vendorBill.id, source.bill.id),
    ),
  });
  if (duplicate)
    throw new VendorBillCorrectionError(
      "CONFLICT",
      "Nomor tagihan sudah digunakan. Pilih nomor lain.",
    );
  return { input, source, after, amountChanged };
}
export async function correctVendorBillTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: VendorBillCorrectionInput,
): Promise<typeof vendorBill.$inferSelect> {
  const { source, after, amountChanged } = await prepareVendorBillCorrectionTx(tx, actor, input);
  const [updated] = await tx
    .update(vendorBill)
    .set({ ...after, updatedAt: new Date() })
    .where(eq(vendorBill.id, source.bill.id))
    .returning();
  if (amountChanged) {
    const expense = source.expenses.find((e) =>
      ["VENDOR_BILL", "INVENTORY_PURCHASE"].includes(e.sourceType),
    );
    if (!expense)
      throw new VendorBillCorrectionError("CONFLICT", "Pengeluaran sumber tidak tersedia.");
    await tx
      .update(projectExpenses)
      .set({
        amount: after.amount,
        unitCost: after.amount,
        paymentStatus: after.status === "OVERDUE" ? "UNPAID" : after.status,
        updatedAt: new Date(),
      })
      .where(eq(projectExpenses.id, expense.id));
    await syncProjectBudgetCategory({
      tx,
      projectBudgetCategoryId: source.bill.projectBudgetCategoryId,
    });
  }
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "CORRECT_VENDOR_BILL",
    targetTable: "vendor_bill",
    targetId: source.bill.id,
    originalState: JSON.stringify({ bill: source.bill, expenses: source.expenses }),
    newState: JSON.stringify({
      bill: updated,
      reason: input.reason,
      amountChanged,
      completedPayments: source.completed,
      netReceipts: source.received,
    }),
  });
  return updated;
}
