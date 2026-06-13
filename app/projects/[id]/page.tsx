import { db } from "@/db";
import { project } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { resolveRoleName } from "@/lib/auth/permissions";
import { assertProjectAccess } from "@/lib/auth/scoping";
import { Badge } from "@/components/ui/badge";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import React from "react";
import { ClientInvoiceItem, ProjectInvoices } from "@/components/project/project-invoices";
import { BudgetManager } from "@/components/project/budget-manager";

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
    },
  });

  if (!proj) {
    notFound();
  }

  // 4. Kueri daftar rekening bank
  const bankAccountsData = await db.query.bankAccount.findMany();

  // 5. Kueri daftar kategori biaya (cost categories)
  const costCategoriesData = await db.query.projectCostCategory.findMany();

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

  // Group budget items by cost category name
  const itemsByCategory: Record<string, typeof budgetItems> = {};
  budgetItems.forEach((item) => {
    const catName = item.costCategory?.name || "LAIN-LAIN";
    if (!itemsByCategory[catName]) {
      itemsByCategory[catName] = [];
    }
    itemsByCategory[catName].push(item);
  });

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
        <span className="font-label-caps text-on-surface-variant">Rincian Anggaran</span>
        <div className="w-12 h-4" /> {/* Spacer */}
      </div>

      {/* Header Info */}
      <div className="space-y-xs px-1">
        <div className="space-y-base">
          <h1 className="font-headline-lg text-on-surface leading-tight">
            {proj.name}
          </h1>
          <div className="flex items-center gap-2 font-label-caps text-on-surface-variant text-[9px]">
            <span>Klien: {proj.client?.name || "-"}</span>
            <span>•</span>
            <span>PM: {proj.projectManager?.name || "-"}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge status={financialHealth}>{`Kesehatan: ${financialHealth}`}</Badge>
          <Badge status={budget?.status === "APPROVED" ? "APPROVED" : "DRAFT"}>
            {`RAB: ${budget?.status || "TIDAK ADA"}`}
          </Badge>
        </div>
      </div>

      {/* Card Ringkasan Finansial Proyek */}
      <div className="premium-card p-md border border-outline-variant/30 space-y-md">
        <div className="pb-sm border-b border-outline-variant/10">
          <h3 className="font-label-caps text-on-surface flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
            Ringkasan Keuangan RAB
          </h3>
        </div>
        <div className="space-y-md">
          <div className="grid grid-cols-2 gap-md border-b border-outline-variant/10 pb-md">
            <div className="space-y-base">
              <span className="font-label-caps text-[9px] text-on-surface-variant">Nilai Kontrak</span>
              <div className="font-numeral-md text-on-surface font-bold financial-amount">
                Rp {Number(proj.totalContractValue).toLocaleString("id-ID")}
              </div>
            </div>
            <div className="space-y-base">
              <span className="font-label-caps text-[9px] text-on-surface-variant">Total Alokasi (RAB)</span>
              <div className="font-numeral-md text-on-surface font-bold financial-amount">
                Rp {totalAllocated.toLocaleString("id-ID")}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-md">
            <div className="space-y-base">
              <span className="font-label-caps text-[9px] text-on-surface-variant">Realisasi Belanja</span>
              <div className="font-numeral-md text-on-surface font-bold financial-amount">
                Rp {totalSpent.toLocaleString("id-ID")}
              </div>
            </div>
            <div className="space-y-base">
              <span className="font-label-caps text-[9px] text-on-surface-variant">Sisa Plafon Anggaran</span>
              <div className={`font-numeral-md font-bold financial-amount ${totalRemaining < 0 ? "text-error" : "text-primary"}`}>
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
          <h3 className="font-label-caps text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">trending_up</span>
            Analisis Profitabilitas Proyek
          </h3>
        </div>
        <div className="space-y-md">
          {/* Proyeksi Laba Kotor */}
          <div className="flex justify-between items-center border-b border-outline-variant/10 pb-md">
            <div className="space-y-base min-w-0 flex-1">
              <span className="font-label-caps text-[9px] text-on-surface-variant">Proyeksi Laba Kotor (Gross Profit)</span>
              <p className="text-[11px] text-on-surface-variant leading-tight truncate">Nilai Kontrak - Anggaran RAB</p>
            </div>
            <div className="text-right shrink-0">
              <div className={`font-numeral-md font-bold financial-amount ${projectedGrossProfit >= 0 ? "text-primary" : "text-error"}`}>
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
              <span className="font-label-caps text-[9px] text-on-surface-variant">Laba Bersih Riil (Net Profit)</span>
              <p className="text-[11px] text-on-surface-variant leading-tight truncate">Kas Masuk Klien - Realisasi Belanja</p>
            </div>
            <div className="text-right shrink-0">
              <div className={`font-numeral-md font-bold financial-amount ${realizedNetProfit >= 0 ? "text-primary" : "text-error"}`}>
                {realizedNetProfit < 0 ? "-" : ""}Rp {Math.abs(realizedNetProfit).toLocaleString("id-ID")}
              </div>
              <span className="font-label-caps text-[8px] text-on-surface-variant block">
                Terbayar: Rp {totalReceived.toLocaleString("id-ID")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Rincian Item Anggaran Per Kategori (Interaktif via BudgetManager) */}
      <BudgetManager
        projectId={projectId}
        budget={budget}
        costCategories={costCategoriesData}
        userRole={roleName || "UNKNOWN"}
        userId={session.user.id}
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
