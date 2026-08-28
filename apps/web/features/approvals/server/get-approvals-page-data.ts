import { getFieldCostApprovalThresholdRupiah } from "@/lib/finance/approval-thresholds";
import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { bankAccount, projectCost } from "@/db/schema";
import type { ApprovalDetail } from "@atria/core/finance/approval-types";
import { getPendingApprovalDetails, rankPendingApprovals } from "@/lib/finance/approval-details";
import { actorHasPermission } from "@atria/core/auth/permissions";
import type { Actor } from "@/server/actor";

export type ApprovalsPageData =
  | {
      readonly status: "restricted";
    }
  | {
      readonly status: "ready";
      readonly approvals: readonly ApprovalDetail[];
      readonly canEmergencyOverride: boolean;
      readonly referenceDateIso: string;
      readonly bankAccounts: readonly {
        readonly id: string;
        readonly name: string;
        readonly bankName: string;
        readonly accountNumber: string;
        readonly balance: string;
      }[];
      readonly paymentCandidates: readonly {
        readonly id: string;
        readonly amount: string;
        readonly description: string;
        readonly budgetOverrun: boolean;
        readonly projectName: string;
      }[];
    };

export async function getApprovalsPageData(actor: Actor): Promise<ApprovalsPageData> {
  const roleName = actor.roleName;
  if (!actorHasPermission(roleName, "view:approval_queue")) {
    return { status: "restricted" };
  }

  const referenceDate = new Date();
  const [pendingDetails, accounts, payableCosts] = await Promise.all([
    getPendingApprovalDetails(),
    db.query.bankAccount.findMany({
      where: eq(bankAccount.isActive, true),
      orderBy: [desc(bankAccount.balance)],
    }),
    db.query.projectCost.findMany({
      where: eq(projectCost.status, "APPROVED"),
      with: { project: true },
      orderBy: [desc(projectCost.updatedAt)],
    }),
  ]);
  const approvals = rankPendingApprovals(
    pendingDetails,
    referenceDate,
    await getFieldCostApprovalThresholdRupiah(),
  );

  return {
    status: "ready",
    /*
     * Pemutus penuh melihat seluruh antrean; peran lain hanya melihat jenis
     * yang memang menjadi tanggung jawabnya. Hari ini penyempitan itu berhenti
     * di opening inventory — perilaku yang dipertahankan apa adanya dari versi
     * berbasis nama peran, dan yang layak ditinjau ulang saat peran menjadi
     * dinamis.
     */
    approvals: actorHasPermission(roleName, "decide:all_approvals")
      ? approvals
      : approvals.filter((item) => item.type === "inventory_opening"),
    canEmergencyOverride: actorHasPermission(roleName, "override:self_approval"),
    referenceDateIso: referenceDate.toISOString(),
    bankAccounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      balance: account.balance,
    })),
    paymentCandidates: payableCosts.map((cost) => ({
      id: cost.id,
      amount: cost.amount,
      description: cost.description,
      budgetOverrun: cost.budgetOverrun,
      projectName: cost.project?.name ?? "Proyek tidak tersedia",
    })),
  };
}
