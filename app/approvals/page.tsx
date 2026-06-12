import { db } from "@/db";
import { approval, projectCost, vendorPayment } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { resolveRoleName } from "@/lib/auth/permissions";
import { ApprovalList, ApprovalItem } from "@/components/approvals/approval-list";
import { Badge } from "@/components/ui/badge";
import { redirect } from "next/navigation";
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
      <section className="py-16 px-6 text-center space-y-4 max-w-sm mx-auto select-none">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-error-container/20 border border-error flex items-center justify-center text-error">
          <span className="material-symbols-outlined text-[32px] text-error animate-pulse">warning</span>
        </div>
        <h1 className="text-xl font-display font-bold text-on-surface">Akses Terbatas</h1>
        <p className="text-xs text-secondary leading-relaxed">
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
          budgetOverrun: false, // Default false
        });
      }
    }
  }

  return (
    <section className="space-y-sm select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="space-y-base">
          <p className="font-label-caps text-primary">Otorisasi Keuangan</p>
          <h1 className="font-headline-lg text-on-surface">Persetujuan</h1>
        </div>
        <Badge status={resolvedApprovals.length > 0 ? "CRITICAL" : "APPROVED"}>
          {resolvedApprovals.length > 0 ? `${resolvedApprovals.length} Antrean` : "Semua Bersih"}
        </Badge>
      </div>

      <div className="px-1">
        <p className="font-body-sm text-on-surface-variant leading-relaxed">
          Berikan keputusan persetujuan atau penolakan pengajuan keuangan di atas limit Rp 5.000.000 atau budget overrun.
        </p>
      </div>

      <div className="pt-xs">
        <ApprovalList initialApprovals={resolvedApprovals} />
      </div>
    </section>
  );
}
