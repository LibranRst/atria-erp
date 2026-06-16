import { db } from "@/db";
import { cashTransaction, aiRun, project, approval, projectCost, vendorPayment } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { resolveRoleName } from "@/lib/auth/permissions";
import { getOwnerBudgetDashboard } from "@/app/actions/project/excel-budget";
import { redirect } from "next/navigation";
import Link from "next/link";
import React from "react";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";
import { Badge } from "@/components/ui/badge";

interface ParsedBriefing {
  briefingDate: string;
  summary: string;
  metrics: {
    cashBalance: number;
    receivablesOverdue: number;
    payablesDueSevenDays: number;
    totalStockValue?: number;
    materialShortageCount?: number;
    leftoverReusableValue?: number;
  };
  alerts: Array<{
    severity: "WARNING" | "CRITICAL";
    message: string;
  }>;
}

type LedgerPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function LedgerPage({ searchParams }: LedgerPageProps): Promise<React.JSX.Element> {
  // 1. Get session
  const session = await auth.api.getSession({
    headers: {
      cookie: (await (await import("next/headers")).cookies()).toString(),
    },
  });

  if (!session || !session.user) {
    redirect("/login");
  }

  // 2. Resolve role & enforce permissions (Ledger/Dashboard is Owner and Finance Admin only)
  const roleName = await resolveRoleName(session.user.roleId);
  const isOwner = roleName === "OWNER";
  const isFinanceAdmin = roleName === "FINANCE_ADMIN";

  if (!isOwner && !isFinanceAdmin) {
    return (
      <section className="py-16 px-6 text-center space-y-4 max-w-sm mx-auto select-none">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-error-container/20 border border-error flex items-center justify-center text-error">
          <span className="material-symbols-outlined text-[32px] text-error animate-pulse">warning</span>
        </div>
        <h1 className="text-xl font-sans text-[24px] leading-[32px] tracking-tight font-semibold text-on-surface">Akses Ditolak</h1>
        <p className="text-xs text-secondary leading-relaxed">
          Hanya peran Owner dan Finance Admin yang diizinkan untuk melihat Dashboard Buku Kas Ledger.
        </p>
      </section>
    );
  }

  // 3. Resolve search params (detect AI Brief tab highlight)
  const resolvedParams = await searchParams;
  const isBriefTabActive = resolvedParams.brief === "true";

  // 4. Query all required CFO Dashboard data
  const accounts = await db.query.bankAccount.findMany();
  const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);

  const clientInvoices = await db.query.clientInvoice.findMany();
  const totalReceivables = clientInvoices.reduce((sum, inv) => {
    if (inv.status === "UNPAID" || inv.status === "PARTIALLY_PAID" || inv.status === "OVERDUE") {
      return sum + Number(inv.amount);
    }
    return sum;
  }, 0);

  const vendorBills = await db.query.vendorBill.findMany();
  const totalPayables = vendorBills.reduce((sum, bill) => {
    if (bill.status === "UNPAID" || bill.status === "PARTIALLY_PAID" || bill.status === "OVERDUE") {
      return sum + Number(bill.amount);
    }
    return sum;
  }, 0);

  const ledgerTransactions = await db.query.cashTransaction.findMany({
    orderBy: [desc(cashTransaction.createdAt)],
    limit: 10,
  });

  // Query pending approvals for alert badges
  const pendingApprovals = await db.query.approval.findMany({
    where: eq(approval.status, "PENDING"),
  });
  
  // Filter pending approvals to match the display rules on the approvals page
  let pendingApprovalsCount = 0;
  for (const app of pendingApprovals) {
    if (app.referenceType === "project_cost") {
      const cost = await db.query.projectCost.findFirst({
        where: eq(projectCost.id, app.referenceId),
      });
      if (cost && cost.status === "VERIFIED") {
        pendingApprovalsCount++;
      }
    } else if (app.referenceType === "vendor_payment") {
      const pay = await db.query.vendorPayment.findFirst({
        where: eq(vendorPayment.id, app.referenceId),
      });
      if (pay) {
        pendingApprovalsCount++;
      }
    }
  }

  // Query active projects and count warning/critical projects for alert badges
  const allProjects = await db.query.project.findMany({
    where: eq(project.status, "ACTIVE"),
  });
  const riskyProjectsCount = allProjects.filter(
    (p) => p.financialHealth === "CRITICAL" || p.financialHealth === "WARNING"
  ).length;

  const inventoryRows = await db.query.materialInventory.findMany();
  const totalStockValue = inventoryRows.reduce(
    (sum, item) => sum + (Number(item.currentStock) * Number(item.averageCost)),
    0
  );
  const reusableStockValue = inventoryRows.reduce(
    (sum, item) => sum + (Math.max(0, Number(item.currentStock) - Number(item.reservedStock)) * Number(item.averageCost)),
    0
  );
  const lowStockCount = inventoryRows.filter((item) => {
    const available = Number(item.currentStock) - Number(item.reservedStock);
    return available <= Number(item.minimumStock);
  }).length;

  const rapItems = await db.query.projectRapItem.findMany({
    with: {
      material: {
        with: {
          inventory: true,
        },
      },
    },
  });
  const materialShortageCount = rapItems.filter((item) => {
    const available = item.material?.inventory.reduce((sum, inv) => {
      return sum + Number(inv.currentStock) - Number(inv.reservedStock);
    }, 0) ?? 0;
    return Number(item.totalQuantity) > available;
  }).length;

  const ownerBudgetDashboardResult = await getOwnerBudgetDashboard();
  const ownerBudgetDashboard = ownerBudgetDashboardResult.success ? ownerBudgetDashboardResult.data : null;

  const latestBriefingRun = await db.query.aiRun.findFirst({
    where: and(
      eq(aiRun.runType, "FINANCIAL_BRIEFING"),
      eq(aiRun.status, "COMPLETED")
    ),
    orderBy: [desc(aiRun.createdAt)],
  });

  let parsedBriefing: ParsedBriefing | null = null;
  if (latestBriefingRun?.result) {
    try {
      parsedBriefing = JSON.parse(latestBriefingRun.result);
    } catch (e) {
      console.error("Failed to parse daily briefing JSON:", e);
    }
  }

  if (isBriefTabActive) {
    return (
      <section className="space-y-lg select-none pb-10">
        {/* Header */}
        <div className="space-y-base px-1">
          <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-primary">CFO AI Daily Briefing</p>
          <h1 className="font-sans text-[24px] leading-[32px] tracking-tight font-semibold text-on-surface">Analisis Finansial</h1>
          {parsedBriefing && (
            <p className="text-xs text-on-surface-variant font-semibold">
              Terakhir diperbarui: {new Date(parsedBriefing.briefingDate).toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
              })}
            </p>
          )}
        </div>

        {/* Narrative Summary */}
        <div className="premium-card p-md border border-primary-container bg-surface-container-low/50 space-y-md">
          <div className="flex items-center gap-2 text-primary font-bold">
            <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
            <h3 className="font-sans text-[20px] leading-[28px] font-semibold text-[16px]">Rangkuman Naratif</h3>
          </div>
          <p className="font-sans text-[16px] leading-[24px] font-normal text-on-surface-variant leading-relaxed whitespace-pre-wrap">
            {parsedBriefing?.summary || "Tidak ada rangkuman analisis harian yang tersedia saat ini."}
          </p>
        </div>

        {/* AI Metrics Grid */}
        <div className="space-y-sm">
          <h3 className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant px-1">Metrik Utama AI</h3>
          <div className="grid grid-cols-1 gap-sm">
            {/* Cash Balance */}
            <div className="premium-card p-md flex items-center justify-between border border-outline-variant/30">
              <div className="space-y-base">
                <span className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Proyeksi Saldo Kas</span>
                <p className="font-mono text-[22px] leading-[28px] font-medium text-primary font-bold financial-amount">
                  Rp {(parsedBriefing?.metrics.cashBalance ?? totalBalance).toLocaleString("id-ID")}
                </p>
              </div>
              <span className="material-symbols-outlined text-primary text-[28px]">account_balance_wallet</span>
            </div>

            {/* Receivables */}
            <div className="premium-card p-md flex items-center justify-between border border-outline-variant/30">
              <div className="space-y-base">
                <span className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Piutang Overdue</span>
                <p className="font-mono text-[22px] leading-[28px] font-medium text-secondary font-bold financial-amount">
                  Rp {(parsedBriefing?.metrics.receivablesOverdue ?? 0).toLocaleString("id-ID")}
                </p>
              </div>
              <span className="material-symbols-outlined text-secondary text-[28px]">trending_down</span>
            </div>

            {/* Payables */}
            <div className="premium-card p-md flex items-center justify-between border border-outline-variant/30">
              <div className="space-y-base">
                <span className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Hutang Vendor (7 Hari Ke Depan)</span>
                <p className="font-mono text-[22px] leading-[28px] font-medium text-on-surface font-bold financial-amount">
                  Rp {(parsedBriefing?.metrics.payablesDueSevenDays ?? 0).toLocaleString("id-ID")}
                </p>
              </div>
              <span className="material-symbols-outlined text-outline text-[28px]">payment</span>
            </div>

            <div className="premium-card p-md flex items-center justify-between border border-outline-variant/30">
              <div className="space-y-base">
                <span className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Nilai Stock Material</span>
                <p className="font-mono text-[22px] leading-[28px] font-medium text-primary font-bold financial-amount">
                  Rp {(parsedBriefing?.metrics.totalStockValue ?? totalStockValue).toLocaleString("id-ID")}
                </p>
              </div>
              <span className="material-symbols-outlined text-primary text-[28px]">inventory_2</span>
            </div>

            <div className="premium-card p-md flex items-center justify-between border border-outline-variant/30">
              <div className="space-y-base">
                <span className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Material Shortage</span>
                <p className="font-mono text-[22px] leading-[28px] font-medium text-secondary font-bold">
                  {parsedBriefing?.metrics.materialShortageCount ?? materialShortageCount} item
                </p>
              </div>
              <span className="material-symbols-outlined text-secondary text-[28px]">production_quantity_limits</span>
            </div>
          </div>
        </div>

        {/* AI Alerts */}
        <div className="space-y-sm">
          <h3 className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant px-1">Peringatan Risiko AI</h3>
          {(!parsedBriefing || !parsedBriefing.alerts || parsedBriefing.alerts.length === 0) ? (
            <div className="premium-card p-md flex items-center gap-3 border border-outline-variant/20 bg-surface/50">
              <span className="material-symbols-outlined text-success" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <p className="font-sans text-[14px] leading-[20px] font-normal text-on-surface-variant">Tidak ada risiko finansial terdeteksi hari ini.</p>
            </div>
          ) : (
            <div className="space-y-sm">
              {parsedBriefing.alerts.map((alert, idx) => {
                const isCritical = alert.severity === "CRITICAL";
                return (
                  <div key={idx} className={`premium-card p-md flex items-start gap-3 border ${isCritical ? "border-error bg-error-container/5" : "border-secondary bg-secondary-container/5"}`}>
                    <span className={`material-symbols-outlined ${isCritical ? "text-error" : "text-secondary"}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                      {isCritical ? "warning" : "info"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-sans text-[16px] leading-[24px] font-normal font-bold text-on-surface leading-tight">
                        {isCritical ? "Risiko Kritis" : "Peringatan Risiko"}
                      </p>
                      <p className="font-sans text-[14px] leading-[20px] font-normal text-on-surface-variant leading-relaxed mt-1">
                        {alert.message || "Risiko terdeteksi pada proyek."}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    );
  }

  const getIndonesianDate = () => {
    const today = new Date();
    return today.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  };

  const budgetSection = ownerBudgetDashboard ? (
    <div className="space-y-lg">
      {/* Budget Health Header Card */}
      <div className="premium-card p-md border border-outline-variant/30 space-y-md">
        <div className="flex items-center justify-between">
          <h3 className="font-sans text-[16px] leading-[24px] font-bold text-on-surface">Budget Health</h3>
          <span className="rounded-full border border-outline-variant/30 px-3 py-1 text-[10px] font-bold text-on-surface-variant">
            {ownerBudgetDashboard.projectsOverBudget} Over Budget
          </span>
        </div>

        <div className="grid grid-cols-2 gap-md">
          <div>
            <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant">Project Value</p>
            <p className="font-mono text-[16px] leading-[20px] font-bold text-on-surface financial-amount mt-0.5">
              Rp {ownerBudgetDashboard.totalProjectValue.toLocaleString("id-ID")}
            </p>
          </div>
          <div>
            <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant">Budget CAP</p>
            <p className="font-mono text-[16px] leading-[20px] font-bold text-on-surface financial-amount mt-0.5">
              Rp {ownerBudgetDashboard.totalBudget.toLocaleString("id-ID")}
            </p>
          </div>
          <div>
            <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant">Consumed</p>
            <p className="font-mono text-[16px] leading-[20px] font-bold text-secondary financial-amount mt-0.5">
              Rp {ownerBudgetDashboard.consumedBudget.toLocaleString("id-ID")}
            </p>
          </div>
          <div>
            <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant">Remaining</p>
            <p className={`font-mono text-[16px] leading-[20px] font-bold financial-amount mt-0.5 ${ownerBudgetDashboard.remainingBudget < 0 ? "text-error" : "text-primary"}`}>
              Rp {ownerBudgetDashboard.remainingBudget.toLocaleString("id-ID")}
            </p>
          </div>
        </div>

        <div className="space-y-xs border-t border-outline-variant/10 pt-md">
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span className="text-on-surface-variant">Budget Used</span>
            <span className={ownerBudgetDashboard.usedPercentage > 100 ? "text-error" : ownerBudgetDashboard.usedPercentage >= 75 ? "text-secondary" : "text-primary"}>
              {ownerBudgetDashboard.usedPercentage.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container border border-outline-variant/10">
            <div
              className={`h-full rounded-full ${ownerBudgetDashboard.usedPercentage > 100 ? "bg-error" : ownerBudgetDashboard.usedPercentage >= 75 ? "bg-secondary" : "bg-primary"}`}
              style={{ width: `${Math.min(ownerBudgetDashboard.usedPercentage, 100)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-sm">
          <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-sm text-center">
            <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant">Projected Margin</p>
            <p className="font-mono text-[16px] leading-[20px] font-bold text-primary mt-0.5">
              {ownerBudgetDashboard.projectedMarginPercentage.toFixed(1)}%
            </p>
          </div>
          <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-sm text-center">
            <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant">Near Limit</p>
            <p className="font-mono text-[16px] leading-[20px] font-bold text-secondary mt-0.5">
              {ownerBudgetDashboard.categoriesNearLimit} Kategori
            </p>
          </div>
        </div>
      </div>

      {/* Categories list */}
      <div className="space-y-sm">
        {ownerBudgetDashboard.categories.map((category) => (
          <div key={category.code} className="premium-card p-md border border-outline-variant/30 space-y-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-sans text-[14px] leading-[20px] font-bold text-on-surface">{category.name}</h4>
                <p className="text-[10px] text-on-surface-variant mt-1 leading-normal">
                  Budget: Rp {category.allocatedAmount.toLocaleString("id-ID")} • Spend: Rp {category.actualAmount.toLocaleString("id-ID")}
                </p>
              </div>
              <Badge status={
                category.status === "OVER_BUDGET" || category.status === "CRITICAL"
                  ? "CRITICAL"
                  : category.status === "WATCH"
                  ? "WARNING"
                  : "APPROVED"
              }>
                {category.status}
              </Badge>
            </div>
            <div className="space-y-xs pt-1">
              <div className="flex justify-between text-[11px] font-semibold text-on-surface-variant">
                <span>Remaining: Rp {category.remainingAmount.toLocaleString("id-ID")}</span>
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
              <div className="pt-2">
                <Link href="/projects" className="inline-flex h-9 items-center gap-2 rounded-xl border border-primary/20 px-3 text-xs font-bold text-primary active:scale-[0.98]">
                  <span className="material-symbols-outlined text-[16px]">folder_open</span>
                  Lihat Anggaran Proyek
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  ) : (
    <div className="premium-card p-md text-center py-10 border border-outline-variant/30">
      <p className="font-sans text-[13px] leading-[20px] font-normal text-on-surface-variant">Data anggaran proyek belum tersedia.</p>
    </div>
  );

  const financeSection = (
    <div className="space-y-lg">
      {/* Stock Overview Card */}
      <div className="premium-card p-md border border-outline-variant/30 space-y-md">
        <h3 className="font-sans text-[16px] leading-[24px] font-bold text-on-surface">Material Stock Value</h3>
        <div className="grid grid-cols-2 gap-md">
          <div>
            <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant">Total Stock Value</p>
            <p className="font-mono text-[16px] leading-[20px] font-bold text-primary financial-amount mt-0.5">
              Rp {totalStockValue.toLocaleString("id-ID")}
            </p>
            <p className="text-[10px] text-on-surface-variant mt-1">{lowStockCount} Low stock</p>
          </div>
          <div>
            <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant">Reusable Stock</p>
            <p className="font-mono text-[16px] leading-[20px] font-bold text-secondary financial-amount mt-0.5">
              Rp {reusableStockValue.toLocaleString("id-ID")}
            </p>
            <p className="text-[10px] text-on-surface-variant mt-1">{materialShortageCount} Shortages</p>
          </div>
        </div>
        <div className="border-t border-outline-variant/10 pt-md">
          <Link href="/materials" className="inline-flex h-9 items-center gap-2 rounded-xl border border-primary/20 px-3 text-xs font-bold text-primary active:scale-[0.98]">
            <span className="material-symbols-outlined text-[16px]">inventory_2</span>
            Kelola Stok Material
          </Link>
        </div>
      </div>

      {/* Bank Accounts list */}
      <div className="space-y-sm">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-sans text-[14px] leading-[20px] font-bold text-on-surface">Rekening Kas Perusahaan</h3>
        </div>
        <div className="space-y-sm">
          {accounts.map((acc) => {
            const isPetty = acc.name.toLowerCase().includes("petty") || acc.name.toLowerCase().includes("kecil");
            const iconName = isPetty ? "wallet" : "account_balance";
            const iconColorClass = isPetty ? "text-secondary" : "text-primary";
            const badgeColorClass = isPetty 
              ? "bg-secondary/10 border-secondary/20 text-secondary" 
              : "bg-primary/10 border-primary/20 text-primary";
            
            return (
              <div
                key={acc.id}
                className="premium-card p-md border border-outline-variant/20 hover:border-primary/30 transition-all flex items-center justify-between gap-md"
              >
                <div className="flex items-center gap-md min-w-0">
                  <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center shrink-0">
                    <span className={`material-symbols-outlined text-[20px] ${iconColorClass}`}>{iconName}</span>
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-xs">
                      <span className="font-bold text-xs text-on-surface truncate">
                        {acc.name}
                      </span>
                      <span className={`text-[8px] font-bold uppercase border px-2 rounded-full inline-block ${badgeColorClass}`}>
                        {acc.bankName}
                      </span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant truncate">
                      {acc.accountNumber} • A/N: {acc.holderName}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-[14px] font-bold text-on-surface financial-amount">
                    Rp {Number(acc.balance).toLocaleString("id-ID")}
                  </p>
                  <p className="text-[9px] text-on-surface-variant uppercase tracking-wider font-semibold mt-0.5">Saldo Aktual</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const activitySection = (
    <div className="space-y-lg">
      {/* Urgent Alerts */}
      <div className="space-y-sm">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-sans text-[14px] leading-[20px] font-bold text-on-surface">Urgent Alerts</h3>
          <Link href="/approvals" className="text-primary font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase active:opacity-85">
            View All
          </Link>
        </div>

        <div className="space-y-sm">
          {/* Alert 1 - Pending Approvals */}
          <Link href="/approvals" className="block active:scale-[0.99] transition-transform">
            <div className={`premium-card p-md flex items-center justify-between border ${pendingApprovalsCount > 0 ? "border-error bg-error-container/5" : "border-outline-variant/30"}`}>
              <div className="flex items-center gap-3">
                <span className={pendingApprovalsCount > 0 ? "material-symbols-outlined text-error" : "material-symbols-outlined text-on-surface-variant"} style={{ fontVariationSettings: "'FILL' 1" }}>
                  {pendingApprovalsCount > 0 ? "warning" : "check_circle"}
                </span>
                <span className="font-sans text-[13px] leading-[20px] font-semibold text-on-surface">
                  {pendingApprovalsCount > 0 
                    ? `${pendingApprovalsCount} Pengajuan Menunggu Persetujuan` 
                    : "Tidak Ada Pengajuan Menunggu Persetujuan"
                  }
                </span>
              </div>
              <span className="material-symbols-outlined text-outline-variant text-[20px]">chevron_right</span>
            </div>
          </Link>

          {/* Alert 2 - Risky Projects */}
          <Link href="/projects" className="block active:scale-[0.99] transition-transform">
            <div className={`premium-card p-md flex items-center justify-between border ${riskyProjectsCount > 0 ? "border-secondary bg-secondary-container/5" : "border-outline-variant/30"}`}>
              <div className="flex items-center gap-3">
                <span className={riskyProjectsCount > 0 ? "material-symbols-outlined text-secondary" : "material-symbols-outlined text-on-surface-variant"} style={{ fontVariationSettings: "'FILL' 1" }}>
                  {riskyProjectsCount > 0 ? "monitoring" : "folder_open"}
                </span>
                <span className="font-sans text-[13px] leading-[20px] font-semibold text-on-surface">
                  {riskyProjectsCount > 0 
                    ? `${riskyProjectsCount} Proyek dengan Risiko Finansial` 
                    : "Semua Kesehatan Finansial Proyek Aman"
                  }
                </span>
              </div>
              <span className="material-symbols-outlined text-outline-variant text-[20px]">chevron_right</span>
            </div>
          </Link>

          {/* Alert 3 - Materials */}
          <Link href="/materials" className="block active:scale-[0.99] transition-transform">
            <div className={`premium-card p-md flex items-center justify-between border ${materialShortageCount > 0 || lowStockCount > 0 ? "border-secondary bg-secondary-container/5" : "border-outline-variant/30"}`}>
              <div className="flex items-center gap-3">
                <span className={materialShortageCount > 0 || lowStockCount > 0 ? "material-symbols-outlined text-secondary" : "material-symbols-outlined text-on-surface-variant"} style={{ fontVariationSettings: "'FILL' 1" }}>
                  {materialShortageCount > 0 || lowStockCount > 0 ? "inventory_2" : "check_circle"}
                </span>
                <span className="font-sans text-[13px] leading-[20px] font-semibold text-on-surface">
                  {materialShortageCount > 0
                    ? `${materialShortageCount} Material RAP Perlu Dibeli`
                    : lowStockCount > 0
                    ? `${lowStockCount} Material Low Stock`
                    : "Kondisi Material Aman"
                  }
                </span>
              </div>
              <span className="material-symbols-outlined text-outline-variant text-[20px]">chevron_right</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Transactions Section */}
      <div className="space-y-sm">
        <h3 className="font-sans text-[14px] leading-[20px] font-bold text-on-surface px-1">Recent Transactions</h3>
        
        {ledgerTransactions.length === 0 ? (
          <div className="premium-card p-md flex items-center justify-center text-center">
            <p className="font-sans text-[13px] leading-[20px] font-normal text-on-surface-variant">Belum ada mutasi kas tercatat.</p>
          </div>
        ) : (
          <div className="premium-card divide-y divide-outline-variant/10 overflow-hidden">
            {ledgerTransactions.slice(0, 5).map((tx) => {
              const isDebit = tx.type === "DEBIT";
              const amountVal = Number(tx.amount);
              return (
                <div key={tx.id} className="p-md flex justify-between items-center gap-3 hover:bg-surface-container-low/20 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">
                      <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                        {isDebit ? "architecture" : "shopping_cart"}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-sans text-[14px] leading-[20px] font-bold text-on-surface truncate">{tx.description}</p>
                      <p className="font-sans text-[12px] leading-[16px] text-on-surface-variant truncate">
                        {isDebit ? "Client Invoice Payment" : "Vendor payment / project expense"}
                      </p>
                    </div>
                  </div>
                  <p className={`font-mono text-[14px] font-medium financial-amount whitespace-nowrap shrink-0 text-right ${isDebit ? "text-primary font-bold" : "text-on-surface font-semibold"}`}>
                    {isDebit ? "+" : "-"}Rp {amountVal.toLocaleString("id-ID")}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Date & Greeting Row */}
      <section className="space-y-base select-none px-1">
        <p className="font-sans text-[9px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant/80">
          {getIndonesianDate()}
        </p>
        <h2 className="text-xl font-bold tracking-tight text-on-surface">
          Halo, {session.user.name.split(" ")[0]}
        </h2>
      </section>

      {/* Unified Cash Available KPI Widget */}
      <section className="premium-card p-md !bg-primary text-on-primary relative overflow-hidden select-none border border-primary-container/20 shadow-sm">
        <div className="relative z-10 space-y-md">
          <div>
            <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase opacity-80 mb-1">CASH AVAILABLE</p>
            <div className="font-mono text-[36px] font-bold tracking-tight leading-none financial-amount">
              Rp {totalBalance.toLocaleString("id-ID")}
            </div>
          </div>

          <div className="border-t border-white/10 pt-md grid grid-cols-2 gap-md">
            <div>
              <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase opacity-75 mb-1">EXPECTED IN (PIUTANG)</p>
              <p className="font-mono text-[16px] leading-[20px] font-bold financial-amount mt-0.5">
                Rp {totalReceivables.toLocaleString("id-ID")}
              </p>
            </div>
            <div>
              <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase opacity-75 mb-1">TO PAY (HUTANG)</p>
              <p className="font-mono text-[16px] leading-[20px] font-bold financial-amount mt-0.5">
                Rp {totalPayables.toLocaleString("id-ID")}
              </p>
            </div>
          </div>
        </div>
        
        {/* Subtle Wallet Background Icon Graphic */}
        <div className="absolute -right-4 -bottom-4 opacity-10 pointer-events-none">
          <span className="material-symbols-outlined text-[120px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
            account_balance_wallet
          </span>
        </div>
      </section>

      {/* AI CFO Brief Insight Card */}
      <section className="premium-card p-md border border-primary-container/30 bg-surface-container-low/50 select-none">
        <div className="flex items-start gap-md">
          <div className="p-2 bg-primary-container/10 border border-primary/20 rounded-xl text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-[20px]">auto_awesome</span>
          </div>
          <div className="min-w-0 flex-1 space-y-base">
            <div className="flex items-center justify-between">
              <h3 className="font-sans text-[14px] leading-[20px] font-bold text-primary">CFO AI Briefing</h3>
              {parsedBriefing && (
                <span className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant/80">
                  {new Date(parsedBriefing.briefingDate).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short"
                  })}
                </span>
              )}
            </div>
            <p className="font-sans text-[13px] leading-[18px] font-normal text-on-surface-variant line-clamp-2">
              {parsedBriefing?.summary || "Analisis keuangan harian belum tersedia saat ini."}
            </p>
            <div className="flex justify-end pt-1">
              <Link
                href="/ledger?brief=true"
                className="bg-primary text-on-primary rounded-full px-sm py-1.5 text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer border border-primary/10 shadow-sm"
              >
                <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                <span>Analisis AI</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Lower section with tabs */}
      <DashboardTabs
        budgetSection={budgetSection}
        financeSection={financeSection}
        activitySection={activitySection}
      />
    </>
  );
}
