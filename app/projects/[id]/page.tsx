import { db } from "@/db";
import { materialMaster, project, projectExpenses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { resolveRoleName } from "@/lib/auth/permissions";
import { assertProjectAccess } from "@/lib/auth/scoping";
import { Badge } from "@/components/ui/badge";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import React from "react";
import { ClientInvoiceItem, ProjectInvoices } from "@/components/project/project-invoices";
import {
  RapRabManager,
  type MaterialOption,
  type ProjectCategoryPlanItemView,
  type ProjectPlanBudgetCategory,
  type RabEstimateView,
  type RapView,
  type VendorOption,
} from "@/components/project/rap-rab-manager";
import { getProjectBudgetDashboard } from "@/app/actions/project/excel-budget";

interface PageProps {
  params: Promise<{ id: string }>;
}

function toClientInvoiceStatus(status: string): ClientInvoiceItem["status"] {
  switch (status) {
    case "UNPAID":
    case "PARTIALLY_PAID":
    case "PAID":
    case "OVERDUE":
    case "VOID":
      return status;
    default:
      throw new Error(`Status invoice klien tidak dikenal: ${status}`);
  }
}

export default async function ProjectDetailPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id: projectId } = await params;

  // 1. Get session
  const session = await auth.api.getSession({
    headers: {
      cookie: (await (await import("next/headers")).cookies()).toString(),
    },
  });

  if (!session || !session.user) {
    redirect("/login");
  }

  // 2. Resolve role and enforce scoping
  const roleName = await resolveRoleName(session.user.roleId);
  try {
    await assertProjectAccess(projectId, session.user.id, roleName);
  } catch {
    redirect("/projects");
  }

  // 3. Query project, budget, items, invoices, and payments
  const proj = await db.query.project.findFirst({
    where: eq(project.id, projectId),
    with: {
      client: true,
      projectManager: true,
      clientInvoices: {
        with: {
          payments: true,
        },
      },
      budget: {
        with: {
          items: {
            with: {
              costCategory: true,
            },
          },
        },
      },
      raps: {
        with: {
          items: {
            with: {
              material: {
                with: {
                  inventory: true,
                },
              },
              stockMovements: true,
            },
          },
        },
      },
      rabEstimates: {
        with: {
          items: true,
        },
      },
      categoryPlanItems: {
        with: {
          expenseCategory: true,
          vendor: true,
        },
      },
    },
  });

  if (!proj) {
    notFound();
  }

  const projectBudgetDashboardResult = await getProjectBudgetDashboard(projectId);
  const projectBudgetDashboard = projectBudgetDashboardResult.success ? projectBudgetDashboardResult.data : null;

  // 4. Kueri daftar rekening bank
  const bankAccountsData = await db.query.bankAccount.findMany();

  const materialOptionsData = await db.query.materialMaster.findMany({
    where: eq(materialMaster.isActive, true),
    with: {
      category: true,
      inventory: true,
    },
  });
  const vendorsData = await db.query.vendor.findMany({
    orderBy: (table, { asc }) => [asc(table.name)],
  });
  const projectMaterialExpenses = await db.query.projectExpenses.findMany({
    where: eq(projectExpenses.projectId, projectId),
  });

  const budget = proj.budget;
  const budgetItems = budget?.items || [];

  // Calculate aggregated budget statistics
  let totalAllocated = 0;
  let totalSpent = 0;

  budgetItems.forEach((item) => {
    totalAllocated += Number(item.allocatedAmount);
    totalSpent += Number(item.actualSpent);
  });

  const totalRemaining = totalAllocated - totalSpent;
  const totalUtilization = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;
  const financialHealth = proj.financialHealth as "HEALTHY" | "WARNING" | "CRITICAL";

  // Calculate total client payments received
  let totalReceived = 0;
  proj.clientInvoices?.forEach((inv) => {
    inv.payments?.forEach((pay) => {
      totalReceived += Number(pay.amountPaid);
    });
  });

  const contractValue = Number(proj.totalContractValue);
  const projectedGrossProfit = contractValue - totalAllocated;
  const projectedGrossMargin = contractValue > 0 ? (projectedGrossProfit / contractValue) * 100 : 0;
  const realizedNetProfit = totalReceived - totalSpent;
  const activeRap = proj.raps.slice().sort((a, b) => b.revision - a.revision)[0] ?? null;
  const latestRabEstimate = proj.rabEstimates.slice().sort((a, b) => b.revision - a.revision)[0] ?? null;
  const materialOptions: MaterialOption[] = materialOptionsData.map((material) => {
    const availableStock = material.inventory.reduce((sum, inventory) => {
      return sum + Number(inventory.currentStock) - Number(inventory.reservedStock);
    }, 0);
    const lastPurchasePrice = material.inventory.find((inventory) => Number(inventory.lastPurchasePrice) > 0)?.lastPurchasePrice ?? "0.00";
    return {
      id: material.id,
      name: material.name,
      unit: material.unit,
      lastPurchasePrice,
      availableStock,
      categoryName: material.category?.name ?? "-",
    };
  });
  const vendorOptions: VendorOption[] = vendorsData.map((item) => ({
    id: item.id,
    name: item.name,
  }));
  const planBudgetCategories: ProjectPlanBudgetCategory[] = projectBudgetDashboard?.categories
    .filter((category) => category.code === "TUKANG" || category.code === "SUBCON")
    .map((category) => ({
      id: category.id,
      code: category.code,
      name: category.name,
    })) ?? [];
  const categoryPlanItemsForManager: ProjectCategoryPlanItemView[] = proj.categoryPlanItems.map((item) => {
    const actualCost = projectMaterialExpenses
      .filter((expense) => expense.projectCategoryPlanItemId === item.id && ["APPROVED", "PAID"].includes(expense.status))
      .reduce((sum, expense) => sum + Number(expense.amount), 0);
    return {
      id: item.id,
      projectBudgetCategoryId: item.projectBudgetCategoryId,
      expenseCategoryCode: item.expenseCategory.code,
      expenseCategoryName: item.expenseCategory.name,
      vendorId: item.vendorId,
      vendorName: item.vendor?.name ?? null,
      name: item.name,
      scopeDescription: item.scopeDescription,
      area: item.area,
      quantity: item.quantity,
      unit: item.unit,
      estimatedUnitCost: item.estimatedUnitCost,
      estimatedTotalCost: item.estimatedTotalCost,
      status: item.status,
      internalNote: item.internalNote,
      displayOrder: item.displayOrder,
      actualCost,
      variance: actualCost - Number(item.estimatedTotalCost),
    };
  });
  const rapForManager: RapView | null = activeRap
    ? {
        id: activeRap.id,
        status: activeRap.status,
        revision: activeRap.revision,
        notes: activeRap.notes,
        items: activeRap.items.map((item) => {
          const availableStock = item.material?.inventory.reduce((sum, inventory) => {
            return sum + Number(inventory.currentStock) - Number(inventory.reservedStock);
          }, 0) ?? 0;
          const reservedQuantity = item.stockMovements
            .filter((movement) => movement.movementType === "RESERVE")
            .reduce((sum, movement) => sum + Number(movement.quantity), 0);
          const boughtQuantity = item.stockMovements
            .filter((movement) => movement.movementType === "STOCK_IN")
            .reduce((sum, movement) => sum + Number(movement.quantity), 0);
          const usedQuantity = item.stockMovements
            .filter((movement) => movement.movementType === "USE")
            .reduce((sum, movement) => sum + Number(movement.quantity), 0);
          const returnedQuantity = item.stockMovements
            .filter((movement) => movement.movementType === "RETURN")
            .reduce((sum, movement) => sum + Number(movement.quantity), 0);
          const actualMaterialCost = projectMaterialExpenses
            .filter((expense) => expense.projectRapItemId === item.id && ["APPROVED", "PAID"].includes(expense.status))
            .reduce((sum, expense) => sum + Number(expense.amount), 0);
          const totalQuantity = Number(item.totalQuantity);
          const needToBuy = Math.max(0, totalQuantity - reservedQuantity - Math.max(0, boughtQuantity - usedQuantity));
          return {
            id: item.id,
            materialId: item.materialId,
            materialName: item.material?.name ?? "Manual item",
            area: item.area,
            name: item.name,
            description: item.description,
            requiredQuantity: item.requiredQuantity,
            bufferQuantity: item.bufferQuantity,
            totalQuantity: item.totalQuantity,
            unit: item.unit,
            estimatedUnitCost: item.estimatedUnitCost,
            estimatedTotalCost: item.estimatedTotalCost,
            source: item.source,
            status: item.status,
            internalNote: item.internalNote,
            availableStock,
            needToBuy,
            reservedQuantity,
            boughtQuantity,
            usedQuantity,
            leftoverQuantity: Math.max(0, boughtQuantity - usedQuantity + returnedQuantity),
            actualMaterialCost,
            costVariance: actualMaterialCost - Number(item.estimatedTotalCost),
          };
        }),
      }
    : null;
  const rabEstimateForManager: RabEstimateView | null = latestRabEstimate
    ? {
        id: latestRabEstimate.id,
        status: latestRabEstimate.status,
        revision: latestRabEstimate.revision,
        title: latestRabEstimate.title,
        clientNotes: latestRabEstimate.clientNotes,
        approvedValue: latestRabEstimate.approvedValue,
        items: latestRabEstimate.items.map((item) => ({
          id: item.id,
          sourceType: item.sourceType,
          sourceProjectRapItemId: item.sourceProjectRapItemId,
          sourceProjectCategoryPlanItemId: item.sourceProjectCategoryPlanItemId,
          clientLabel: item.clientLabel,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          displayOrder: item.displayOrder,
          isHidden: item.isHidden,
          isBundle: item.isBundle,
        })),
      }
    : null;
  const invoicesForClient: ClientInvoiceItem[] = proj.clientInvoices.map((invoice) => ({
    ...invoice,
    status: toClientInvoiceStatus(invoice.status),
    payments: invoice.payments.map((payment) => ({
      ...payment,
      referenceNumber: payment.referenceNumber ?? "-",
    })),
  }));

  return (
    <section className="space-y-sm select-none">
      {/* Top iOS Navigation Bar */}
      <div className="flex items-center justify-between border-b border-outline-variant/10 pb-sm">
        <Link href="/projects" className="inline-flex items-center gap-1 font-bold text-primary active:scale-95 transition-all text-xs">
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          <span>Proyek</span>
        </Link>
        <span className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant">Rincian Anggaran</span>
        <div className="w-12 h-4" /> {/* Spacer */}
      </div>

      {/* Header Info */}
      <div className="space-y-xs px-1">
        <div className="space-y-base">
          <h1 className="font-sans text-[24px] leading-[32px] tracking-tight font-semibold text-on-surface leading-tight">
            {proj.name}
          </h1>
          <div className="flex items-center gap-2 font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant text-[9px]">
            <span>Klien: {proj.client?.name || "-"}</span>
            <span>•</span>
            <span>PM: {proj.projectManager?.name || "-"}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge status={financialHealth}>{`Kesehatan: ${financialHealth}`}</Badge>
          <Badge status={budget?.status === "APPROVED" ? "APPROVED" : "DRAFT"}>
            {`Budget: ${budget?.status || "TIDAK ADA"}`}
          </Badge>
        </div>
      </div>

      {projectBudgetDashboard && (
        <div className="premium-card p-md border border-outline-variant/30 space-y-md">
          <div className="flex items-start justify-between gap-3 border-b border-outline-variant/10 pb-sm">
            <div>
              <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-primary">Project Budget Control</p>
              <h3 className="font-sans text-[20px] leading-[28px] font-semibold text-[18px] text-on-surface">Budget Categories</h3>
            </div>
            <Badge status={projectBudgetDashboard.usedPercentage > 100 ? "CRITICAL" : projectBudgetDashboard.usedPercentage >= 75 ? "WARNING" : "HEALTHY"}>
              {`${projectBudgetDashboard.usedPercentage.toFixed(1)}% Used`}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-md">
            <div>
              <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Project Value</p>
              <p className="font-mono text-[16px] leading-[20px] font-medium font-bold text-on-surface financial-amount">
                Rp {projectBudgetDashboard.contractValue.toLocaleString("id-ID")}
              </p>
            </div>
            <div>
              <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Internal Budget</p>
              <p className="font-mono text-[16px] leading-[20px] font-medium font-bold text-on-surface financial-amount">
                Rp {projectBudgetDashboard.internalBudget.toLocaleString("id-ID")}
              </p>
            </div>
            <div>
              <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Consumed</p>
              <p className="font-mono text-[16px] leading-[20px] font-medium font-bold text-secondary financial-amount">
                Rp {projectBudgetDashboard.actualCost.toLocaleString("id-ID")}
              </p>
            </div>
            <div>
              <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Pending Review</p>
              <p className="font-mono text-[16px] leading-[20px] font-medium font-bold text-on-surface financial-amount">
                Rp {projectBudgetDashboard.pendingCost.toLocaleString("id-ID")}
              </p>
            </div>
            <div>
              <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Paid</p>
              <p className="font-mono text-[16px] leading-[20px] font-medium font-bold text-primary financial-amount">
                Rp {projectBudgetDashboard.paidCost.toLocaleString("id-ID")}
              </p>
            </div>
            <div>
              <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Remaining</p>
              <p className={`font-mono text-[16px] leading-[20px] font-medium font-bold financial-amount ${projectBudgetDashboard.remainingBudget < 0 ? "text-error" : "text-primary"}`}>
                Rp {projectBudgetDashboard.remainingBudget.toLocaleString("id-ID")}
              </p>
            </div>
          </div>

          <div className="space-y-sm">
            {projectBudgetDashboard.categories.map((category) => (
              <div key={category.id} className="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-md space-y-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-sans text-[16px] leading-[24px] font-normal font-bold text-on-surface">{category.name}</h4>
                    <p className="text-[10px] text-on-surface-variant">
                      Budget Rp {category.allocatedAmount.toLocaleString("id-ID")} • Actual Rp {category.actualAmount.toLocaleString("id-ID")} • Pending Rp {category.pendingAmount.toLocaleString("id-ID")}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${
                    category.status === "OVER_BUDGET" || category.status === "CRITICAL"
                      ? "bg-error-container/20 text-error border border-error/30"
                      : category.status === "WATCH"
                      ? "bg-secondary-container/20 text-secondary border border-secondary/30"
                      : "bg-primary/10 text-primary border border-primary/20"
                  }`}>
                    {category.status}
                  </span>
                </div>
                <div className="space-y-xs">
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span className="text-on-surface-variant">Remaining Rp {category.remainingAmount.toLocaleString("id-ID")}</span>
                    <span>{category.usedPercentage.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
                    <div
                      className={`h-full rounded-full ${
                        category.status === "OVER_BUDGET" || category.status === "CRITICAL"
                          ? "bg-error"
                          : category.status === "WATCH"
                          ? "bg-secondary"
                          : "bg-primary"
                      }`}
                      style={{ width: `${Math.min(category.usedPercentage, 100)}%` }}
                    />
                  </div>
                </div>
                {category.code === "MATERIAL" && (
                  <Link href="/materials" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/20 px-3 text-xs font-bold text-primary active:scale-[0.98]">
                    <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                    View Material Usage
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Card Ringkasan Finansial Proyek */}
      <div className="premium-card p-md border border-outline-variant/30 space-y-md">
        <div className="pb-sm border-b border-outline-variant/10">
          <h3 className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
            Ringkasan Budget Proyek
          </h3>
        </div>
        <div className="space-y-md">
          <div className="grid grid-cols-2 gap-md border-b border-outline-variant/10 pb-md">
            <div className="space-y-base">
              <span className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Nilai Kontrak</span>
              <div className="font-mono text-[16px] leading-[20px] font-medium text-on-surface font-bold financial-amount">
                Rp {Number(proj.totalContractValue).toLocaleString("id-ID")}
              </div>
            </div>
            <div className="space-y-base">
              <span className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Total Alokasi Budget</span>
              <div className="font-mono text-[16px] leading-[20px] font-medium text-on-surface font-bold financial-amount">
                Rp {totalAllocated.toLocaleString("id-ID")}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-md">
            <div className="space-y-base">
              <span className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Realisasi Belanja</span>
              <div className="font-mono text-[16px] leading-[20px] font-medium text-on-surface font-bold financial-amount">
                Rp {totalSpent.toLocaleString("id-ID")}
              </div>
            </div>
            <div className="space-y-base">
              <span className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Sisa Plafon Anggaran</span>
              <div className={`font-mono text-[16px] leading-[20px] font-medium font-bold financial-amount ${totalRemaining < 0 ? "text-error" : "text-primary"}`}>
                {totalRemaining < 0 ? "-" : ""}Rp {Math.abs(totalRemaining).toLocaleString("id-ID")}
              </div>
            </div>
          </div>

          {/* Progress Bar Utilitas Total */}
          <div className="space-y-xs pt-xs">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="text-on-surface-variant">Utilitas Total Anggaran</span>
              <span className={totalUtilization >= 100 ? "text-error" : totalUtilization >= 90 ? "text-secondary font-bold" : "text-primary font-bold"}>
                {totalUtilization.toFixed(1)}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container border border-outline-variant/10">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  totalUtilization >= 100
                    ? "bg-error"
                    : totalUtilization >= 90
                    ? "bg-secondary"
                    : "bg-primary"
                }`}
                style={{ width: `${Math.min(totalUtilization, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Card Analisis Profitabilitas Proyek */}
      <div className="premium-card p-md border border-outline-variant/30 space-y-md">
        <div className="pb-sm border-b border-outline-variant/10">
          <h3 className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">trending_up</span>
            Analisis Profitabilitas Proyek
          </h3>
        </div>
        <div className="space-y-md">
          {/* Proyeksi Laba Kotor */}
          <div className="flex justify-between items-center border-b border-outline-variant/10 pb-md">
            <div className="space-y-base min-w-0 flex-1">
              <span className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Proyeksi Laba Kotor (Gross Profit)</span>
              <p className="text-[11px] text-on-surface-variant leading-tight truncate">Nilai Kontrak - Budget Proyek</p>
            </div>
            <div className="text-right shrink-0">
              <div className={`font-mono text-[16px] leading-[20px] font-medium font-bold financial-amount ${projectedGrossProfit >= 0 ? "text-primary" : "text-error"}`}>
                Rp {projectedGrossProfit.toLocaleString("id-ID")}
              </div>
              <span className={`text-[10px] font-bold ${projectedGrossProfit >= 0 ? "text-primary" : "text-error"}`}>
                {projectedGrossMargin.toFixed(1)}% margin
              </span>
            </div>
          </div>

          {/* Laba Bersih Terealisasi */}
          <div className="flex justify-between items-center">
            <div className="space-y-base min-w-0 flex-1">
              <span className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Laba Bersih Riil (Net Profit)</span>
              <p className="text-[11px] text-on-surface-variant leading-tight truncate">Kas Masuk Klien - Realisasi Belanja</p>
            </div>
            <div className="text-right shrink-0">
              <div className={`font-mono text-[16px] leading-[20px] font-medium font-bold financial-amount ${realizedNetProfit >= 0 ? "text-primary" : "text-error"}`}>
                {realizedNetProfit < 0 ? "-" : ""}Rp {Math.abs(realizedNetProfit).toLocaleString("id-ID")}
              </div>
              <span className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[8px] text-on-surface-variant block">
                Terbayar: Rp {totalReceived.toLocaleString("id-ID")}
              </span>
            </div>
          </div>
        </div>
      </div>

      <RapRabManager
        projectId={projectId}
        rap={rapForManager}
        rabEstimate={rabEstimateForManager}
        materials={materialOptions}
        userRole={roleName || "UNKNOWN"}
        budgetCategories={planBudgetCategories}
        categoryPlanItems={categoryPlanItemsForManager}
        vendors={vendorOptions}
      />

      {/* Card Invoices & Pembayaran Klien */}
      <ProjectInvoices 
        invoices={invoicesForClient} 
        bankAccounts={bankAccountsData} 
        userRole={roleName || "UNKNOWN"} 
      />
    </section>
  );
}
