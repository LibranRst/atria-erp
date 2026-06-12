import { db } from "@/db";
import { projectCost, bankAccount } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { resolveRoleName } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { ExpenseList } from "@/components/expense/expense-list";
import React from "react";

export default async function ExpensesPage(): Promise<React.JSX.Element> {
  // 1. Dapatkan session server-side
  const session = await auth.api.getSession({
    headers: {
      cookie: (await (await import("next/headers")).cookies()).toString(),
    },
  });

  if (!session || !session.user) {
    redirect("/login");
  }

  // 2. Resolve role & batasi kueri sesuai hak akses
  const roleName = await resolveRoleName(session.user.roleId);
  const isPM = roleName === "PROJECT_MANAGER";
  const costFilter = isPM ? eq(projectCost.requestedById, session.user.id) : undefined;

  // 3. Kueri data projectCost (PM: hanya miliknya; Owner/Finance: semua)
  const costsData = await db.query.projectCost.findMany({
    where: costFilter,
    with: {
      project: true,
      budgetItem: {
        with: {
          costCategory: true,
        },
      },
      requestedBy: true,
    },
    orderBy: [desc(projectCost.createdAt)],
  });

  // 4. Kueri daftar rekening bank untuk keperluan pencairan
  const bankAccountsData = await db.query.bankAccount.findMany();

  return (
    <section className="space-y-sm select-none">
      <ExpenseList 
        initialCosts={costsData as any} 
        bankAccounts={bankAccountsData} 
        userRole={roleName || "UNKNOWN"}
      />
    </section>
  );
}
