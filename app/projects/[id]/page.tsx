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

interface PageProps {
  params: Promise<{ id: string }>;
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

      {/* Rincian Item Anggaran Per Kategori */}
      <div className="space-y-md px-1">
        <h2 className="font-label-caps text-on-surface-variant">Rincian Anggaran (BoQ)</h2>

        {Object.keys(itemsByCategory).length === 0 ? (
          <div className="premium-card p-md flex flex-col items-center justify-center py-10 text-center border border-outline-variant/30">
            <div className="h-10 w-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant mb-2">
              <span className="material-symbols-outlined text-[24px]">description</span>
            </div>
            <p className="font-body-sm text-on-surface-variant">
              Tidak ada item anggaran yang terdaftar pada RAB proyek ini.
            </p>
          </div>
        ) : (
          Object.keys(itemsByCategory).map((catName) => {
            const items = itemsByCategory[catName];
            return (
              <div key={catName} className="space-y-sm">
                <div className="flex items-center">
                  <span className="font-label-caps text-[10px] text-primary bg-surface-container border border-outline-variant/20 px-2.5 py-1 rounded-full">
                    Kategori: {catName}
                  </span>
                </div>

                <div className="space-y-sm">
                  {items.map((item) => {
                    const allocated = Number(item.allocatedAmount);
                    const spent = Number(item.actualSpent);
                    const remaining = allocated - spent;
                    const percent = allocated > 0 ? (spent / allocated) * 100 : 0;
                    const isOverrun = spent > allocated;

                    return (
                      <div key={item.id} className="premium-card p-md border border-outline-variant/20 bg-surface/60 hover:bg-surface active:scale-[0.99] transition-all space-y-md">
                        <div className="flex flex-col gap-sm">
                          <div className="flex items-start justify-between gap-md">
                            <div className="min-w-0 space-y-base">
                              <h3 className="font-body-sm font-bold text-on-surface truncate max-w-[200px]">{item.name}</h3>
                              <p className="font-label-caps text-[9px] text-on-surface-variant font-bold tracking-tight">
                                Plafon: Rp {allocated.toLocaleString("id-ID")}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <div className={`font-numeral-md font-bold financial-amount ${isOverrun ? "text-error" : "text-primary"}`}>
                                {isOverrun ? "-" : ""}Rp {Math.abs(remaining).toLocaleString("id-ID")}
                              </div>
                              <span className="font-label-caps text-[8px] text-on-surface-variant block">
                                {isOverrun ? "Overrun" : "Sisa Plafon"}
                              </span>
                            </div>
                          </div>

                          {/* Progress Bar Item Anggaran */}
                          <div className="space-y-xs">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container border border-outline-variant/10">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isOverrun ? "bg-error" : percent >= 90 ? "bg-secondary" : "bg-primary"
                                }`}
                                style={{ width: `${Math.min(percent, 100)}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-on-surface-variant">
                              <span>Realisasi: Rp {spent.toLocaleString("id-ID")}</span>
                              <span>{percent.toFixed(1)}% terpakai</span>
                            </div>
                          </div>
                        </div>
                      </div>
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
