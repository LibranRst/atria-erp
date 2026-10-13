import { eq, inArray } from "drizzle-orm";
import type { db } from "@backend/db";
import {
  project,
  projectBudgets,
  projectBudgetCategory,
  projectCategoryPlanItem,
  projectRap,
  projectRapItem,
  rabEstimate,
  rabEstimateBundle,
  rabEstimateItem,
  projectProfitabilitySnapshot,
  clientInvoice,
  clientPayment,
  projectExpenses,
  vendorBill,
  vendorPayment,
  stockMovement,
  auditLog,
} from "../schema";
import {
  calculateRabBudgetDerivation,
  calculateUsedPercentage,
} from "@atria/core/budget/excel-budget";
import { syncProjectBudgetCategories } from "@backend/lib/budget/budget-sync";
import { buildDevelopmentPlanningDataset } from "./demo-project-planning";
import { seedDevelopmentSupport } from "./development-support";
import { verifyDevelopmentDataset } from "./development-validation";
import { DEMO_IDS, type DemoClock } from "./demo-contract";

type SeedTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function refreshDevelopmentSnapshots(tx: SeedTx, clock: DemoClock): Promise<void> {
  const budgets = await tx.select().from(projectBudgets);
  const categories = await tx.select().from(projectBudgetCategory);
  const invoices = await tx.select().from(clientInvoice);
  const payments = await tx.select().from(clientPayment);
  const movements = await tx.select().from(stockMovement);
  const raps = await tx.select().from(projectRap);
  const items = await tx.select().from(projectRapItem);
  const projects = await tx.select().from(project);
  // Replace the just-created demo snapshot with the enriched development baseline.
  await tx.delete(projectProfitabilitySnapshot);
  for (const budget of budgets) {
    const ownCategories = categories.filter((r) => r.projectBudgetId === budget.id);
    const actual = ownCategories.reduce((sum, r) => sum + Number(r.actualAmount), 0);
    const paid = ownCategories.reduce((sum, r) => sum + Number(r.paidAmount), 0);
    const ownInvoices = invoices.filter((r) => r.projectId === budget.projectId);
    const receipts = payments
      .filter((r) => ownInvoices.some((i) => i.id === r.clientInvoiceId))
      .reduce((sum, r) => sum + Number(r.amountPaid), 0);
    const material = ownCategories.find(
      (r) => r.expenseCategoryId === "31313131-3131-3131-3131-313131313102",
    );
    const materialApplied = movements
      .filter((r) => r.projectId === budget.projectId)
      .reduce((sum, r) => {
        const value = Number(r.quantity) * Number(r.unitCost);
        return (
          sum +
          (["USE", "WASTE"].includes(r.movementType)
            ? value
            : r.movementType === "RETURN"
              ? -value
              : 0)
        );
      }, 0);
    const latestRap = raps
      .filter((r) => r.projectId === budget.projectId)
      .sort((a, b) => b.revision - a.revision)[0];
    const shortage = items
      .filter((r) => r.projectRapId === latestRap?.id && r.status === "SHORTAGE")
      .reduce((sum, r) => sum + Number(r.estimatedTotalCost), 0);
    const contract = Number(budget.contractValue);
    const cap = Number(budget.internalBudget);
    const completed = projects.find((r) => r.id === budget.projectId)?.status === "COMPLETED";
    const forecast =
      completed || budget.projectProgressPercentage === "100.0000" ? actual : Math.max(actual, cap);
    const risk = ownCategories.some((r) => r.status === "CRITICAL")
      ? "CRITICAL"
      : ownCategories.some((r) => r.status === "WARNING")
        ? "WARNING"
        : "SAFE";
    await tx.insert(projectProfitabilitySnapshot).values({
      projectId: budget.projectId,
      projectBudgetId: budget.id,
      contractValue: budget.contractValue,
      approvedRabValue: budget.approvedRabValue,
      internalBudget: budget.internalBudget,
      actualCost: actual.toFixed(2),
      remainingBudget: (cap - actual).toFixed(2),
      budgetUsedPercentage: calculateUsedPercentage(actual, cap).toFixed(4),
      targetGrossAmount: budget.targetGrossAmount,
      targetGrossPercentage: budget.targetGrossPercentage,
      projectedFinalCost: forecast.toFixed(2),
      projectedMarginAmount: (contract - forecast).toFixed(2),
      projectedMarginPercentage: (contract > 0
        ? ((contract - forecast) / contract) * 100
        : 0
      ).toFixed(4),
      realizedMarginAmount: (contract - actual).toFixed(2),
      realizedMarginPercentage: (contract > 0 ? ((contract - actual) / contract) * 100 : 0).toFixed(
        4,
      ),
      cashPosition: (receipts - paid).toFixed(2),
      snapshotType: completed ? "CLOSING" : "PERIODIC",
      materialBudget: material?.allocatedAmount ?? "0.00",
      materialActual: material?.actualAmount ?? "0.00",
      materialRemaining: material?.remainingAmount ?? "0.00",
      materialUsedPercentage: material?.usedPercentage ?? "0.0000",
      materialStockValueApplied: materialApplied.toFixed(2),
      materialShortageValue: shortage.toFixed(2),
      riskStatus: risk,
      snapshotAt: clock.day(0),
      createdAt: clock.day(0),
    });
  }
}

/** Only called while creating an empty sandbox, inside the connected seed transaction. */
export async function seedDevelopmentDataset(tx: SeedTx, clock: DemoClock): Promise<void> {
  console.log("Seeding detailed development planning and operational history...");
  const planning = buildDevelopmentPlanningDataset(clock);
  for (const update of planning.projectUpdates)
    await tx.update(project).set(update.values).where(eq(project.id, update.id));
  if (planning.newBudgets.length) await tx.insert(projectBudgets).values(planning.newBudgets);
  if (planning.newBudgetCategories.length)
    await tx.insert(projectBudgetCategory).values(planning.newBudgetCategories);
  for (const row of planning.projectRaps)
    await tx.insert(projectRap).values(row).onConflictDoUpdate({ target: projectRap.id, set: row });
  for (const row of planning.rapItems)
    await tx
      .insert(projectRapItem)
      .values(row)
      .onConflictDoUpdate({ target: projectRapItem.id, set: row });
  for (const row of planning.categoryPlanItems)
    await tx
      .insert(projectCategoryPlanItem)
      .values(row)
      .onConflictDoUpdate({ target: projectCategoryPlanItem.id, set: row });
  for (const row of planning.rabEstimates)
    await tx
      .insert(rabEstimate)
      .values(row)
      .onConflictDoUpdate({ target: rabEstimate.id, set: row });
  await tx
    .delete(rabEstimateItem)
    .where(inArray(rabEstimateItem.rabEstimateId, planning.replaceRabEstimateIds));
  await tx
    .delete(rabEstimateBundle)
    .where(inArray(rabEstimateBundle.rabEstimateId, planning.replaceRabEstimateIds));
  if (planning.rabBundles.length) await tx.insert(rabEstimateBundle).values(planning.rabBundles);
  if (planning.rabItems.length) await tx.insert(rabEstimateItem).values(planning.rabItems);
  for (const update of planning.categoryAllocationUpdates)
    await tx
      .update(projectBudgetCategory)
      .set(update)
      .where(eq(projectBudgetCategory.id, update.id));
  // Approved client service fees are excluded from the production budget, exactly
  // as the ordinary approve-RAB workflow derives them.
  for (const rab of planning.rabEstimates.filter((r) => r.status === "APPROVED")) {
    const derivation = calculateRabBudgetDerivation({
      items: planning.rabItems
        .filter((r) => r.rabEstimateId === rab.id)
        .map((r) => ({
          ...r,
          isHidden: r.isHidden ?? false,
          itemNature: r.itemNature ?? "PRODUCTION",
          bundleId: r.bundleId ?? null,
        })),
      bundles: planning.rabBundles
        .filter((r) => r.rabEstimateId === rab.id)
        .map((r) => {
          if (!r.id) throw new Error("DEVELOPMENT_BUNDLE_ID_MISSING");
          return { ...r, id: r.id, isHidden: r.isHidden ?? false };
        }),
      budgetCapRatio: 0.9,
    });
    await tx
      .update(projectBudgets)
      .set({
        internalBudget: derivation.internalBudget.toFixed(2),
        approvedRabValue: derivation.approvedValue.toFixed(2),
        targetGrossAmount: derivation.targetGrossAmount.toFixed(2),
        targetGrossPercentage: derivation.targetGrossPercentage.toFixed(4),
      })
      .where(eq(projectBudgets.projectId, rab.projectId));
  }
  await seedDevelopmentSupport(tx, clock);
  const bills = await tx.select().from(vendorBill);
  const payments = await tx.select().from(vendorPayment);
  const expenses = await tx.select().from(projectExpenses);
  for (const expense of expenses.filter((row) => row.vendorBillId)) {
    const bill = bills.find((row) => row.id === expense.vendorBillId);
    if (!bill) throw new Error(`DEVELOPMENT_EXPENSE_BILL_MISSING:${expense.id}`);
    const paid = payments
      .filter((row) => row.vendorBillId === bill.id && row.status === "COMPLETED")
      .reduce((sum, row) => sum + Number(row.amountPaid), 0);
    await tx
      .update(projectExpenses)
      .set({
        sourceType: "VENDOR_BILL",
        vendorId: bill.vendorId,
        paymentStatus:
          paid <= 0 ? "UNPAID" : paid >= Number(expense.amount) ? "PAID" : "PARTIALLY_PAID",
      })
      .where(eq(projectExpenses.id, expense.id));
  }
  const categories = await tx.select().from(projectBudgetCategory);
  await syncProjectBudgetCategories({ tx, projectBudgetCategoryIds: categories.map((r) => r.id) });
  // The development baseline uses saved project-specific allocation overrides;
  // Settings defaults remain the source for subsequent projects.
  await refreshDevelopmentSnapshots(tx, clock);
  await tx.insert(auditLog).values({
    userId: DEMO_IDS.users.owner,
    action: "SEED_DEVELOPMENT_DATASET",
    targetTable: "project",
    targetId: DEMO_IDS.projects.menteng,
    newState: JSON.stringify({
      anchorDate: clock.anchorDate,
      profile: "development",
      scenarios: planning.scenarios,
    }),
    createdAt: clock.day(0),
  });
  const report = await verifyDevelopmentDataset(tx);
  console.log(JSON.stringify(report, null, 2));
}
