import { db } from "@/db";
import { approval, projectCost, vendorPayment } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { resolveRoleName } from "@/lib/auth/permissions";
import { ApprovalList, ApprovalItem } from "@/components/approvals/approval-list";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import React from "react";

export default async function ApprovalsPage(): Promise<React.JSX.Element> {
  // 1. Get session
  const session = await auth.api.getSession({
    headers: {
      cookie: (await (await import("next/headers")).cookies()).toString(),
    },
  });

  if (!session || !session.user) {
    redirect("/login");
  }

  // 2. Resolve role & enforce permissions (Only OWNER can access approvals screen)
  const roleName = await resolveRoleName(session.user.roleId);
  if (roleName !== "OWNER") {
    return (
      <section className="py-12 px-4 text-center space-y-4">
        <AlertTriangle className="mx-auto h-12 w-12 text-critical" />
        <h1 className="text-xl font-bold text-text-primary">Akses Terbatas</h1>
        <p className="text-sm text-secondary">
          Hanya Pemilik Perusahaan (Owner) yang memiliki otorisasi untuk mengakses antrean persetujuan finansial.
        </p>
      </section>
    );
  }

  // 3. Query pending approvals
  const pendingApprovals = await db.query.approval.findMany({
    where: eq(approval.status, "PENDING"),
    orderBy: [desc(approval.createdAt)],
  });

  // 4. Resolve details for each approval polymorphically
  const resolvedApprovals: ApprovalItem[] = [];

  for (const app of pendingApprovals) {
    if (app.referenceType === "project_cost") {
      const cost = await db.query.projectCost.findFirst({
        where: eq(projectCost.id, app.referenceId),
        with: {
          project: true,
          budgetItem: {
            with: {
              costCategory: true,
            },
          },
          requestedBy: true,
        },
      });

      if (cost) {
        resolvedApprovals.push({
          id: app.id,
          createdAt: app.createdAt,
          notes: app.notes,
          type: "project_cost",
          referenceId: app.referenceId,
          amount: Number(cost.amount),
          description: cost.description,
          receiptImageUrl: cost.receiptImageUrl,
          projectName: cost.project?.name || "Proyek Tidak Dikenal",
          budgetItemName: cost.budgetItem?.name || "Kategori Belum Ditentukan",
          allocatedAmount: Number(cost.budgetItem?.allocatedAmount || 0),
          actualSpent: Number(cost.budgetItem?.actualSpent || 0),
          requestedBy: cost.requestedBy?.name || "Project Manager",
          budgetOverrun: cost.budgetOverrun,
        });
      }
    } else if (app.referenceType === "vendor_payment") {
      const pay = await db.query.vendorPayment.findFirst({
        where: eq(vendorPayment.id, app.referenceId),
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
        },
      });

      if (pay && pay.vendorBill) {
        resolvedApprovals.push({
          id: app.id,
          createdAt: app.createdAt,
          notes: app.notes,
          type: "vendor_payment",
          referenceId: app.referenceId,
          amount: Number(pay.amountPaid),
          description: pay.vendorBill.notes || `Pembayaran Tagihan Vendor #${pay.vendorBill.billNumber}`,
          receiptImageUrl: null,
          projectName: pay.vendorBill.project?.name || "Proyek Tidak Dikenal",
          budgetItemName: pay.vendorBill.budgetItem?.name || "Kategori Belum Ditentukan",
          allocatedAmount: Number(pay.vendorBill.budgetItem?.allocatedAmount || 0),
          actualSpent: Number(pay.vendorBill.budgetItem?.actualSpent || 0),
          requestedBy: pay.vendorBill.vendor?.name || "Vendor Supplier",
          budgetOverrun: false, // Default false, or we can check overrun
        });
      }
    }
  }

  return (
    <section className="space-y-6 py-6 px-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Antrean Persetujuan</h1>
        <p className="text-sm text-secondary">
          Berikan keputusan persetujuan atau penolakan pengajuan keuangan di atas limit Rp 5.000.000 atau budget overrun.
        </p>
      </div>

      <ApprovalList initialApprovals={resolvedApprovals} />
    </section>
  );
}
