import { db } from "@/db";
import { project, projectBudget, projectBudgetItem, projectCostCategory } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { resolveRoleName } from "@/lib/auth/permissions";
import { assertProjectAccess } from "@/lib/auth/scoping";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from "@/components/ui";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import React from "react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id: projectId } = await params;

  // 1. Get session
  const session = await auth.api.getSession({
    headers: {
      cookie: (await import("next/headers")).cookies().toString(),
    },
  });

  if (!session || !session.user) {
    redirect("/login");
  }

  // 2. Resolve role and enforce scoping
  const roleName = await resolveRoleName(session.user.roleId);
  try {
    await assertProjectAccess(projectId, session.user.id, roleName);
  } catch (err) {
    redirect("/projects");
  }

  // 3. Query project, budget, and items
  const proj = await db.query.project.findFirst({
    where: eq(project.id, projectId),
    with: {
      client: true,
      projectManager: true,
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

  return (
    <section className="space-y-6 py-6 px-4 pb-24">
      {/* Tombol Kembali */}
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-secondary hover:text-text-primary">
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Proyek
      </Link>

      {/* Header Info */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">{proj.name}</h1>
          <p className="text-sm text-secondary">
            Klien: {proj.client?.name || "-"} | PM: {proj.projectManager?.name || "-"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge status={financialHealth}>{`Kesehatan: ${financialHealth}`}</Badge>
          <Badge status={budget?.status === "APPROVED" ? "APPROVED" : "DRAFT"}>
            {`RAB: ${budget?.status || "TIDAK ADA"}`}
          </Badge>
        </div>
      </div>

      {/* Card Ringkasan Finansial Proyek */}
      <Card className="rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
        <CardHeader className="p-0 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Ringkasan Finansial RAB</p>
        </CardHeader>
        <CardContent className="p-0 space-y-4">
          <div className="grid grid-cols-2 gap-4 border-b border-border pb-4">
            <div>
              <div className="text-xs text-secondary">Total Nilai Kontrak</div>
              <div className="text-lg font-bold text-text-primary tabular-nums">
                Rp {Number(proj.totalContractValue).toLocaleString("id-ID")}
              </div>
            </div>
            <div>
              <div className="text-xs text-secondary">Alokasi Anggaran (RAB)</div>
              <div className="text-lg font-bold text-text-primary tabular-nums">
                Rp {totalAllocated.toLocaleString("id-ID")}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-secondary">Realisasi Pengeluaran</div>
              <div className="text-lg font-bold text-text-primary tabular-nums">
                Rp {totalSpent.toLocaleString("id-ID")}
              </div>
            </div>
            <div>
              <div className="text-xs text-secondary">Sisa Plafon Anggaran</div>
              <div className={`text-lg font-bold tabular-nums ${totalRemaining < 0 ? "text-critical" : "text-success"}`}>
                Rp {totalRemaining.toLocaleString("id-ID")}
              </div>
            </div>
          </div>

          {/* Progress Bar Utilitas Total */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-secondary">Utilitas Anggaran Proyek</span>
              <span className={totalUtilization >= 100 ? "text-critical" : totalUtilization >= 90 ? "text-warning" : "text-success"}>
                {totalUtilization.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  totalUtilization >= 100
                    ? "bg-critical"
                    : totalUtilization >= 90
                    ? "bg-warning"
                    : "bg-success"
                }`}
                style={{ width: `${Math.min(totalUtilization, 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rincian Item Anggaran Per Kategori */}
      <div className="space-y-6">
        <h2 className="text-lg font-bold text-text-primary">Rincian Rencana Anggaran (BoQ)</h2>

        {Object.keys(itemsByCategory).length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-8 text-center">
            <CardDescription>
              Tidak ada item anggaran yang terdaftar pada RAB proyek ini.
            </CardDescription>
          </Card>
        ) : (
          Object.keys(itemsByCategory).map((catName) => {
            const items = itemsByCategory[catName];
            return (
              <div key={catName} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary-light px-2.5 py-1 rounded-lg">
                    {catName}
                  </span>
                </div>

                <div className="space-y-3">
                  {items.map((item) => {
                    const allocated = Number(item.allocatedAmount);
                    const spent = Number(item.actualSpent);
                    const remaining = allocated - spent;
                    const percent = allocated > 0 ? (spent / allocated) * 100 : 0;
                    const isOverrun = spent > allocated;

                    return (
                      <Card key={item.id} className="p-4" variant="elevated">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-text-primary text-sm">{item.name}</h3>
                              <p className="text-xs text-muted">
                                Plafon: Rp {allocated.toLocaleString("id-ID")}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className={`text-sm font-bold tabular-nums ${isOverrun ? "text-critical" : "text-success"}`}>
                                {isOverrun ? "-" : ""}Rp {Math.abs(remaining).toLocaleString("id-ID")}
                              </div>
                              <span className="text-[10px] uppercase font-semibold text-muted tracking-wider">
                                {isOverrun ? "Overrun" : "Sisa Plafon"}
                              </span>
                            </div>
                          </div>

                          {/* Progress Bar Item Anggaran */}
                          <div className="space-y-1">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isOverrun ? "bg-critical" : percent >= 90 ? "bg-warning" : "bg-primary"
                                }`}
                                style={{ width: `${Math.min(percent, 100)}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-semibold text-muted">
                              <span>Realisasi: Rp {spent.toLocaleString("id-ID")}</span>
                              <span>{percent.toFixed(1)}% terpakai</span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
