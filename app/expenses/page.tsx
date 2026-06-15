import { db } from "@/db";
import { projectCost, vendorBill, vendorPayment, vendor, project, bankAccount } from "@/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { resolveRoleName } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { ExpenseCostItem, ExpenseList } from "@/components/expense/expense-list";
import React from "react";

function toExpenseCostStatus(status: string): ExpenseCostItem["status"] {
  switch (status) {
    case "SUBMITTED":
    case "VERIFIED":
    case "APPROVED":
    case "REJECTED":
    case "PAID":
      return status;
    default:
      throw new Error(`Status pengajuan biaya tidak dikenal: ${status}`);
  }
}

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
  
  // Field claims filter
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

  // 4. Kueri data Vendor Bills (Tagihan Vendor) & Vendor Payments (Rencana Pembayaran)
  let vendorBillFilter = undefined;
  let vendorPaymentFilter = undefined;

  if (isPM) {
    const pmProjects = await db.query.project.findMany({
      where: eq(project.projectManagerId, session.user.id),
      columns: { id: true },
    });
    const pmProjectIds = pmProjects.map((p) => p.id);
    if (pmProjectIds.length > 0) {
      vendorBillFilter = inArray(vendorBill.projectId, pmProjectIds);
      
      const pmBills = await db.query.vendorBill.findMany({
        where: inArray(vendorBill.projectId, pmProjectIds),
        columns: { id: true },
      });
      const pmBillIds = pmBills.map((b) => b.id);
      if (pmBillIds.length > 0) {
        vendorPaymentFilter = inArray(vendorPayment.vendorBillId, pmBillIds);
      } else {
        vendorPaymentFilter = eq(vendorPayment.id, "00000000-0000-0000-0000-000000000000");
      }
    } else {
      vendorBillFilter = eq(vendorBill.id, "00000000-0000-0000-0000-000000000000");
      vendorPaymentFilter = eq(vendorPayment.id, "00000000-0000-0000-0000-000000000000");
    }
  }

  const vendorBillsData = await db.query.vendorBill.findMany({
    where: vendorBillFilter,
    with: {
      project: true,
      vendor: true,
      budgetItem: {
        with: {
          costCategory: true,
        },
      },
      payments: {
        with: {
          bankAccount: true,
        },
      },
    },
    orderBy: [desc(vendorBill.createdAt)],
  });

  const vendorPaymentsData = await db.query.vendorPayment.findMany({
    where: vendorPaymentFilter,
    with: {
      vendorBill: {
        with: {
          project: true,
          vendor: true,
          budgetItem: {
            with: {
              costCategory: true,
            },
          },
        },
      },
      bankAccount: true,
      paidBy: true,
    },
    orderBy: [desc(vendorPayment.createdAt)],
  });

  // 5. Kueri daftar rekening bank
  const bankAccountsData = await db.query.bankAccount.findMany();

  // 6. Kueri metadata pendukung form input (Vendors & Projects)
  const vendorsData = await db.query.vendor.findMany({
    orderBy: [desc(vendor.name)],
  });

  const pmProjectFilter = isPM ? eq(project.projectManagerId, session.user.id) : undefined;
  const projectsData = await db.query.project.findMany({
    where: pmProjectFilter ? and(eq(project.status, "ACTIVE"), pmProjectFilter) : eq(project.status, "ACTIVE"),
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

  const costsForList: ExpenseCostItem[] = costsData.map((cost) => ({
    ...cost,
    status: toExpenseCostStatus(cost.status),
  }));

  return (
    <section className="space-y-sm select-none">
      <ExpenseList 
        initialCosts={costsForList} 
        bankAccounts={bankAccountsData} 
        userRole={roleName || "UNKNOWN"}
        vendorBills={vendorBillsData}
        vendorPayments={vendorPaymentsData}
        vendors={vendorsData}
        projects={projectsData}
      />
    </section>
  );
}

