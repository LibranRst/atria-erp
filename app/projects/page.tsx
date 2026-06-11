import { db } from "@/db";
import { project } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { resolveRoleName } from "@/lib/auth/permissions";
import { scopeProjectQuery } from "@/lib/auth/scoping";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from "@/components/ui";
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
    <section className="space-y-6 py-6 px-4 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Daftar Proyek</h1>
          <p className="text-sm text-secondary">Pilih proyek untuk melihat rincian rencana anggaran (BoQ).</p>
        </div>
        <Badge status="APPROVED">{`${projectsData.length.toString()} Aktif`}</Badge>
      </div>

      {projectsData.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12 text-center">
          <CardHeader>
            <CardTitle className="text-muted">Tidak Ada Proyek Aktif</CardTitle>
            <CardDescription>
              Saat ini tidak ada proyek aktif yang ditugaskan kepada Anda.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projectsData.map((proj) => {
            const contractVal = Number(proj.totalContractValue);
            const financialHealth = proj.financialHealth as "HEALTHY" | "WARNING" | "CRITICAL";

            return (
              <Link key={proj.id} href={`/projects/${proj.id}`} className="block transition active:scale-[0.99]">
                <Card className="hover:border-primary">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg font-bold">{proj.name}</CardTitle>
                    <Badge status={financialHealth}>{financialHealth}</Badge>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    <div className="text-xs text-secondary">
                      <span className="font-semibold">Klien:</span> {proj.client?.name || "-"}
                    </div>
                    <div className="text-xs text-secondary">
                      <span className="font-semibold">PM:</span> {proj.projectManager?.name || "-"}
                    </div>
                    <div className="border-t border-border pt-2.5 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted">Nilai Kontrak</span>
                      <span className="text-sm font-bold text-text-primary tabular-nums">
                        Rp {contractVal.toLocaleString("id-ID")}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
