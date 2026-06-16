import { db } from "@/db";
import { project } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { resolveRoleName } from "@/lib/auth/permissions";
import { scopeProjectQuery } from "@/lib/auth/scoping";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { redirect } from "next/navigation";
import React from "react";

export default async function ProjectsPage(): Promise<React.JSX.Element> {
  // 1. Get session
  const session = await auth.api.getSession({
    headers: {
      cookie: (await (await import("next/headers")).cookies()).toString(),
    },
  });

  if (!session || !session.user) {
    redirect("/login");
  }

  // 2. Resolve PM scoping filter
  const roleName = await resolveRoleName(session.user.roleId);
  const projectFilter = scopeProjectQuery(session.user.id, roleName);

  // 3. Query projects
  const projectsData = await db.query.project.findMany({
    where: projectFilter 
      ? and(eq(project.status, "ACTIVE"), projectFilter)
      : eq(project.status, "ACTIVE"),
    with: {
      client: true,
      projectManager: true,
    },
  });

  return (
    <section className="space-y-sm select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="space-y-base">
          <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-primary">Atria Projects</p>
          <h1 className="font-sans text-[24px] leading-[32px] tracking-tight font-semibold text-on-surface">Daftar Proyek</h1>
        </div>
        <Badge status="APPROVED">{`${projectsData.length.toString()} Aktif`}</Badge>
      </div>

      {projectsData.length === 0 ? (
        <div className="premium-card p-md flex flex-col items-center justify-center py-14 text-center border border-outline-variant/30">
          <div className="h-14 w-14 rounded-2xl bg-surface-container flex items-center justify-center text-on-surface-variant mb-4">
            <span className="material-symbols-outlined text-[32px]">folder_copy</span>
          </div>
          <h3 className="font-sans text-[20px] leading-[28px] font-semibold text-[16px] text-on-surface">Tidak Ada Proyek</h3>
          <p className="font-sans text-[14px] leading-[20px] font-normal text-on-surface-variant mt-1">
            Saat ini tidak ada rencana anggaran proyek aktif yang ditugaskan kepada Anda.
          </p>
        </div>
      ) : (
        <div className="space-y-md">
          {projectsData.map((proj) => {
            const contractVal = Number(proj.totalContractValue);
            const financialHealth = proj.financialHealth as "HEALTHY" | "WARNING" | "CRITICAL";

            return (
              <Link key={proj.id} href={`/projects/${proj.id}`} className="block transition active:scale-[0.98] duration-100">
                <div className="premium-card p-md border border-outline-variant/30 hover:border-primary/40 space-y-md">
                  
                  {/* Top Row: Title & Status Badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-surface-container flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-[22px]">work</span>
                      </div>
                      <h3 className="font-sans text-[16px] leading-[24px] font-normal font-bold text-on-surface truncate max-w-[200px]">
                        {proj.name}
                      </h3>
                    </div>
                    <Badge status={financialHealth}>{financialHealth}</Badge>
                  </div>
                  
                  {/* Metadata Row */}
                  <div className="grid grid-cols-2 gap-md bg-surface-container-low p-sm rounded-lg border border-outline-variant/10">
                    <div className="space-y-base">
                      <span className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Klien</span>
                      <div className="flex items-center gap-1 text-on-surface font-semibold text-[13px] leading-tight">
                        <span className="material-symbols-outlined text-[16px] text-secondary">person</span>
                        <span className="truncate">{proj.client?.name || "-"}</span>
                      </div>
                    </div>
                    <div className="space-y-base">
                      <span className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Project Manager</span>
                      <div className="flex items-center gap-1 text-on-surface font-semibold text-[13px] leading-tight">
                        <span className="material-symbols-outlined text-[16px] text-secondary">person</span>
                        <span className="truncate">{proj.projectManager?.name || "-"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Contract Value Row */}
                  <div className="border-t border-outline-variant/20 pt-md flex items-center justify-between">
                    <span className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant">Nilai Kontrak</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[16px] leading-[20px] font-medium text-on-surface font-bold financial-amount">
                        Rp {contractVal.toLocaleString("id-ID")}
                      </span>
                      <span className="material-symbols-outlined text-outline-variant">chevron_right</span>
                    </div>
                  </div>
                  
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
