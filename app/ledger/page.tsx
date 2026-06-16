import { db } from "@/db";
import { cashTransaction, aiRun, project, approval, projectCost, vendorPayment } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { resolveRoleName } from "@/lib/auth/permissions";
import { getOwnerBudgetDashboard } from "@/app/actions/project/excel-budget";
import { redirect } from "next/navigation";
import Link from "next/link";
import React from "react";

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

  return (
    <>
      {/* Greeting Section */}
      <section className="space-y-base select-none">
        <p className="font-sans text-[16px] leading-[24px] font-normal text-on-surface-variant">Good morning, {session.user.name.split(" ")[0]}</p>
        <h2 className="font-sans text-[24px] leading-[32px] tracking-tight font-semibold text-on-surface">Portfolio Overview</h2>
      </section>

      {/* Main KPI Card */}
      <section className="premium-card p-md !bg-primary text-on-primary relative overflow-hidden select-none">
        <div className="relative z-10">
          <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase uppercase opacity-80 mb-1">Cash Available</p>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-[22px] leading-[28px] font-medium text-[40px] !font-bold tracking-tight leading-none financial-amount">
              Rp {totalBalance.toLocaleString("id-ID")}
            </span>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">trending_up</span>
            <span className="font-sans text-[14px] leading-[20px] font-normal">+2.4% from last month</span>
          </div>
        </div>
        
        {/* Subtle Wallet Background Icon Graphic */}
        <div className="absolute -right-4 -bottom-4 opacity-10 pointer-events-none">
          <span className="material-symbols-outlined text-[120px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance_wallet</span>
        </div>
      </section>

      {/* Metric Stack expected/to pay */}
      <section className="grid grid-cols-2 gap-md select-none">
        {/* Expected In Card */}
        <div className="premium-card p-md">
          <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant mb-2">Expected In</p>
          <p className="font-mono text-[22px] leading-[28px] font-medium text-primary financial-amount">
            Rp {Math.round(totalReceivables / 1000000)}jt
          </p>
          <div className="h-1.5 w-full bg-surface-container mt-3 rounded-full overflow-hidden">
            <div className="bg-primary h-full w-[70%]" />
          </div>
        </div>

        {/* To Pay Card */}
        <div className="premium-card p-md">
          <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant mb-2">To Pay</p>
          <p className="font-mono text-[22px] leading-[28px] font-medium text-secondary financial-amount">
            Rp {Math.round(totalPayables / 1000000)}jt
          </p>
          <div className="h-1.5 w-full bg-surface-container mt-3 rounded-full overflow-hidden">
            <div className="bg-secondary h-full w-[45%]" />
          </div>
        </div>
      </section>

      {ownerBudgetDashboard && (
        <section className="space-y-sm select-none">
          <div className="flex items-center justify-between px-1">
            <div>
              <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-primary">Project Budget Control</p>
              <h3 className="font-sans text-[20px] leading-[28px] font-semibold text-[18px] text-on-surface">Budget Health</h3>
            </div>
            <span className="rounded-full border border-outline-variant/30 px-3 py-1 text-[10px] font-bold text-on-surface-variant">
              {ownerBudgetDashboard.projectsOverBudget} over
            </span>
          </div>

          <div className="premium-card p-md border border-outline-variant/30 space-y-md">
            <div className="grid grid-cols-2 gap-md">
              <div>
                <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Project Value</p>
                <p className="font-mono text-[16px] leading-[20px] font-medium font-bold text-on-surface financial-amount">
                  Rp {Math.round(ownerBudgetDashboard.totalProjectValue / 1000000)}jt
                </p>
              </div>
              <div>
                <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Budget</p>
                <p className="font-mono text-[16px] leading-[20px] font-medium font-bold text-on-surface financial-amount">
                  Rp {Math.round(ownerBudgetDashboard.totalBudget / 1000000)}jt
                </p>
              </div>
              <div>
                <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Consumed</p>
                <p className="font-mono text-[16px] leading-[20px] font-medium font-bold text-secondary financial-amount">
                  Rp {Math.round(ownerBudgetDashboard.consumedBudget / 1000000)}jt
                </p>
              </div>
              <div>
                <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Pending Review</p>
                <p className="font-mono text-[16px] leading-[20px] font-medium font-bold text-on-surface financial-amount">
                  Rp {Math.round(ownerBudgetDashboard.pendingBudget / 1000000)}jt
                </p>
              </div>
              <div>
                <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Paid</p>
                <p className="font-mono text-[16px] leading-[20px] font-medium font-bold text-primary financial-amount">
                  Rp {Math.round(ownerBudgetDashboard.paidBudget / 1000000)}jt
                </p>
              </div>
              <div>
                <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Remaining</p>
                <p className={`font-mono text-[16px] leading-[20px] font-medium font-bold financial-amount ${ownerBudgetDashboard.remainingBudget < 0 ? "text-error" : "text-primary"}`}>
                  Rp {Math.round(ownerBudgetDashboard.remainingBudget / 1000000)}jt
                </p>
              </div>
            </div>
            <div className="space-y-xs">
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
              <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-sm">
                <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Projected Margin</p>
                <p className="font-mono text-[16px] leading-[20px] font-medium font-bold text-primary financial-amount">
                  {ownerBudgetDashboard.projectedMarginPercentage.toFixed(1)}%
                </p>
              </div>
              <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-sm">
                <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Near Limit</p>
                <p className="font-mono text-[16px] leading-[20px] font-medium font-bold text-secondary">
                  {ownerBudgetDashboard.categoriesNearLimit} kategori
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-sm">
            {ownerBudgetDashboard.categories.map((category) => (
              <div key={category.code} className="premium-card p-md border border-outline-variant/30 space-y-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-sans text-[16px] leading-[24px] font-normal font-bold text-on-surface">{category.name}</h4>
                    <p className="text-[10px] text-on-surface-variant">
                      Budget Rp {Math.round(category.allocatedAmount / 1000000)}jt • Actual Rp {Math.round(category.actualAmount / 1000000)}jt • Pending Rp {Math.round(category.pendingAmount / 1000000)}jt
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
                    <span className="text-on-surface-variant">Remaining Rp {Math.round(category.remainingAmount / 1000000)}jt</span>
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
        </section>
      )}

      <section className="grid grid-cols-2 gap-md select-none">
        <Link href="/materials" className="premium-card p-md block active:scale-[0.99] transition-transform">
          <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant mb-2">Stock Value</p>
          <p className="font-mono text-[22px] leading-[28px] font-medium text-primary financial-amount">
            Rp {Math.round(totalStockValue / 1000000)}jt
          </p>
          <p className="text-[10px] text-on-surface-variant mt-2">{lowStockCount} low stock</p>
        </Link>

        <Link href="/materials" className="premium-card p-md block active:scale-[0.99] transition-transform">
          <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant mb-2">Reusable</p>
          <p className="font-mono text-[22px] leading-[28px] font-medium text-secondary financial-amount">
            Rp {Math.round(reusableStockValue / 1000000)}jt
          </p>
          <p className="text-[10px] text-on-surface-variant mt-2">{materialShortageCount} shortage</p>
        </Link>
      </section>

      {/* Rekening Kas Perusahaan (Horizontal Swipe Grid) */}
      <section className="space-y-sm select-none">
        <h3 className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant px-1">Rekening Kas Perusahaan</h3>
        <div className="flex gap-md overflow-x-auto snap-x snap-mandatory pb-3 pt-1 no-scrollbar">
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
                className="min-w-[260px] snap-center shrink-0 premium-card p-md border border-outline-variant/20 flex flex-col justify-between min-h-[135px] hover:border-primary/30 transition-all active:scale-[0.99]"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className={`text-[10px] font-bold uppercase border px-2.5 py-0.5 rounded-full inline-block ${badgeColorClass}`}>
                      {acc.bankName}
                    </div>
                    <div className="text-xs text-on-surface-variant font-medium mt-1">{acc.accountNumber}</div>
                  </div>
                  <span className={`material-symbols-outlined text-[24px] ${iconColorClass}`}>{iconName}</span>
                </div>
                <div className="mt-4 space-y-base">
                  <div className="text-[9px] uppercase font-semibold text-on-surface-variant tracking-wider">Saldo Aktual</div>
                  <div className="font-mono text-[16px] leading-[20px] font-medium text-on-surface font-bold financial-amount leading-none">
                    Rp {Number(acc.balance).toLocaleString("id-ID")}
                  </div>
                  <div className="text-[9px] text-on-surface-variant truncate">A/N: {acc.holderName}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* AI Insight Card */}
      <section 
        id="ai-brief"
        className={`premium-card p-md border transition-all duration-200 ${
          isBriefTabActive 
            ? "border-primary bg-surface-container-low shadow-md scale-[1.01]" 
            : "border-primary-container bg-surface-container-low"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary-container rounded-lg text-white flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-white text-[20px]">auto_awesome</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-sans text-[20px] leading-[28px] font-semibold text-[16px] text-primary">AI Brief</h3>
              {parsedBriefing && (
                <span className="text-[8px] text-on-surface-variant/80 font-bold uppercase tracking-wider">
                  {new Date(parsedBriefing.briefingDate).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short"
                  })}
                </span>
              )}
            </div>
            <p className="font-sans text-[16px] leading-[24px] font-normal text-on-surface-variant">
              {parsedBriefing?.summary 
                ? parsedBriefing.summary.slice(0, 160) + "..." 
                : "Cash position is strong. Follow up with 2 clients for "
              }
              {!parsedBriefing && <span className="font-bold text-on-surface">Rp 180jt</span>}
              {!parsedBriefing && "."}
            </p>
          </div>
        </div>
      </section>

      {/* Urgent Alerts */}
      <section className="space-y-sm select-none">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-sans text-[20px] leading-[28px] font-semibold text-[18px]">Urgent Alerts</h3>
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
                <span className="font-sans text-[16px] leading-[24px] font-normal font-semibold text-on-surface">
                  {pendingApprovalsCount > 0 
                    ? `${pendingApprovalsCount} Pengajuan Menunggu Persetujuan` 
                    : "Tidak Ada Pengajuan Menunggu Persetujuan"
                  }
                </span>
              </div>
              <span className="material-symbols-outlined text-outline-variant">chevron_right</span>
            </div>
          </Link>

          {/* Alert 2 - Risky Projects */}
          <Link href="/projects" className="block active:scale-[0.99] transition-transform">
            <div className={`premium-card p-md flex items-center justify-between border ${riskyProjectsCount > 0 ? "border-secondary bg-secondary-container/5" : "border-outline-variant/30"}`}>
              <div className="flex items-center gap-3">
                <span className={riskyProjectsCount > 0 ? "material-symbols-outlined text-secondary" : "material-symbols-outlined text-on-surface-variant"} style={{ fontVariationSettings: "'FILL' 1" }}>
                  {riskyProjectsCount > 0 ? "monitoring" : "folder_open"}
                </span>
                <span className="font-sans text-[16px] leading-[24px] font-normal font-semibold text-on-surface">
                  {riskyProjectsCount > 0 
                    ? `${riskyProjectsCount} Proyek dengan Risiko Finansial` 
                    : "Semua Kesehatan Finansial Proyek Aman"
                  }
                </span>
              </div>
              <span className="material-symbols-outlined text-outline-variant">chevron_right</span>
            </div>
          </Link>

          <Link href="/materials" className="block active:scale-[0.99] transition-transform">
            <div className={`premium-card p-md flex items-center justify-between border ${materialShortageCount > 0 || lowStockCount > 0 ? "border-secondary bg-secondary-container/5" : "border-outline-variant/30"}`}>
              <div className="flex items-center gap-3">
                <span className={materialShortageCount > 0 || lowStockCount > 0 ? "material-symbols-outlined text-secondary" : "material-symbols-outlined text-on-surface-variant"} style={{ fontVariationSettings: "'FILL' 1" }}>
                  {materialShortageCount > 0 || lowStockCount > 0 ? "inventory_2" : "check_circle"}
                </span>
                <span className="font-sans text-[16px] leading-[24px] font-normal font-semibold text-on-surface">
                  {materialShortageCount > 0
                    ? `${materialShortageCount} Material RAP Perlu Dibeli`
                    : lowStockCount > 0
                    ? `${lowStockCount} Material Low Stock`
                    : "Kondisi Material Aman"
                  }
                </span>
              </div>
              <span className="material-symbols-outlined text-outline-variant">chevron_right</span>
            </div>
          </Link>
        </div>
      </section>

      {/* Recent Transactions Section */}
      <section className="space-y-sm pb-10 select-none">
        <h3 className="font-sans text-[20px] leading-[28px] font-semibold text-[18px] px-1 text-on-surface">Recent Transactions</h3>
        
        {ledgerTransactions.length === 0 ? (
          <div className="premium-card p-md flex items-center justify-center text-center">
            <p className="font-sans text-[14px] leading-[20px] font-normal text-on-surface-variant">Belum ada mutasi kas tercatat.</p>
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
                      <span className="material-symbols-outlined text-on-surface-variant">
                        {isDebit ? "architecture" : "shopping_cart"}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-sans text-[16px] leading-[24px] font-normal font-bold text-on-surface truncate">{tx.description}</p>
                      <p className="font-sans text-[14px] leading-[20px] font-normal text-on-surface-variant truncate">
                        {isDebit ? "Invoiced" : "Vendor Payment"}
                      </p>
                    </div>
                  </div>
                  <p className={`font-mono text-[16px] leading-[20px] font-medium financial-amount whitespace-nowrap shrink-0 text-right ${isDebit ? "text-primary font-bold" : "text-on-surface font-semibold"}`}>
                    {isDebit ? "+" : "-"}Rp {amountVal.toLocaleString("id-ID")}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
