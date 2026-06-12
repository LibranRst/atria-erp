import { db } from "@/db";
import { bankAccount, cashTransaction, clientInvoice, vendorBill, aiRun } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { resolveRoleName } from "@/lib/auth/permissions";
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
        <h1 className="text-xl font-headline-lg text-on-surface">Akses Ditolak</h1>
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
  const totalReceivables = clientInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);

  const vendorBills = await db.query.vendorBill.findMany();
  const totalPayables = vendorBills.reduce((sum, bill) => sum + Number(bill.amount), 0);

  const ledgerTransactions = await db.query.cashTransaction.findMany({
    orderBy: [desc(cashTransaction.createdAt)],
    limit: 10,
  });

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

  return (
    <>
      {/* Greeting Section */}
      <section className="space-y-base select-none">
        <p className="font-body-md text-on-surface-variant">Good morning, {session.user.name.split(" ")[0]}</p>
        <h2 className="font-headline-lg text-on-surface">Portfolio Overview</h2>
      </section>

      {/* Main KPI Card */}
      <section className="premium-card p-md !bg-primary text-on-primary relative overflow-hidden select-none">
        <div className="relative z-10">
          <p className="font-label-caps uppercase opacity-80 mb-1">Cash Available</p>
          <div className="flex items-baseline gap-1">
            <span className="font-numeral-lg text-[40px] !font-bold tracking-tight leading-none financial-amount">
              Rp {totalBalance.toLocaleString("id-ID")}
            </span>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">trending_up</span>
            <span className="font-body-sm">+2.4% from last month</span>
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
          <p className="font-label-caps text-on-surface-variant mb-2">Expected In</p>
          <p className="font-numeral-lg text-primary financial-amount">
            Rp {Math.round(totalReceivables / 1000000)}jt
          </p>
          <div className="h-1.5 w-full bg-surface-container mt-3 rounded-full overflow-hidden">
            <div className="bg-primary h-full w-[70%]" />
          </div>
        </div>

        {/* To Pay Card */}
        <div className="premium-card p-md">
          <p className="font-label-caps text-on-surface-variant mb-2">To Pay</p>
          <p className="font-numeral-lg text-secondary financial-amount">
            Rp {Math.round(totalPayables / 1000000)}jt
          </p>
          <div className="h-1.5 w-full bg-surface-container mt-3 rounded-full overflow-hidden">
            <div className="bg-secondary h-full w-[45%]" />
          </div>
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
              <h3 className="font-headline-md text-[16px] text-primary">AI Brief</h3>
              {parsedBriefing && (
                <span className="text-[8px] text-on-surface-variant/80 font-bold uppercase tracking-wider">
                  {new Date(parsedBriefing.briefingDate).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short"
                  })}
                </span>
              )}
            </div>
            <p className="font-body-md text-on-surface-variant">
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
          <h3 className="font-headline-md text-[18px]">Urgent Alerts</h3>
          <Link href="/approvals" className="text-primary font-label-caps active:opacity-85">
            View All
          </Link>
        </div>

        <div className="space-y-sm">
          {/* Alert 1 */}
          <Link href="/approvals" className="block active:scale-[0.99] transition-transform">
            <div className="premium-card p-md flex items-center justify-between border border-error">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-error" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                <span className="font-body-md font-semibold text-on-surface">3 Overdue Payments</span>
              </div>
              <span className="material-symbols-outlined text-outline-variant">chevron_right</span>
            </div>
          </Link>

          {/* Alert 2 */}
          <Link href="/projects" className="block active:scale-[0.99] transition-transform">
            <div className="premium-card p-md flex items-center justify-between border border-secondary">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>monitoring</span>
                <span className="font-body-md font-semibold text-on-surface">1 Project at Margin Risk</span>
              </div>
              <span className="material-symbols-outlined text-outline-variant">chevron_right</span>
            </div>
          </Link>
        </div>
      </section>

      {/* Recent Transactions Section */}
      <section className="space-y-sm pb-10 select-none">
        <h3 className="font-headline-md text-[18px] px-1 text-on-surface">Recent Transactions</h3>
        
        {ledgerTransactions.length === 0 ? (
          <div className="premium-card p-md flex items-center justify-center text-center">
            <p className="font-body-sm text-on-surface-variant">Belum ada mutasi kas tercatat.</p>
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
                      <p className="font-body-md font-bold text-on-surface truncate">{tx.description}</p>
                      <p className="font-body-sm text-on-surface-variant truncate">
                        {isDebit ? "Invoiced" : "Vendor Payment"}
                      </p>
                    </div>
                  </div>
                  <p className={`font-numeral-md financial-amount whitespace-nowrap shrink-0 text-right ${isDebit ? "text-primary font-bold" : "text-on-surface font-semibold"}`}>
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
