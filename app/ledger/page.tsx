import { db } from "@/db";
import { bankAccount, cashTransaction, notification, approval, aiRun } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { resolveRoleName } from "@/lib/auth/permissions";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from "@/components/ui";
import { redirect } from "next/navigation";
import Link from "next/link";
import { 
  ClipboardList, 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  Wallet,
  Clock
} from "lucide-react";
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

export default async function LedgerPage(): Promise<React.JSX.Element> {
  // 1. Get session
  const session = await auth.api.getSession({
    headers: {
      cookie: (await import("next/headers")).cookies().toString(),
    },
  });

  if (!session || !session.user) {
    redirect("/login");
  }

  // 2. Resolve role & enforce permissions (Ledger is Owner and Finance Admin only)
  const roleName = await resolveRoleName(session.user.roleId);
  const isOwner = roleName === "OWNER";
  const isFinanceAdmin = roleName === "FINANCE_ADMIN";

  if (!isOwner && !isFinanceAdmin) {
    return (
      <section className="py-12 px-4 text-center space-y-4">
        <AlertTriangle className="mx-auto h-12 w-12 text-critical animate-bounce" />
        <h1 className="text-xl font-bold text-text-primary">Akses Ditolak</h1>
        <p className="text-sm text-secondary">
          Hanya Owner dan Finance Admin yang diizinkan untuk membuka Buku Kas Ledger.
        </p>
      </section>
    );
  }

  // 3. Query all required CFO Dashboard data
  // 3.1 Bank Accounts
  const accounts = await db.query.bankAccount.findMany();

  // 3.2 Recent cash transactions (Ledger)
  const ledgerTransactions = await db.query.cashTransaction.findMany({
    orderBy: [desc(cashTransaction.createdAt)],
    limit: 15,
    with: {
      bankAccount: true,
    },
  });

  // 3.3 Financial notifications (overrun / warnings)
  const alertsList = await db.query.notification.findMany({
    where: eq(notification.userId, session.user.id),
    orderBy: [desc(notification.createdAt)],
    limit: 5,
  });

  // 3.4 Pending Approvals count (Only for OWNER)
  const pendingApprovals = await db.query.approval.findMany({
    where: eq(approval.status, "PENDING"),
  });
  const pendingCount = pendingApprovals.length;

  // 3.5 AI CFO Daily Briefing (Latest completed run)
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
    <section className="space-y-6 py-6 px-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Dasbor Keuangan</h1>
          <p className="text-xs text-secondary">Ringkasan kas besar, piutang termin, dan realisasi AP.</p>
        </div>
        <Badge status={isOwner ? "APPROVED" : "PARTIALLY_PAID"}>
          {isOwner ? "OWNER CONTROL" : "FINANCE ADMIN"}
        </Badge>
      </div>

      {/* Banner Pending Approvals (Hanya untuk OWNER) */}
      {isOwner && pendingCount > 0 && (
        <Link href="/approvals" className="block transition active:scale-[0.99]">
          <div className="flex items-center justify-between rounded-2xl border border-critical/30 bg-critical-light/15 p-4 text-critical shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 animate-pulse shrink-0" />
              <div>
                <div className="text-sm font-bold">Persetujuan Diperlukan!</div>
                <div className="text-xs text-secondary">
                  Terdapat {pendingCount} pengajuan dana/pembayaran yang menunggu persetujuan Anda.
                </div>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-critical shrink-0" />
          </div>
        </Link>
      )}

      {/* AI Daily Briefing Box */}
      <Card className="rounded-3xl border border-primary/20 bg-primary-light/5 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
        <CardHeader className="p-0 pb-3 flex flex-row items-center gap-2">
          <Sparkles className="h-5 w-5 text-warning shrink-0" />
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-text-primary">
            AI CFO Daily Briefing
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 space-y-3">
          {parsedBriefing ? (
            <>
              <p className="text-xs text-secondary font-medium leading-relaxed">
                Tanggal Briefing: {new Date(parsedBriefing.briefingDate).toLocaleDateString("id-ID", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <div className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
                {parsedBriefing.summary}
              </div>
            </>
          ) : (
            <div className="text-sm text-secondary leading-relaxed">
              Taklimat CFO harian AI belum tersedia pagi ini. Kueri data harian secara otomatis memicu data ini setiap pukul 08:00 pagi via cron job.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Akun Bank (Horizontal Swipe Grid) */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-secondary">Rekening Kas Perusahaan</h2>
        <div className="flex gap-4 overflow-x-auto snap-x scroll-smooth pb-3 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {accounts.map((acc) => {
            const isPetty = acc.name.toLowerCase().includes("petty") || acc.name.toLowerCase().includes("kecil");
            return (
              <div
                key={acc.id}
                className="min-w-[82%] snap-center shrink-0 rounded-2xl border border-border bg-surface p-4.5 shadow-[0_4px_16px_rgba(0,0,0,0.15)] flex flex-col justify-between min-h-[120px]"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-primary bg-primary-light px-2 py-0.5 rounded-md inline-block">
                      {acc.bankName}
                    </div>
                    <div className="text-xs text-muted font-medium mt-1">{acc.accountNumber}</div>
                  </div>
                  <Wallet className={`h-5 w-5 ${isPetty ? "text-warning" : "text-success"}`} />
                </div>
                <div className="mt-4">
                  <div className="text-[10px] uppercase font-semibold text-muted tracking-wider">Saldo Aktual</div>
                  <div className="text-lg font-bold text-text-primary tabular-nums">
                    Rp {Number(acc.balance).toLocaleString("id-ID")}
                  </div>
                  <div className="text-[9px] text-muted mt-0.5 truncate">A/N: {acc.holderName}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Financial Warning Alerts Feed */}
      {alertsList.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-secondary">Feed Peringatan Finansial</h2>
          <div className="space-y-2">
            {alertsList.map((alt) => {
              const isCritical = alt.severity === "CRITICAL";
              return (
                <div
                  key={alt.id}
                  className={`flex items-start gap-3 rounded-2xl border p-3.5 text-xs ${
                    isCritical 
                      ? "border-critical/30 bg-critical-light/10 text-critical" 
                      : "border-warning/30 bg-warning-light/10 text-warning"
                  }`}
                >
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">{alt.title}</div>
                    <div className="text-secondary mt-0.5 leading-relaxed">{alt.message}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Buku Kas ledger (Recent Transactions stream) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-secondary">Riwayat Buku Kas Ledger</h2>
          <ClipboardList className="h-4 w-4 text-muted" />
        </div>

        {ledgerTransactions.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-8 text-center">
            <CardDescription>Belum ada transaksi kas tercatat.</CardDescription>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {ledgerTransactions.map((tx) => {
              const isDebit = tx.type === "DEBIT";
              const amountVal = Number(tx.amount);
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3.5 bg-surface border border-border rounded-2xl text-xs hover:border-elevated transition-colors duration-150"
                >
                  <div className="flex items-start gap-3 min-w-[70%]">
                    <div className={`p-2 rounded-xl shrink-0 ${isDebit ? "bg-success-light/20 text-success" : "bg-critical-light/20 text-critical"}`}>
                      {isDebit ? <TrendingUp className="h-4.5 w-4.5" /> : <TrendingDown className="h-4.5 w-4.5" />}
                    </div>
                    <div className="space-y-1 truncate">
                      <div className="font-bold text-text-primary truncate">{tx.description}</div>
                      <div className="text-[10px] text-muted flex items-center gap-1.5">
                        <Badge status={tx.reconciled ? "PAID" : "PENDING"} className="text-[8px] py-0 px-1.5 min-h-[16px]">
                          {tx.reconciled ? "Reconciled" : "Draft"}
                        </Badge>
                        <span>•</span>
                        <span className="uppercase text-[8px]">{tx.category}</span>
                        <span>•</span>
                        <span>{tx.bankAccount?.name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold tabular-nums text-sm ${isDebit ? "text-success" : "text-critical"}`}>
                      {isDebit ? "+" : "-"}Rp {amountVal.toLocaleString("id-ID")}
                    </div>
                    <div className="text-[9px] text-muted mt-0.5 flex items-center gap-1 justify-end">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(tx.createdAt).toLocaleDateString("id-ID", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </div>
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
