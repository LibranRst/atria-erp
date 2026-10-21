import { db } from "@backend/db";
import {
  notification,
  notificationCondition,
  approval,
  projectChangeOrder,
  goodsReceipt,
  stockCount,
  vendorBill,
  clientInvoice,
  materialInventory,
  projectBudgets,
  projectBudgetCategory,
  project,
  projectCost,
  projectRap,
  projectRapItem,
  stockMovement,
} from "@backend/db/schema";
import { INSTANCE_TENANT_ID } from "@backend/db/schema/tenant-constants";
import { and, eq, like, or } from "drizzle-orm";
import { dueStage } from "@atria/core/notifications/events";
import { resolveEffectiveProjectHealth } from "@atria/core/project/effective-health";
import { calculateUsedPercentage, getBudgetCategoryStatus } from "@atria/core/budget/excel-budget";
import { projectMaterialProjection } from "@atria/core/material/project-material-projection";
import { reconcileNotificationCondition } from "./notification-conditions";
import type { NotificationEvent } from "@atria/core/notifications/events";
import type { NotificationTransaction } from "./notification-events";

async function recoverAction(
  tx: NotificationTransaction,
  event: NotificationEvent,
  stage: string | null,
): Promise<boolean> {
  const family = `${event.referenceType}:${event.referenceId}`;
  const active = and(
    eq(notification.tenantId, INSTANCE_TENANT_ID),
    eq(notification.referenceType, event.referenceType),
    eq(notification.referenceId, event.referenceId),
    eq(notification.category, "ACTION_REQUIRED"),
    eq(notification.isResolved, false),
    or(
      like(notification.eventKey, `${family}:lifecycle:%`),
      like(notification.eventKey, `${family}:recovery:%`),
    ),
  );
  if (!stage)
    await tx
      .update(notification)
      .set({
        isResolved: true,
        resolvedAt: new Date(),
        read: true,
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(active);
  const existing = stage
    ? await tx.query.notification.findFirst({
        where: and(
          active,
          event.permission ? eq(notification.requiredPermission, event.permission) : undefined,
        ),
      })
    : null;
  if (existing) return false;
  return reconcileNotificationCondition(tx, { ...event, rule: "recovery" }, stage);
}
export async function reconcileVendorBillAction(
  tx: NotificationTransaction,
  billId: string,
): Promise<void> {
  const bill = await tx.query.vendorBill.findFirst({
    where: and(eq(vendorBill.id, billId), eq(vendorBill.tenantId, INSTANCE_TENANT_ID)),
    with: { payments: true },
  });
  if (!bill) return;
  const unallocated = ["VOID", "PAID"].includes(bill.status)
    ? 0
    : Number(bill.amount) -
      bill.payments
        .filter((payment) => ["COMPLETED", "PENDING", "PROCESSING"].includes(payment.status))
        .reduce((sum, payment) => sum + Number(payment.amountPaid), 0);
  await recoverAction(
    tx,
    {
      referenceType: "vendor_bill",
      referenceId: bill.id,
      projectId: bill.projectId,
      stage: "",
      title: "Tagihan vendor siap dijadwalkan",
      message: bill.billNumber,
      permission: "pay:vendor_bill",
      actionUrl: `/projects/${bill.projectId}?tab=expenses`,
    },
    unallocated > 0 ? "SCHEDULE" : null,
  );
}

export async function reconcileClientInvoiceAction(
  tx: NotificationTransaction,
  invoiceId: string,
): Promise<void> {
  const invoice = await tx.query.clientInvoice.findFirst({
    where: and(eq(clientInvoice.id, invoiceId), eq(clientInvoice.tenantId, INSTANCE_TENANT_ID)),
    with: { payments: true },
  });
  if (!invoice) return;
  const outstanding = ["VOID", "PAID"].includes(invoice.status)
    ? 0
    : Number(invoice.amount) -
      invoice.payments.reduce((sum, payment) => sum + Number(payment.amountPaid), 0);
  const stage = dueStage(invoice.dueDate, outstanding, new Date());
  await reconcileNotificationCondition(
    tx,
    {
      referenceType: "client_invoice",
      referenceId: invoice.id,
      projectId: invoice.projectId,
      rule: "due",
      stage: "",
      title:
        stage === "OVERDUE"
          ? "Invoice klien terlambat"
          : stage === "DUE"
            ? "Invoice klien jatuh tempo"
            : "Invoice klien mendekati jatuh tempo",
      message: invoice.invoiceNumber,
      permission: "reconcile:client_invoice",
      actionUrl: `/projects/${invoice.projectId}?tab=payments`,
      severity: stage === "OVERDUE" ? "CRITICAL" : "WARNING",
    },
    stage,
  );
}
export async function reconcileProjectNotifications(
  tx: NotificationTransaction,
  projectId: string,
  now: Date = new Date(),
): Promise<number> {
  const record = await tx.query.project.findFirst({
    where: and(eq(project.id, projectId), eq(project.tenantId, INSTANCE_TENANT_ID)),
  });
  if (!record) return 0;
  let changed = 0;
  let financialHealth = record.financialHealth;
  const bills = await tx.query.vendorBill.findMany({
    where: eq(vendorBill.projectId, projectId),
    with: { payments: true },
  });
  for (const bill of bills) {
    const outstanding = ["VOID", "PAID"].includes(bill.status)
      ? 0
      : Number(bill.amount) -
        bill.payments
          .filter((payment) => payment.status === "COMPLETED")
          .reduce((sum, payment) => sum + Number(payment.amountPaid), 0);
    const unallocated =
      outstanding -
      bill.payments
        .filter((payment) => payment.status === "PENDING" || payment.status === "PROCESSING")
        .reduce((sum, payment) => sum + Number(payment.amountPaid), 0);
    changed += Number(
      await recoverAction(
        tx,
        {
          referenceType: "vendor_bill",
          referenceId: bill.id,
          projectId,
          stage: "",
          title: "Tagihan vendor siap dijadwalkan",
          message: bill.billNumber,
          permission: "pay:vendor_bill",
          actionUrl: `/projects/${projectId}?tab=expenses`,
        },
        unallocated > 0 ? "SCHEDULE" : null,
      ),
    );
    const stage = dueStage(bill.dueDate, outstanding, now);
    changed += Number(
      await reconcileNotificationCondition(
        tx,
        {
          referenceType: "vendor_bill",
          referenceId: bill.id,
          projectId,
          rule: "due",
          stage: "",
          title:
            stage === "OVERDUE"
              ? "Tagihan vendor terlambat"
              : stage === "DUE"
                ? "Tagihan vendor jatuh tempo"
                : "Tagihan vendor mendekati jatuh tempo",
          message: bill.billNumber,
          permission: "pay:vendor_bill",
          actionUrl: `/projects/${projectId}?tab=budget`,
          severity: stage === "OVERDUE" ? "CRITICAL" : "WARNING",
        },
        stage,
      ),
    );
  }
  for (const bill of bills) {
    for (const payment of bill.payments) {
      const decision = await tx.query.approval.findFirst({
        where: and(
          eq(approval.referenceType, "vendor_payment"),
          eq(approval.referenceId, payment.id),
        ),
      });
      const stage =
        payment.status === "PENDING" && decision?.status !== "REJECTED"
          ? payment.requiresOwnerApproval && decision?.status !== "APPROVED"
            ? "APPROVAL"
            : "PAYMENT"
          : null;
      const permission = stage === "APPROVAL" ? "decide:all_approvals" : "pay:vendor_bill";
      const existing = await tx.query.notification.findFirst({
        where: and(
          eq(notification.referenceType, "vendor_payment"),
          eq(notification.referenceId, payment.id),
          eq(notification.category, "ACTION_REQUIRED"),
          eq(notification.isResolved, false),
          eq(notification.requiredPermission, permission),
        ),
      });
      if (stage && existing) continue;
      changed += Number(
        await reconcileNotificationCondition(
          tx,
          {
            referenceType: "vendor_payment",
            referenceId: payment.id,
            projectId,
            rule: "recovery",
            stage: "",
            title:
              stage === "APPROVAL"
                ? "Pembayaran vendor menunggu persetujuan"
                : "Pembayaran vendor siap diproses",
            message: bill.billNumber,
            permission,
            actionUrl: stage === "APPROVAL" ? "/approvals" : `/projects/${projectId}?tab=budget`,
          },
          stage,
        ),
      );
    }
  }
  const invoices = await tx.query.clientInvoice.findMany({
    where: eq(clientInvoice.projectId, projectId),
    with: { payments: true },
  });
  for (const invoice of invoices) {
    const outstanding = ["VOID", "PAID"].includes(invoice.status)
      ? 0
      : Number(invoice.amount) -
        invoice.payments.reduce((sum, payment) => sum + Number(payment.amountPaid), 0);
    const stage = dueStage(invoice.dueDate, outstanding, now);
    changed += Number(
      await reconcileNotificationCondition(
        tx,
        {
          referenceType: "client_invoice",
          referenceId: invoice.id,
          projectId,
          rule: "due",
          stage: "",
          title:
            stage === "OVERDUE"
              ? "Invoice klien terlambat"
              : stage === "DUE"
                ? "Invoice klien jatuh tempo"
                : "Invoice klien mendekati jatuh tempo",
          message: invoice.invoiceNumber,
          permission: "reconcile:client_invoice",
          actionUrl: `/projects/${projectId}?tab=invoices`,
          severity: stage === "OVERDUE" ? "CRITICAL" : "WARNING",
        },
        stage,
      ),
    );
  }
  const budgets = await tx.query.projectBudgets.findMany({
    where: eq(projectBudgets.projectId, projectId),
  });
  for (const budget of budgets) {
    const categories = await tx.query.projectBudgetCategory.findMany({
      where: eq(projectBudgetCategory.projectBudgetId, budget.id),
    });
    const actualCost = categories.reduce((sum, category) => sum + Number(category.actualAmount), 0);
    const contract = Number(budget.contractValue);
    const internal = Number(budget.internalBudget);
    financialHealth = resolveEffectiveProjectHealth({
      storedHealth: record.financialHealth,
      remainingBudget: internal - actualCost,
      usedPercentage: calculateUsedPercentage(actualCost, internal),
      categoryStatuses: categories.map((category) =>
        getBudgetCategoryStatus(Number(category.usedPercentage)),
      ),
      projectedMarginPercentage:
        contract > 0 ? ((contract - Math.max(actualCost, internal)) / contract) * 100 : 0,
      targetMarginPercentage: Number(budget.targetGrossPercentage),
    }).effectiveHealth;
    for (const category of categories) {
      const status = getBudgetCategoryStatus(Number(category.usedPercentage));
      changed += Number(
        await reconcileNotificationCondition(
          tx,
          {
            referenceType: "project_budget",
            referenceId: budget.id,
            projectId,
            rule: `category-${category.id}`,
            stage: "",
            title: "Anggaran kategori perlu perhatian",
            message: "Periksa penggunaan kategori dan sisa anggaran proyek.",
            permission: "view:budget",
            severity: status === "OVER_BUDGET" || status === "CRITICAL" ? "CRITICAL" : "WARNING",
            actionUrl: `/projects/${projectId}?tab=budget`,
          },
          status === "SAFE" || record.status !== "ACTIVE" ? null : status,
        ),
      );
    }
  }
  changed += Number(
    await reconcileNotificationCondition(
      tx,
      {
        referenceType: "project",
        referenceId: record.id,
        projectId,
        rule: "financial-health",
        stage: "",
        title: "Keuangan proyek perlu perhatian",
        message: "Periksa penggunaan budget kategori dan risiko margin proyek.",
        permission: "view:profitability",
        severity: financialHealth === "CRITICAL" ? "CRITICAL" : "WARNING",
        actionUrl: `/projects/${projectId}?tab=budget`,
      },
      record.status === "ACTIVE" && ["WARNING", "CRITICAL"].includes(financialHealth)
        ? financialHealth
        : null,
    ),
  );
  // Rebuild only currently actionable approvals during initial reconciliation.
  const costs = await tx.query.projectCost.findMany({
    where: eq(projectCost.projectId, projectId),
  });
  for (const cost of costs) {
    const stage = ["SUBMITTED", "VERIFIED", "APPROVED"].includes(cost.status) ? cost.status : null;
    changed += Number(
      await recoverAction(
        tx,
        {
          referenceType: "project_cost",
          referenceId: cost.id,
          projectId,
          rule: "recovery",
          stage: "",
          title:
            cost.status === "APPROVED"
              ? "Biaya siap dibayar"
              : cost.status === "VERIFIED"
                ? "Biaya menunggu persetujuan"
                : "Biaya menunggu verifikasi",
          message: cost.description,
          permission:
            cost.status === "APPROVED"
              ? "pay:cost"
              : cost.status === "VERIFIED"
                ? "decide:all_approvals"
                : "verify:cost",
          actionUrl: "/approvals",
        },
        stage,
      ),
    );
  }
  const changes = await tx.query.projectChangeOrder.findMany({
    where: eq(projectChangeOrder.projectId, projectId),
  });
  for (const change of changes)
    changed += Number(
      await recoverAction(
        tx,
        {
          referenceType: "change_order",
          referenceId: change.id,
          projectId,
          stage: "",
          title: "Perubahan proyek menunggu persetujuan",
          message: "Periksa perubahan rencana dan nilai proyek.",
          permission: "approve:rab",
          actionUrl: `/projects/${projectId}?tab=rab`,
        },
        change.status === "PENDING_APPROVAL" ? "PENDING_APPROVAL" : null,
      ),
    );
  const receipts = await tx.query.goodsReceipt.findMany({
    where: eq(goodsReceipt.projectId, projectId),
  });
  for (const receipt of receipts)
    changed += Number(
      await recoverAction(
        tx,
        {
          referenceType: "goods_receipt",
          referenceId: receipt.id,
          projectId,
          stage: "",
          title: "Pembatalan penerimaan menunggu persetujuan",
          message: "Periksa penerimaan material terkait.",
          permission: "approve:goods_receipt_reversal",
          actionUrl: "/materials",
        },
        receipt.status === "REVERSAL_REQUESTED" ? "REVERSAL_REQUESTED" : null,
      ),
    );
  const raps = await tx.query.projectRap.findMany({ where: eq(projectRap.projectId, projectId) });
  for (const rap of raps) {
    const items = await tx.query.projectRapItem.findMany({
      where: eq(projectRapItem.projectRapId, rap.id),
    });
    for (const item of items) {
      const movements = await tx.query.stockMovement.findMany({
        where: and(
          eq(stockMovement.projectId, projectId),
          eq(stockMovement.projectRapItemId, item.id),
        ),
      });
      const projection = projectMaterialProjection(movements, Number(item.totalQuantity));
      changed += Number(
        await reconcileNotificationCondition(
          tx,
          {
            referenceType: "rap",
            referenceId: rap.id,
            projectId,
            rule: `shortage-${item.id}`,
            stage: "",
            title: "Kebutuhan material belum terpenuhi",
            message: "Periksa rencana material dan stok yang sudah diamankan untuk proyek.",
            permission: "view:rap",
            actionUrl: `/projects/${projectId}?tab=materials`,
            severity: "WARNING",
          },
          record.status === "ACTIVE" && rap.status === "LOCKED" && projection.needToBuy > 0
            ? "SHORTAGE"
            : null,
        ),
      );
    }
  }
  return changed;
}
export async function runNotificationJob(
  now: Date = new Date(),
): Promise<{ skipped: boolean; changed: number }> {
  return db.transaction(async (tx) => {
    const [lock] = await tx
      .select()
      .from(notificationCondition)
      .where(
        and(
          eq(notificationCondition.tenantId, INSTANCE_TENANT_ID),
          eq(notificationCondition.key, "scheduler"),
        ),
      )
      .for("update", { skipLocked: true });
    if (!lock) return { skipped: true, changed: 0 };
    let changed = 0;
    const projects = await tx.query.project.findMany({
      where: eq(project.tenantId, INSTANCE_TENANT_ID),
    });
    for (const entry of projects) changed += await reconcileProjectNotifications(tx, entry.id, now);
    const counts = await tx.query.stockCount.findMany({
      where: eq(stockCount.tenantId, INSTANCE_TENANT_ID),
    });
    for (const count of counts)
      changed += Number(
        await recoverAction(
          tx,
          {
            referenceType: "stock_count",
            referenceId: count.id,
            stage: "",
            title: "Hitung stok menunggu persetujuan",
            message: "Periksa hasil penghitungan stok.",
            permission: "approve:stock_count",
            actionUrl: "/materials",
          },
          count.status === "PENDING_APPROVAL" ? "PENDING_APPROVAL" : null,
        ),
      );
    const inventory = await tx.query.materialInventory.findMany({
      where: eq(materialInventory.tenantId, INSTANCE_TENANT_ID),
      with: { material: true },
    });
    for (const entry of inventory) {
      const low =
        Number(entry.minimumStock) > 0 &&
        Number(entry.currentStock) - Number(entry.reservedStock) < Number(entry.minimumStock);
      changed += Number(
        await reconcileNotificationCondition(
          tx,
          {
            referenceType: "material",
            referenceId: entry.materialId,
            rule: `minimum-${entry.locationId}`,
            stage: "",
            title: "Stok material di bawah minimum",
            message: entry.material.name,
            permission: "create:stock_movement",
            actionUrl: "/materials",
            severity: "WARNING",
          },
          low ? "LOW" : null,
        ),
      );
    }
    await tx
      .update(notificationCondition)
      .set({ updatedAt: now })
      .where(eq(notificationCondition.id, lock.id));
    return { skipped: false, changed };
  });
}
