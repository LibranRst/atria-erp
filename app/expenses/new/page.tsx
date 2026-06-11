import { db } from "@/db";
import { project, projectBudget } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { resolveRoleName } from "@/lib/auth/permissions";
import { scopeProjectQuery } from "@/lib/auth/scoping";
import { ExpenseForm } from "@/components/expense/expense-form";
import { redirect } from "next/navigation";
import React from "react";

export default async function NewExpensePage(): Promise<React.JSX.Element> {
  // 1. Dapatkan session server-side
  const session = await auth.api.getSession({
    headers: {
      cookie: (await (await import("next/headers")).cookies()).toString(),
    },
  });

  if (!session || !session.user) {
    redirect("/login");
  }

  // 2. Selesaikan resolusi peran dan scoping proyek
  const roleName = await resolveRoleName(session.user.roleId);
  const projectFilter = scopeProjectQuery(session.user.id, roleName);

  // 3. Kueri proyek aktif yang dapat diakses oleh PM
  const projectsData = await db.query.project.findMany({
    where: projectFilter 
      ? and(eq(project.status, "ACTIVE"), projectFilter)
      : eq(project.status, "ACTIVE"),
    with: {
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

  return (
    <section className="space-y-4 py-6 px-4 pb-24">
      <ExpenseForm projects={projectsData} />
    </section>
  );
}
